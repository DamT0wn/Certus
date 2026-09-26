import { Request, Response, NextFunction } from "express";
import { externalFailure } from "../services/externalServiceError";

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  detail?: string;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  const upstream = !err.statusCode && /google|gemini|document.?ai|vector|fetch|timeout|quota|api.?key/i.test(err.message || "")
    ? externalFailure(err, "AI service")
    : null;
  const statusCode = err.code === "LIMIT_FILE_SIZE" ? 413 : upstream?.status || err.statusCode || 500;
  console.error(`[certus error] ${err.name || "Error"}: ${err.message}`, {
    statusCode,
    code: err.code,
    detail: err.detail,
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });

  return res.status(statusCode).json({
    error: err.code === "LIMIT_FILE_SIZE"
      ? "PDF exceeds the 50 MB limit"
      : upstream?.message || (statusCode >= 500 ? "The service could not complete this request. Please retry." : err.message || "The request could not be completed"),
    code: err.code || upstream?.code || "INTERNAL_ERROR",
    timestamp: new Date().toISOString(),
  });
}
