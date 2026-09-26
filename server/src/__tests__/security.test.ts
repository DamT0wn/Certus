import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import type { Request, Response } from "express";
import { LegalDocument, ChatSession } from "../models";
import type { DemoSessionRequest } from "../middleware/demoSession";
import {
  validateUploadedPdf,
  sanitizeFilename,
  securityHeaders,
} from "../middleware/security";
import { getDocument, whatIf } from "../controllers/documentController";
import { getChatHistory } from "../controllers/chatController";
import { errorHandler, type AppError } from "../middleware/errorHandler";

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
  await LegalDocument.deleteMany({});
  await ChatSession.deleteMany({});
});

function mockRes() {
  const res: {
    statusCode: number;
    headers: Record<string, string>;
    data: Record<string, unknown>;
    setHeader: jest.Mock;
    status: jest.Mock;
    json: jest.Mock;
  } = { statusCode: 200, headers: {}, data: {}, setHeader: jest.fn(), status: jest.fn(), json: jest.fn() };
  res.setHeader.mockImplementation((key: string, val: string) => {
    res.headers[key] = val;
  });
  res.status.mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json.mockImplementation((data: Record<string, unknown>) => {
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
      const req = {} as DemoSessionRequest;
      const res = mockRes();
      const next = jest.fn();

      securityHeaders(req, res as unknown as Response, next);

      expect(res.setHeader).toHaveBeenCalledWith("X-Content-Type-Options", "nosniff");
      expect(res.setHeader).toHaveBeenCalledWith("X-Frame-Options", "DENY");
      expect(res.setHeader).toHaveBeenCalledWith("Strict-Transport-Security", expect.stringContaining("max-age"));
      expect(res.setHeader).toHaveBeenCalledWith("Referrer-Policy", "strict-origin-when-cross-origin");
      expect(next).toHaveBeenCalled();
    });
  });

  describe("Safe API errors", () => {
    test("does not expose stack traces or internal details for server failures", () => {
      const res = mockRes();
      const errorLog = jest.spyOn(console, "error").mockImplementation(() => undefined);
      const err = Object.assign(new Error("database host private.internal failed"), {
        detail: "mongodb://user:password@private.internal/certus",
      }) as AppError;

      errorHandler(err, {} as Request, res as unknown as Response, jest.fn());

      expect(res.statusCode).toBe(500);
      expect(res.data.error).toBe("The service could not complete this request. Please retry.");
      expect(res.data).not.toHaveProperty("detail");
      expect(JSON.stringify(res.data)).not.toContain("private.internal");
      errorLog.mockRestore();
    });
  });

  describe("Cross-Session Data Isolation (IDOR Protection)", () => {
    test("Session A cannot read Session B's document", async () => {
      const sessionAId = new mongoose.Types.ObjectId();
      const sessionBId = new mongoose.Types.ObjectId();

      const docB = await LegalDocument.create({
        sessionId: sessionBId,
        filename: "confidential_deal.pdf",
        mimeType: "application/pdf",
        ocrText: "Top secret acquisition terms.",
      });

      const req = { params: { id: docB._id.toString() }, sessionId: sessionAId.toString() } as unknown as DemoSessionRequest;
      const res = mockRes();

      await getDocument(req, res as unknown as Response);

      expect(res.statusCode).toBe(404);
      expect(res.data.error).toMatch(/Document not found/i);
    });

    test("Session A cannot read Session B's chat history", async () => {
      const sessionAId = new mongoose.Types.ObjectId();
      const sessionBId = new mongoose.Types.ObjectId();

      const docB = await LegalDocument.create({
        sessionId: sessionBId,
        filename: "confidential_chat.pdf",
        mimeType: "application/pdf",
      });

      await ChatSession.create({
        documentId: docB._id,
        messages: [{ role: "user", text: "What is the secret valuation?" }],
      });

      const req = { params: { documentId: docB._id.toString() }, sessionId: sessionAId.toString() } as unknown as DemoSessionRequest;
      const res = mockRes();

      await getChatHistory(req, res as unknown as Response);

      expect(res.statusCode).toBe(404);
      expect(res.data.error).toMatch(/Document not found/i);
    });

    test("Session A cannot run what-if analysis on Session B's document", async () => {
      const sessionAId = new mongoose.Types.ObjectId();
      const sessionBId = new mongoose.Types.ObjectId();

      const docB = await LegalDocument.create({
        sessionId: sessionBId,
        filename: "exclusive_contract.pdf",
        mimeType: "application/pdf",
      });

      const req = {
        params: { id: docB._id.toString() },
        body: { scenarioPrompt: "What if there is a breach?" },
        sessionId: sessionAId.toString(),
      } as unknown as DemoSessionRequest;
      const res = mockRes();

      await whatIf(req, res as unknown as Response);

      expect(res.statusCode).toBe(404);
    });
  });
});
