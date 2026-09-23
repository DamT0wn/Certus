import { Router } from "express";
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

// Max 50 MB upload limit per FR-1.1
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

export const router = Router();

router.get("/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

// Auth (with brute-force rate limiter)
router.post("/auth/register", authLimiter, register);
router.post("/auth/login", authLimiter, login);

// Documents
router.post("/documents/upload", requireAuth, computeLimiter, upload.single("file"), uploadDocument);
router.post("/documents/:id/extract", requireAuth, computeLimiter, extractDocument);
router.get("/documents/:id", requireAuth, getDocument);
router.get("/documents/:id/status", requireAuth, async (req: any, res) => {
  const { id } = req.params;
  if (!Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid document ID" });
  const doc = await LegalDocument.findOne({ _id: id, ownerId: req.userId }, "status filename uploadedAt").lean();
  if (!doc) return res.status(404).json({ error: "Document not found" });
  return res.json({ status: doc.status, filename: doc.filename, uploadedAt: doc.uploadedAt });
});
router.post("/documents/:id/whatif", requireAuth, computeLimiter, whatIf);
router.get("/documents/:id/brief", requireAuth, getBrief);

// Chat
router.post("/chat", requireAuth, computeLimiter, askQuestion);
router.get("/chat/:documentId", requireAuth, getChatHistory);

