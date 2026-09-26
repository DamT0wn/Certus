import { Router, RequestHandler } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth";
import { authLimiter, computeLimiter } from "../middleware/security";
import { register, login } from "../controllers/authController";
import {
  uploadDocument,
  extractDocument,
  getDocument,
  whatIf,
  getBrief,
} from "../controllers/documentController";
import { askQuestion, getChatHistory } from "../controllers/chatController";
import { LegalDocument } from "../models";
import { Types } from "mongoose";
import { searchCaseLaw } from "../services/courtListenerService";

// Max 50 MB upload limit per FR-1.1
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

export const router = Router();
const safe = (handler: RequestHandler): RequestHandler => (req, res, next) => {
  Promise.resolve().then(() => handler(req, res, next)).catch(next);
};

router.get("/health", (_req, res) => res.json({ status: "ok", mode: process.env.MOCK_MODE === "true" ? "mock" : "live", timestamp: new Date().toISOString() }));

// Auth (with brute-force rate limiter)
router.post("/auth/register", authLimiter, safe(register));
router.post("/auth/login", authLimiter, safe(login));

// Explicit user-entered research terms only; no contract is sent to this provider.
router.get("/research/cases", requireAuth, computeLimiter, safe(async (req, res) => {
  if (typeof req.query.q !== "string") return res.status(400).json({ error: "A case-law search query is required." });
  res.setHeader("Cache-Control", "no-store");
  return res.json(await searchCaseLaw(req.query.q));
}));

// Documents
router.post("/documents/upload", requireAuth, computeLimiter, upload.single("file"), safe(uploadDocument));
router.post("/documents/:id/extract", requireAuth, computeLimiter, safe(extractDocument));
router.get("/documents/:id", requireAuth, safe(getDocument));
router.get("/documents/:id/status", requireAuth, safe(async (req: any, res) => {
  const { id } = req.params;
  if (!Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid document ID" });
  const doc = await LegalDocument.findOne({ _id: id, ownerId: req.userId }, "status filename uploadedAt").lean();
  if (!doc) return res.status(404).json({ error: "Document not found" });
  return res.json({ status: doc.status, filename: doc.filename, uploadedAt: doc.uploadedAt });
}));
router.post("/documents/:id/whatif", requireAuth, computeLimiter, safe(whatIf));
router.get("/documents/:id/brief", requireAuth, safe(getBrief));

// Chat
router.post("/chat", requireAuth, computeLimiter, safe(askQuestion));
router.get("/chat/:documentId", requireAuth, safe(getChatHistory));
