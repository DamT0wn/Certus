import "./config";
import mongoose from "mongoose";
import { app } from "./app";
export { app } from "./app";

const PORT = process.env.PORT || 5000;



async function start() {
  let mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/certus";
  const isPlaceholderUri =
    mongoUri.includes("<cluster>") ||
    mongoUri.includes("<user>") ||
    mongoUri.includes("<password>");

  if (process.env.MOCK_MODE !== "true") {
    const required = ["MONGODB_URI", "GCP_PROJECT_ID", "DOCAI_PROCESSOR_ID", "GOOGLE_APPLICATION_CREDENTIALS", "GEMINI_API_KEY", "GEMINI_MODEL", "EMBEDDING_MODEL"];
    const missing = required.filter(key => !process.env[key] || /your-|<|replace_with|dev_secret/.test(process.env[key]!));
    if (missing.length) throw new Error(`Live configuration required: ${missing.join(", ")}`);
  }

  if (isPlaceholderUri && process.env.MOCK_MODE === "true") {
    // MOCK MODE — replace with real MongoDB Atlas URI in .env when Atlas is configured
    console.info("[certus] MOCK MODE: Placeholder MONGODB_URI detected. Starting in-memory MongoDB...");
    try {
      const { MongoMemoryServer } = await import("mongodb-memory-server");
      const mongod = await MongoMemoryServer.create();
      mongoUri = mongod.getUri();
      console.info(`[certus] in-memory MongoDB ready at ${mongoUri}`);
    } catch (memErr) {
      console.error("[certus] Failed to start MongoMemoryServer:", (memErr as Error).message);
    }
  }

  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 3000 });
    console.info(`[certus] connected to MongoDB (${mongoUri.startsWith("mongodb://127.0.0.1") ? "in-memory" : "external"})`);
  } catch (err) {
    console.error("[certus] MongoDB connection failed:", (err as Error).message);
    if (process.env.MOCK_MODE === "true") {
      console.info("[certus] MOCK MODE: Attempting fallback to in-memory MongoDB...");
      try {
        const { MongoMemoryServer } = await import("mongodb-memory-server");
        const mongod = await MongoMemoryServer.create();
        mongoUri = mongod.getUri();
        await mongoose.connect(mongoUri);
        console.info(`[certus] in-memory MongoDB fallback connected at ${mongoUri}`);
      } catch (fallbackErr) {
        console.error("[certus] In-memory MongoDB fallback failed:", (fallbackErr as Error).message);
      }
    } else {
      throw new Error("Database connection failed; server did not start");
    }
  }

  app.listen(PORT, () => {
    console.info(`[certus] server listening on port ${PORT}`);
    if (process.env.MOCK_MODE === "true") {
      console.info("[certus] DEMO MODE: Real PDF text parsing; simulated AI and retrieval.");
    }
  });
}

start().catch(err => { console.error((err as Error).message); process.exitCode = 1; });
