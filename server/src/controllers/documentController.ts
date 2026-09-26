import { Response } from "express";
import { Types } from "mongoose";
import { DemoSessionRequest } from "../middleware/demoSession";
import { LegalDocument, ExtractedFact, ChatSession, ScenarioRun } from "../models";
import { runOcr } from "../services/documentAiService";
import { extractFactsFromDocument, runWhatIfScenario } from "../services/geminiService";
import { chunkAndEmbedDocument } from "../services/vectorSearchService";
import { validateUploadedPdf, sanitizeFilename } from "../middleware/security";
import { verifyDocumentPages, evidenceHash } from "../services/documentEvidence";
import { externalFailure } from "../services/externalServiceError";
import { recordAnalysisAudit } from "../services/auditService";

export async function uploadDocument(req: DemoSessionRequest, res: Response) {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  if (req.file.mimetype !== "application/pdf") {
    return res.status(400).json({ error: "Unsupported file type: Only PDF documents are accepted.", code: "INVALID_FILE_TYPE" });
  }

  // Validate both the declared MIME type and PDF magic bytes (FR-1.6).
  const validation = validateUploadedPdf(req.file.buffer);
  if (!validation.valid) {
    return res.status(400).json({
      error: validation.error,
      code: validation.isEncrypted ? "ENCRYPTED_PDF_REJECTED" : "INVALID_FILE_TYPE",
    });
  }

  const safeFilename = sanitizeFilename(req.file.originalname);

  const doc = await LegalDocument.create({
    sessionId: req.sessionId,
    filename: safeFilename,
    mimeType: req.file.mimetype || "application/pdf",
    status: "ocr_processing",
    mode: process.env.MOCK_MODE === "true" ? "mock" : "live",
  });

  try {
    const ocrResult = await runOcr(req.file.buffer, req.file.mimetype);
    doc.ocrText = ocrResult.fullText;
    doc.ocrPages = ocrResult.pages;
    doc.status = "ocr_done";
    await doc.save();

    await chunkAndEmbedDocument(doc._id as Types.ObjectId, ocrResult.pages);

    return res.status(201).json({
      documentId: doc._id,
      status: doc.status,
      filename: doc.filename,
      pageCount: ocrResult.pages.length,
    });
  } catch (err) {
    doc.status = "failed";
    await doc.save();
    const failure = externalFailure(err, "Document OCR");
    return res.status(failure.status).json({ error: failure.message, code: failure.code });
  }
}

export async function extractDocument(req: DemoSessionRequest, res: Response) {
  const { id } = req.params;
  if (!Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid document ID format" });
  }

  const doc = await LegalDocument.findOne({ _id: id, sessionId: req.sessionId });
  if (!doc) return res.status(404).json({ error: "Document not found" });

  doc.status = "extracting";
  await doc.save();

  try {
    const pagedText = doc.ocrPages.map(p => `[Page ${p.pageNumber}]\n${p.text}`).join("\n\n");
    const verifiedClaims = verifyDocumentPages(await extractFactsFromDocument(pagedText), doc.ocrPages);

    // Clean existing facts if re-extracting to avoid duplicates
    await ExtractedFact.deleteMany({ documentId: doc._id });

    const saved = await ExtractedFact.insertMany(
      verifiedClaims.map((c) => ({
        documentId: doc._id,
        text: c.text,
        label: c.label,
        sourcePage: c.sourcePage || null,
        sourceText: c.sourceText || null,
        verification: c.verification,
      }))
    );

    await recordAnalysisAudit({
      documentId: doc._id as Types.ObjectId,
      sessionId: req.sessionId,
      action: "extract",
      prompt: pagedText,
      response: verifiedClaims,
      claimCount: verifiedClaims.length,
      unverifiedCount: verifiedClaims.filter((claim) => claim.label === "UNVERIFIED").length,
    });

    doc.status = "ready";
    await doc.save();

    return res.json({ facts: saved, count: saved.length });
  } catch (err) {
    doc.status = "failed";
    await doc.save();
    const failure = externalFailure(err, "Claim extraction");
    return res.status(failure.status).json({ error: failure.message, code: failure.code });
  }
}

export async function getDocument(req: DemoSessionRequest, res: Response) {
  const { id } = req.params;
  if (!Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid document ID format" });
  }

  const doc = await LegalDocument.findOne({ _id: id, sessionId: req.sessionId }).lean();
  if (!doc) return res.status(404).json({ error: "Document not found" });

  const facts = await ExtractedFact.find({ documentId: doc._id }).lean();
  return res.json({ document: doc, facts: facts.map(f => f.label === "VERIFIED_LAW" ? {
    ...f, label: "UNVERIFIED", verification: { verified: false, confidence: 0, reason: "External legal authority has not been independently verified" },
  } : f) });
}

export async function whatIf(req: DemoSessionRequest, res: Response) {
  const { id } = req.params;
  if (!Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid document ID format" });
  }

  const { scenarioPrompt } = req.body;
  if (!scenarioPrompt || typeof scenarioPrompt !== "string" || !scenarioPrompt.trim()) {
    return res.status(400).json({ error: "Valid scenarioPrompt is required" });
  }

  const doc = await LegalDocument.findOne({ _id: id, sessionId: req.sessionId });
  if (!doc) return res.status(404).json({ error: "Document not found" });

  try {
    const pagedText = doc.ocrPages.map(p => `[Page ${p.pageNumber}]\n${p.text}`).join("\n\n");
    const claims = verifyDocumentPages(await runWhatIfScenario(scenarioPrompt.trim(), pagedText), doc.ocrPages);
    await ScenarioRun.create({
      documentId: doc._id,
      prompt: scenarioPrompt.trim(),
      claims: claims.map((claim) => ({
        text: claim.text,
        label: claim.label,
        sourcePage: claim.sourcePage || null,
        sourceText: claim.sourceText || null,
      })),
    });
    await recordAnalysisAudit({
      documentId: doc._id as Types.ObjectId,
      sessionId: req.sessionId,
      action: "whatif",
      prompt: scenarioPrompt.trim(),
      response: claims,
      claimCount: claims.length,
      unverifiedCount: claims.filter((claim) => claim.label === "UNVERIFIED").length,
    });
    return res.json({ claims });
  } catch (err) {
    const failure = externalFailure(err, "Scenario analysis");
    return res.status(failure.status).json({ error: failure.message, code: failure.code });
  }
}

export async function getBrief(req: DemoSessionRequest, res: Response) {
  const { id } = req.params;
  if (!Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid document ID format" });
  }

  const doc = await LegalDocument.findOne({ _id: id, sessionId: req.sessionId }).lean();
  if (!doc) return res.status(404).json({ error: "Document not found" });

  const [facts, chat, scenarioRuns] = await Promise.all([
    ExtractedFact.find({ documentId: doc._id }).lean(),
    ChatSession.findOne({ documentId: doc._id }).lean(),
    ScenarioRun.find({ documentId: doc._id }).sort({ createdAt: 1 }).lean(),
  ]);

  if (doc.status !== "ready") return res.status(409).json({ error: "Document analysis is not ready. Complete extraction first." });
  const verifiedFacts = facts.filter((f) => f.label === "DOCUMENT_FACT" && f.verification?.verified);
  // No external authority provider is configured. Never bless legacy law claims.
  const applicableLaw: typeof facts = [];
  const flaggedInferences = facts.filter((f) => f.label === "AI_INFERENCE");
  const openQuestions = facts.filter((f) => f.label === "UNVERIFIED" || f.label === "VERIFIED_LAW" || (f.label === "DOCUMENT_FACT" && !f.verification?.verified)).map(f => ({ ...f, label: "UNVERIFIED" }));

  const totalFacts = facts.length;
  const verifiedCount = verifiedFacts.length + applicableLaw.length;
  const verificationRate = totalFacts > 0 ? Math.round((verifiedCount / totalFacts) * 100) : 0;

  const brief = {
    mode: doc.mode || "mock",
    contentHash: evidenceHash(doc.ocrText, [
      ...facts.map(f => ({ text: f.text, label: f.label, sourceText: f.sourceText, sourcePage: f.sourcePage, verification: f.verification })),
      { qaTranscript: chat?.messages || [], scenarioComparisons: scenarioRuns },
    ]),
    documentId: doc._id,
    filename: doc.filename,
    generatedAt: new Date(),
    pageCount: doc.ocrPages?.length || 1,
    stats: {
      totalClaims: totalFacts,
      verifiedCount,
      flaggedCount: flaggedInferences.length + openQuestions.length,
      verificationRate,
    },
    verifiedFacts,
    applicableLaw,
    flaggedInferences,
    openQuestions,
    qaTranscript: chat?.messages || [],
    scenarioComparisons: scenarioRuns,
    disclaimer:
      "This brief was generated by Certus deterministic verification gate. All AI_INFERENCE and UNVERIFIED items require independent legal review.",
  };

  return res.json({ brief });
}
