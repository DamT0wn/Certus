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
  const isProd = process.env.NODE_ENV === "production";

  console.error(`[certus error] ${err.name || "Error"}: ${err.message}`, {
    statusCode,
    code: err.code,
    detail: err.detail,
    stack: isProd ? undefined : err.stack,
  });

  return res.status(statusCode).json({
    error: err.code === "LIMIT_FILE_SIZE" ? "PDF exceeds the 50 MB limit" : upstream?.message || (isProd && statusCode >= 500 ? "The service could not complete this request. Please retry." : err.message || "An unexpected error occurred"),
    code: err.code || upstream?.code || "INTERNAL_ERROR",
    detail: err.detail || undefined,
    timestamp: new Date().toISOString(),
  });
}
