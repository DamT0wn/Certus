import { randomBytes } from "crypto";
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import { sessionSecret } from "../config";

/**
 * Creates a short-lived, anonymous demo session. This deliberately does not
 * collect credentials or create an account; authentication is out of scope
 * for the MVP. The random session id still isolates each browser's documents.
 */
export function createDemoSession(_req: Request, res: Response) {
  const sessionId = new Types.ObjectId().toString();
  const displayName = `Demo ${randomBytes(2).toString("hex").toUpperCase()}`;
  const token = jwt.sign({ sessionId, purpose: "certus-demo" }, sessionSecret(), {
    audience: "certus-demo",
    issuer: "certus-api",
    expiresIn: "8h",
  });

  res.setHeader("Cache-Control", "no-store");
  return res.status(201).json({ token, displayName, expiresIn: "8h" });
}
