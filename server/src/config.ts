import dotenv from "dotenv";
// Explicit deployment environment takes precedence over either local file.
dotenv.config({ path: ".env.local" });
dotenv.config();
