import { createHash } from "crypto";
import { Types } from "mongoose";
import { AuditLog } from "../models";

type AuditAction = "extract" | "chat" | "whatif";

function digest(value: unknown): string {
  return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
}

export async function recordAnalysisAudit(options: {
  documentId: Types.ObjectId;
  sessionId?: string;
  action: AuditAction;
  prompt: string;
  response: unknown;
  claimCount: number;
  unverifiedCount: number;
}) {
  await AuditLog.create({
    documentId: options.documentId,
    sessionId: options.sessionId && Types.ObjectId.isValid(options.sessionId) ? new Types.ObjectId(options.sessionId) : undefined,
    action: options.action,
    promptHash: digest(options.prompt),
    responseHash: digest(options.response),
    modelVersion: process.env.MOCK_MODE === "true" ? "certus-demo-v1" : process.env.GEMINI_MODEL || "gemini-2.5-flash",
    claimCount: options.claimCount,
    unverifiedCount: options.unverifiedCount,
  });
}
