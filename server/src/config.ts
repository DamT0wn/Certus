import dotenv from "dotenv";
// Explicit deployment environment takes precedence over either local file.
dotenv.config({ path: ".env.local" });
dotenv.config();

export function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is required");
  return secret;
}
