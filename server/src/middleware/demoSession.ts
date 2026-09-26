import { Request, Response, NextFunction } from "express";

export interface DemoSessionRequest extends Request {
  sessionId?: string;
}

export function requireDemoSession(req: DemoSessionRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Start a mock session to continue", code: "DEMO_SESSION_REQUIRED" });
  }

  const sessionId = header.slice("Bearer ".length);
  if (!/^[a-f0-9]{24}$/.test(sessionId)) {
    return res.status(401).json({ error: "Mock session expired or invalid", code: "DEMO_SESSION_INVALID" });
  }
  req.sessionId = sessionId;
  return next();
}
