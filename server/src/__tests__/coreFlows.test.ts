import type { Response } from "express";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import type { DemoSessionRequest } from "../middleware/demoSession";
import { uploadDocument, extractDocument, getBrief, whatIf } from "../controllers/documentController";
import { askQuestion } from "../controllers/chatController";
import { AuditLog, ChatSession, Chunk, ExtractedFact, LegalDocument, ScenarioRun } from "../models";

const CONTRACT_TEXT = "Cedar Studio shall pay a fixed fee of $7,500. Either party may terminate with 30 days written notice. This agreement is governed by the laws of California.";

jest.mock("../services/documentAiService", () => ({
  runOcr: jest.fn(async () => ({ fullText: CONTRACT_TEXT, pages: [{ pageNumber: 1, text: CONTRACT_TEXT }] })),
}));

jest.mock("../services/vectorSearchService", () => ({
  chunkAndEmbedDocument: jest.fn(async () => 1),
  retrieveRelevantChunks: jest.fn(async () => [{ pageNumber: 1, text: CONTRACT_TEXT }]),
}));

process.env.MOCK_MODE = "true";

interface MockResponse {
  statusCode: number;
  data: Record<string, unknown>;
  status: jest.Mock;
  json: jest.Mock;
}

function mockRes(): MockResponse {
  const res: MockResponse = { statusCode: 200, data: {}, status: jest.fn(), json: jest.fn() };
  res.status.mockImplementation((code: number) => { res.statusCode = code; return res; });
  res.json.mockImplementation((data: Record<string, unknown>) => { res.data = data; return res; });
  return res;
}

describe("core legal-document workflow", () => {
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
    await Promise.all([
      AuditLog.deleteMany({}),
      ChatSession.deleteMany({}),
      Chunk.deleteMany({}),
      ExtractedFact.deleteMany({}),
      ScenarioRun.deleteMany({}),
      LegalDocument.deleteMany({}),
    ]);
  });

  test("uploads, extracts, verifies Q&A, records a scenario, and generates an auditable brief", async () => {
    const sessionId = new mongoose.Types.ObjectId().toString();
    const pdf = Buffer.from("%PDF-1.4\nmock controller-flow fixture\n%%EOF");
    const uploadReq = {
      sessionId,
      file: { buffer: pdf, originalname: "../sample contract.pdf", mimetype: "application/pdf" },
    } as unknown as DemoSessionRequest;
    const uploadRes = mockRes();

    await uploadDocument(uploadReq, uploadRes as unknown as Response);
    expect(uploadRes.statusCode).toBe(201);
    expect(uploadRes.data.filename).toBe("_sample_contract.pdf");
    const documentId = String(uploadRes.data.documentId);

    const extractRes = mockRes();
    await extractDocument({ sessionId, params: { id: documentId } } as unknown as DemoSessionRequest, extractRes as unknown as Response);
    expect(extractRes.statusCode).toBe(200);
    expect(extractRes.data.count).toEqual(expect.any(Number));
    expect(Number(extractRes.data.count)).toBeGreaterThan(0);

    const chatRes = mockRes();
    await askQuestion({ sessionId, body: { documentId, question: "What is the fee?" } } as DemoSessionRequest, chatRes as unknown as Response);
    expect(chatRes.statusCode).toBe(200);
    expect(chatRes.data.claims).toEqual(expect.arrayContaining([expect.objectContaining({ sourcePage: expect.any(Number) })]));

    const scenarioRes = mockRes();
    await whatIf({
      sessionId,
      params: { id: documentId },
      body: { scenarioPrompt: "Re-run extraction for early termination, focusing on termination rights and notice requirements." },
    } as unknown as DemoSessionRequest, scenarioRes as unknown as Response);
    expect(scenarioRes.statusCode).toBe(200);

    const briefRes = mockRes();
    await getBrief({ sessionId, params: { id: documentId } } as unknown as DemoSessionRequest, briefRes as unknown as Response);
    const brief = briefRes.data.brief as {
      contentHash: string;
      qaTranscript: unknown[];
      scenarioComparisons: unknown[];
      stats: { totalClaims: number };
    };
    expect(brief.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(brief.stats.totalClaims).toBeGreaterThan(0);
    expect(brief.qaTranscript).toHaveLength(2);
    expect(brief.scenarioComparisons).toHaveLength(1);
    expect(await AuditLog.countDocuments({ documentId })).toBe(3);
  }, 30_000);
});
