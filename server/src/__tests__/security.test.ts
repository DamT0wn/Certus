import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { User, LegalDocument, ChatSession } from "../models";
import {
  validateUploadedPdf,
  sanitizeFilename,
  securityHeaders,
} from "../middleware/security";
import { getDocument, whatIf } from "../controllers/documentController";
import { getChatHistory } from "../controllers/chatController";

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await LegalDocument.deleteMany({});
  await ChatSession.deleteMany({});
});

function mockRes() {
  const res: any = {};
  res.statusCode = 200;
  res.headers = {};
  res.setHeader = jest.fn((key, val) => {
    res.headers[key] = val;
  });
  res.status = jest.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((data) => {
    res.data = data;
    return res;
  });
  return res;
}

describe("Security & Robustness Controls", () => {
  describe("PDF Magic Byte & Password Protection Validation (FR-1.6)", () => {
    test("accepts valid PDF header (%PDF-1.4)", () => {
      const validBuffer = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF");
      const result = validateUploadedPdf(validBuffer);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test("rejects non-PDF files (e.g. plain text or script)", () => {
      const textBuffer = Buffer.from("Hello world, this is a plain text file not a PDF.");
      const result = validateUploadedPdf(textBuffer);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/Unsupported file type/i);
    });

    test("detects and rejects password-protected / encrypted PDFs", () => {
      const encryptedPdf = Buffer.from(
        "%PDF-1.5\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n" +
        "trailer\n<< /Encrypt 3 0 R /Size 5 >>\n%%EOF"
      );
      const result = validateUploadedPdf(encryptedPdf);
      expect(result.valid).toBe(false);
      expect(result.isEncrypted).toBe(true);
      expect(result.error).toMatch(/Password-protected PDFs cannot be processed/i);
    });

    test("rejects empty or truncated buffers", () => {
      const emptyBuffer = Buffer.alloc(0);
      const result = validateUploadedPdf(emptyBuffer);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/Empty or truncated/i);
    });
  });

  describe("Filename Sanitization", () => {
    test("neutralizes path traversal attempts in uploaded filenames", () => {
      const maliciousName = "../../../../../etc/passwd";
      const sanitized = sanitizeFilename(maliciousName);
      expect(sanitized).not.toContain("/");
      expect(sanitized).not.toContain("\\");
      expect(sanitized).toMatch(/^[a-zA-Z0-9._-]+$/);
    });
  });

  describe("Security Headers Middleware", () => {
    test("sets essential hardening headers", () => {
      const req: any = {};
      const res = mockRes();
      const next = jest.fn();

      securityHeaders(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith("X-Content-Type-Options", "nosniff");
      expect(res.setHeader).toHaveBeenCalledWith("X-Frame-Options", "DENY");
      expect(res.setHeader).toHaveBeenCalledWith("Strict-Transport-Security", expect.stringContaining("max-age"));
      expect(res.setHeader).toHaveBeenCalledWith("Referrer-Policy", "strict-origin-when-cross-origin");
      expect(next).toHaveBeenCalled();
    });
  });

  describe("Cross-Tenant Data Isolation (IDOR Protection)", () => {
    test("User A cannot read User B's document", async () => {
      const userAId = new mongoose.Types.ObjectId();
      const userBId = new mongoose.Types.ObjectId();

      const docB = await LegalDocument.create({
        ownerId: userBId,
        filename: "confidential_deal.pdf",
        mimeType: "application/pdf",
        ocrText: "Top secret acquisition terms.",
      });

      // User A attempts to view User B's document
      const req: any = { params: { id: docB._id.toString() }, userId: userAId.toString() };
      const res = mockRes();

      await getDocument(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.data.error).toMatch(/Document not found/i);
    });

    test("User A cannot read User B's chat history", async () => {
      const userAId = new mongoose.Types.ObjectId();
      const userBId = new mongoose.Types.ObjectId();

      const docB = await LegalDocument.create({
        ownerId: userBId,
        filename: "confidential_chat.pdf",
        mimeType: "application/pdf",
      });

      await ChatSession.create({
        documentId: docB._id,
        messages: [{ role: "user", text: "What is the secret valuation?" }],
      });

      // User A attempts to read User B's chat history
      const req: any = { params: { documentId: docB._id.toString() }, userId: userAId.toString() };
      const res = mockRes();

      await getChatHistory(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.data.error).toMatch(/Document not found/i);
    });

    test("User A cannot run whatIf scenario on User B's document", async () => {
      const userAId = new mongoose.Types.ObjectId();
      const userBId = new mongoose.Types.ObjectId();

      const docB = await LegalDocument.create({
        ownerId: userBId,
        filename: "exclusive_contract.pdf",
        mimeType: "application/pdf",
      });

      const req: any = {
        params: { id: docB._id.toString() },
        body: { scenarioPrompt: "What if there is a breach?" },
        userId: userAId.toString(),
      };
      const res = mockRes();

      await whatIf(req, res);

      expect(res.statusCode).toBe(404);
    });
  });
});
