import mongoose, { Schema, Document as MongoDocument, Types } from "mongoose";

export type ProofLabel =
  | "DOCUMENT_FACT"
  | "VERIFIED_LAW"
  | "AI_INFERENCE"
  | "UNVERIFIED";

export const PROOF_LABELS: ProofLabel[] = [
  "DOCUMENT_FACT",
  "VERIFIED_LAW",
  "AI_INFERENCE",
  "UNVERIFIED",
];

/** ---------- Document ---------- */
export interface ILegalDocument extends MongoDocument {
  mode: "mock" | "live";
  sessionId: Types.ObjectId;
  filename: string;
  mimeType: string;
  ocrText: string;
  ocrPages: { pageNumber: number; text: string }[];
  status: "uploaded" | "ocr_processing" | "ocr_done" | "extracting" | "ready" | "failed";
  uploadedAt: Date;
}

const legalDocumentSchema = new Schema<ILegalDocument>({
  mode: { type: String, enum: ["mock", "live"], default: "mock" },
  sessionId: { type: Schema.Types.ObjectId, required: true },
  filename: { type: String, required: true },
  mimeType: { type: String, required: true },
  ocrText: { type: String, default: "" },
  ocrPages: [
    {
      pageNumber: Number,
      text: String,
    },
  ],
  status: {
    type: String,
    enum: ["uploaded", "ocr_processing", "ocr_done", "extracting", "ready", "failed"],
    default: "uploaded",
  },
  uploadedAt: { type: Date, default: Date.now },
});

legalDocumentSchema.index({ sessionId: 1, uploadedAt: -1 });

export const LegalDocument = mongoose.model<ILegalDocument>(
  "LegalDocument",
  legalDocumentSchema
);

/** ---------- ExtractedFact (Proof Mode claims) ---------- */
export interface IExtractedFact extends MongoDocument {
  documentId: Types.ObjectId;
  text: string;
  label: ProofLabel;
  sourcePage: number | null;
  sourceText: string | null;
  verification: {
    verified: boolean;
    confidence: number;
    reason?: string;
  };
  createdAt: Date;
}

const extractedFactSchema = new Schema<IExtractedFact>({
  documentId: { type: Schema.Types.ObjectId, ref: "LegalDocument", required: true },
  text: { type: String, required: true },
  label: { type: String, enum: PROOF_LABELS, required: true },
  sourcePage: { type: Number, default: null },
  sourceText: { type: String, default: null },
  verification: {
    verified: { type: Boolean, default: false },
    confidence: { type: Number, default: 0 },
    reason: { type: String },
  },
  createdAt: { type: Date, default: Date.now },
});

extractedFactSchema.index({ documentId: 1, label: 1 });

export const ExtractedFact = mongoose.model<IExtractedFact>(
  "ExtractedFact",
  extractedFactSchema
);

/** ---------- Chunk (for RAG / vector search) ---------- */
export interface IChunk extends MongoDocument {
  documentId: Types.ObjectId;
  pageNumber: number;
  text: string;
  embedding: number[];
}

const chunkSchema = new Schema<IChunk>({
  documentId: { type: Schema.Types.ObjectId, ref: "LegalDocument", required: true },
  pageNumber: { type: Number, required: true },
  text: { type: String, required: true },
  embedding: { type: [Number], required: true },
});

chunkSchema.index({ documentId: 1, pageNumber: 1 });

export const Chunk = mongoose.model<IChunk>("Chunk", chunkSchema);

/** ---------- ChatSession ---------- */
export interface IChatMessage {
  role: "user" | "assistant";
  text: string;
  claims?: {
    text: string;
    label: ProofLabel;
    sourcePage: number | null;
    sourceText: string | null;
  }[];
  createdAt: Date;
}

export interface IChatSession extends MongoDocument {
  documentId: Types.ObjectId;
  messages: IChatMessage[];
}

const chatSessionSchema = new Schema<IChatSession>({
  documentId: { type: Schema.Types.ObjectId, ref: "LegalDocument", required: true },
  messages: [
    {
      role: { type: String, enum: ["user", "assistant"] },
      text: String,
      claims: [
        {
          text: String,
          label: { type: String, enum: PROOF_LABELS },
          sourcePage: Number,
          sourceText: String,
        },
      ],
      createdAt: { type: Date, default: Date.now },
    },
  ],
});

chatSessionSchema.index({ documentId: 1 }, { unique: true });

export const ChatSession = mongoose.model<IChatSession>(
  "ChatSession",
  chatSessionSchema
);

/** ---------- ScenarioRun (included in lawyer-ready briefs) ---------- */
export interface IScenarioRun extends MongoDocument {
  documentId: Types.ObjectId;
  prompt: string;
  claims: Array<{
    text: string;
    label: ProofLabel;
    sourcePage: number | null;
    sourceText: string | null;
  }>;
  createdAt: Date;
}

const scenarioRunSchema = new Schema<IScenarioRun>({
  documentId: { type: Schema.Types.ObjectId, ref: "LegalDocument", required: true },
  prompt: { type: String, required: true, maxlength: 2000 },
  claims: [{
    text: String,
    label: { type: String, enum: PROOF_LABELS },
    sourcePage: Number,
    sourceText: String,
  }],
  createdAt: { type: Date, default: Date.now },
});

scenarioRunSchema.index({ documentId: 1, createdAt: -1 });
export const ScenarioRun = mongoose.model<IScenarioRun>("ScenarioRun", scenarioRunSchema);

/** ---------- AuditLog (FR-2.6 & NFR-4) ---------- */
export interface IAuditLog extends MongoDocument {
  documentId: Types.ObjectId;
  sessionId?: Types.ObjectId;
  action: "extract" | "chat" | "whatif";
  promptHash: string;
  responseHash: string;
  modelVersion: string;
  claimCount: number;
  unverifiedCount: number;
  timestamp: Date;
}

const auditLogSchema = new Schema<IAuditLog>({
  documentId: { type: Schema.Types.ObjectId, ref: "LegalDocument", required: true },
  sessionId: { type: Schema.Types.ObjectId },
  action: { type: String, enum: ["extract", "chat", "whatif"], required: true },
  promptHash: { type: String, required: true },
  responseHash: { type: String, required: true },
  modelVersion: { type: String, required: true },
  claimCount: { type: Number, default: 0 },
  unverifiedCount: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now },
});

auditLogSchema.index({ documentId: 1, timestamp: -1 });

export const AuditLog = mongoose.model<IAuditLog>("AuditLog", auditLogSchema);
