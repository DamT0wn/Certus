import { Request, Response, NextFunction } from "express";

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
  const statusCode = err.statusCode || 500;
  const isProd = process.env.NODE_ENV === "production";

  console.error(`[certus error] ${err.name || "Error"}: ${err.message}`, {
    statusCode,
    code: err.code,
    detail: err.detail,
    stack: isProd ? undefined : err.stack,
  });

  return res.status(statusCode).json({
    error: err.message || "An unexpected error occurred",
    code: err.code || "INTERNAL_ERROR",
    detail: err.detail || undefined,
    timestamp: new Date().toISOString(),
  });
}
