import { Response } from "express";
import { Types } from "mongoose";
import { AuthedRequest } from "../middleware/auth";
import { LegalDocument, ExtractedFact } from "../models";
import { runOcr } from "../services/documentAiService";
import { extractFactsFromDocument, runWhatIfScenario } from "../services/geminiService";
import { chunkAndEmbedDocument } from "../services/vectorSearchService";
import { validateUploadedPdf, sanitizeFilename } from "../middleware/security";

export async function uploadDocument(req: AuthedRequest, res: Response) {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  // PDF Validation & Security Check (FR-1.6)
  const validation = validateUploadedPdf(req.file.buffer);
  if (!validation.valid) {
    return res.status(400).json({
      error: validation.error,
      code: validation.isEncrypted ? "ENCRYPTED_PDF_REJECTED" : "INVALID_FILE_TYPE",
    });
  }

  const safeFilename = sanitizeFilename(req.file.originalname);

  const doc = await LegalDocument.create({
    ownerId: req.userId,
    filename: safeFilename,
    mimeType: req.file.mimetype || "application/pdf",
    status: "ocr_processing",
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
    return res.status(502).json({ error: "OCR processing failed", detail: (err as Error).message });
  }
}

export async function extractDocument(req: AuthedRequest, res: Response) {
  const { id } = req.params;
  if (!Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid document ID format" });
  }

  const doc = await LegalDocument.findOne({ _id: id, ownerId: req.userId });
  if (!doc) return res.status(404).json({ error: "Document not found" });

  doc.status = "extracting";
  await doc.save();

  try {
    const verifiedClaims = await extractFactsFromDocument(doc.ocrText);

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

    doc.status = "ready";
    await doc.save();

    return res.json({ facts: saved, count: saved.length });
  } catch (err) {
    doc.status = "failed";
    await doc.save();
    return res.status(502).json({ error: "Extraction failed", detail: (err as Error).message });
  }
}

export async function getDocument(req: AuthedRequest, res: Response) {
  const { id } = req.params;
  if (!Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid document ID format" });
  }

  const doc = await LegalDocument.findOne({ _id: id, ownerId: req.userId }).lean();
  if (!doc) return res.status(404).json({ error: "Document not found" });

  const facts = await ExtractedFact.find({ documentId: doc._id }).lean();
  return res.json({ document: doc, facts });
}

export async function whatIf(req: AuthedRequest, res: Response) {
  const { id } = req.params;
  if (!Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid document ID format" });
  }

  const { scenarioPrompt } = req.body;
  if (!scenarioPrompt || typeof scenarioPrompt !== "string" || !scenarioPrompt.trim()) {
    return res.status(400).json({ error: "Valid scenarioPrompt is required" });
  }

  const doc = await LegalDocument.findOne({ _id: id, ownerId: req.userId });
  if (!doc) return res.status(404).json({ error: "Document not found" });

  try {
    const claims = await runWhatIfScenario(scenarioPrompt.trim(), doc.ocrText);
    return res.json({ claims });
  } catch (err) {
    return res.status(502).json({ error: "What-if analysis failed", detail: (err as Error).message });
  }
}

export async function getBrief(req: AuthedRequest, res: Response) {
  const { id } = req.params;
  if (!Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid document ID format" });
  }

  const doc = await LegalDocument.findOne({ _id: id, ownerId: req.userId }).lean();
  if (!doc) return res.status(404).json({ error: "Document not found" });

  const facts = await ExtractedFact.find({ documentId: doc._id }).lean();

  const verifiedFacts = facts.filter((f) => f.label === "DOCUMENT_FACT");
  const applicableLaw = facts.filter((f) => f.label === "VERIFIED_LAW");
  const flaggedInferences = facts.filter((f) => f.label === "AI_INFERENCE");
  const openQuestions = facts.filter((f) => f.label === "UNVERIFIED");

  const totalFacts = facts.length;
  const verifiedCount = verifiedFacts.length + applicableLaw.length;
  const verificationRate = totalFacts > 0 ? Math.round((verifiedCount / totalFacts) * 100) : 100;

  const brief = {
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
    disclaimer:
      "This brief was generated by Certus deterministic verification gate. All AI_INFERENCE and UNVERIFIED items require independent legal review.",
  };

  return res.json({ brief });
}

