import { Request, Response, NextFunction } from "express";

/**
 * Enhanced HTTP Security Headers (equivalent to Helmet)
 * Enforces strict browser-level security policies.
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "0");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Content-Security-Policy", "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  res.setHeader("Cache-Control", "no-store");
  next();
}

/**
 * Lightweight in-memory sliding window rate limiter
 * Protects demo-session and AI endpoints without requiring external Redis dependency.
 */
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export function createRateLimiter(options: { windowMs: number; maxRequests: number; message?: string }) {
  const store = new Map<string, RateLimitEntry>();

  return (req: Request, res: Response, next: NextFunction) => {
    // In test environment, allow bypassing unless explicitly testing rate limits
    if (process.env.NODE_ENV === "test" && req.headers["x-bypass-ratelimit"] === "true") {
      return next();
    }

    const ip = (req.ip || req.socket.remoteAddress || "unknown").toString();
    const key = `${req.path}:${ip}`;
    const now = Date.now();

    const entry = store.get(key);
    if (!entry || now > entry.resetTime) {
      store.set(key, { count: 1, resetTime: now + options.windowMs });
      return next();
    }

    if (entry.count >= options.maxRequests) {
      const retryAfterSeconds = Math.ceil((entry.resetTime - now) / 1000);
      res.setHeader("Retry-After", retryAfterSeconds.toString());
      return res.status(429).json({
        error: options.message || "Too many requests, please try again later",
        code: "RATE_LIMIT_EXCEEDED",
        retryAfter: retryAfterSeconds,
      });
    }

    entry.count += 1;
    next();
  };
}

/**
 * Rate limiters configured for sensitive routes
 */
export const demoSessionLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 30, // 30 requests per 15 mins per IP
  message: "Too many demo sessions were requested. Please try again later.",
});

export const computeLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 20, // 20 expensive requests per minute
  message: "Rate limit exceeded for document processing. Please wait a moment before trying again.",
});

/**
 * PDF Magic Byte & Encryption Validation (FR-1.6)
 */
export function validateUploadedPdf(fileBuffer: Buffer): { valid: boolean; error?: string; isEncrypted?: boolean } {
  if (!fileBuffer || fileBuffer.length < 5) {
    return { valid: false, error: "Empty or truncated file uploaded" };
  }

  // Check magic bytes "%PDF-"
  const header = fileBuffer.slice(0, 5).toString("ascii");
  if (!header.startsWith("%PDF-")) {
    return {
      valid: false,
      error: "Unsupported file type: Only valid PDF documents are accepted.",
    };
  }

  // Check for password protection / encryption in PDF structure
  // PDFs with passwords have an /Encrypt dictionary in the trailer or catalog
  const contentSample = fileBuffer.slice(0, Math.min(fileBuffer.length, 1024 * 1024)).toString("latin1");
  const isEncrypted = /\/Encrypt\s+[0-9]+\s+[0-9]+\s+R/i.test(contentSample) || /\/Encrypt\s*<</i.test(contentSample);

  if (isEncrypted) {
    return {
      valid: false,
      isEncrypted: true,
      error: "Password-protected PDFs cannot be processed. Please remove the password and re-upload.",
    };
  }

  return { valid: true };
}

/**
 * Sanitize filename to prevent directory traversal or header injection
 */
export function sanitizeFilename(rawName: string): string {
  const normalized = rawName.normalize("NFKC").replace(/\0/g, "");
  const safe = normalized.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "").slice(0, 100);
  return safe || "document.pdf";
}
