import { Response } from "express";
import { Types } from "mongoose";
import { DemoSessionRequest } from "../middleware/demoSession";
import { LegalDocument, ChatSession } from "../models";
import { retrieveRelevantChunks } from "../services/vectorSearchService";
import { answerQuestionWithCitations } from "../services/geminiService";
import { verifyDocumentPages } from "../services/documentEvidence";
import { recordAnalysisAudit } from "../services/auditService";

export async function askQuestion(req: DemoSessionRequest, res: Response) {
  const { documentId, question } = req.body;
  if (!documentId || !question || typeof question !== "string" || !question.trim()) {
    return res.status(400).json({ error: "documentId and valid question are required" });
  }

  if (!Types.ObjectId.isValid(documentId)) {
    return res.status(400).json({ error: "Invalid document ID format" });
  }

  const doc = await LegalDocument.findOne({ _id: documentId, sessionId: req.sessionId });
  if (!doc) return res.status(404).json({ error: "Document not found" });

  const relevantChunks = await retrieveRelevantChunks(
    doc._id as Types.ObjectId,
    question.trim()
  );

  if (relevantChunks.length === 0) {
    return res.json({
      claims: [
        {
          text: "The document does not contain sufficient evidence to answer this question.",
          label: "UNVERIFIED",
          sourcePage: 0,
          sourceText: "",
          verification: { verified: false, confidence: 0, reason: "INSUFFICIENT_EVIDENCE: no matching chunks retrieved" },
        },
      ],
    });
  }

  const claims = verifyDocumentPages(await answerQuestionWithCitations(question.trim(), relevantChunks, doc.ocrText), doc.ocrPages);

  let session = await ChatSession.findOne({ documentId: doc._id });
  if (!session) session = await ChatSession.create({ documentId: doc._id, messages: [] });

  session.messages.push({ role: "user", text: question.trim(), createdAt: new Date() });
  session.messages.push({
    role: "assistant",
    text: claims.map((c) => c.text).join(" "),
    claims: claims.map((c) => ({
      text: c.text,
      label: c.label,
      sourcePage: c.sourcePage || null,
      sourceText: c.sourceText || null,
    })),
    createdAt: new Date(),
  });
  await session.save();

  await recordAnalysisAudit({
    documentId: doc._id as Types.ObjectId,
    sessionId: req.sessionId,
    action: "chat",
    prompt: question.trim(),
    response: claims,
    claimCount: claims.length,
    unverifiedCount: claims.filter((claim) => claim.label === "UNVERIFIED").length,
  });

  return res.json({ claims });
}

export async function getChatHistory(req: DemoSessionRequest, res: Response) {
  const { documentId } = req.params;
  if (!Types.ObjectId.isValid(documentId)) {
    return res.status(400).json({ error: "Invalid document ID format" });
  }

  // Session isolation prevents one demo browser from reading another session's document.
  const doc = await LegalDocument.findOne({ _id: documentId, sessionId: req.sessionId }).lean();
  if (!doc) {
    return res.status(404).json({ error: "Document not found" });
  }

  const session = await ChatSession.findOne({ documentId: doc._id }).lean();
  return res.json({ messages: session?.messages || [] });
}
