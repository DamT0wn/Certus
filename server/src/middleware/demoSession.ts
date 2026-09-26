import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { Types } from "mongoose";
import { sessionSecret } from "../config";

export interface DemoSessionRequest extends Request {
  sessionId?: string;
}

interface DemoTokenPayload extends JwtPayload {
  sessionId: string;
  purpose: "certus-demo";
}

export function requireDemoSession(req: DemoSessionRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Start a mock session to continue", code: "DEMO_SESSION_REQUIRED" });
  }

  try {
    const payload = jwt.verify(header.slice("Bearer ".length), sessionSecret(), {
      audience: "certus-demo",
      issuer: "certus-api",
    }) as DemoTokenPayload;
    if (payload.purpose !== "certus-demo" || !Types.ObjectId.isValid(payload.sessionId)) {
      throw new Error("Invalid demo token payload");
    }
    req.sessionId = payload.sessionId;
    return next();
  } catch {
    return res.status(401).json({ error: "Mock session expired or invalid", code: "DEMO_SESSION_INVALID" });
  }
}
