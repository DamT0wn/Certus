import dotenv from "dotenv";
// Explicit deployment environment takes precedence over either local file.
dotenv.config({ path: ".env.local" });
dotenv.config();

export function sessionSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error("JWT_SECRET must contain at least 32 characters");
  return secret;
}
