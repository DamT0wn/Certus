import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { router } from "./routes";

import { securityHeaders } from "./middleware/security";
import { errorHandler } from "./middleware/errorHandler";

export const app = express();
app.use(securityHeaders);
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use("/api", router);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/certus";

async function start() {
  let mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/certus";
  const isPlaceholderUri =
    mongoUri.includes("<cluster>") ||
    mongoUri.includes("<user>") ||
    mongoUri.includes("<password>");

  if (isPlaceholderUri) {
    // MOCK MODE — replace with real MongoDB Atlas URI in .env when Atlas is configured
    console.log("[certus] MOCK MODE: Placeholder MONGODB_URI detected. Starting in-memory MongoDB...");
    try {
      const { MongoMemoryServer } = await import("mongodb-memory-server");
      const mongod = await MongoMemoryServer.create();
      mongoUri = mongod.getUri();
      console.log(`[certus] in-memory MongoDB ready at ${mongoUri}`);
    } catch (memErr) {
      console.error("[certus] Failed to start MongoMemoryServer:", (memErr as Error).message);
    }
  }

  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 3000 });
    console.log(`[certus] connected to MongoDB (${mongoUri.startsWith("mongodb://127.0.0.1") ? "in-memory" : "external"})`);
  } catch (err) {
    console.error("[certus] MongoDB connection failed:", (err as Error).message);
    if (process.env.MOCK_MODE === "true") {
      console.log("[certus] MOCK MODE: Attempting fallback to in-memory MongoDB...");
      try {
        const { MongoMemoryServer } = await import("mongodb-memory-server");
        const mongod = await MongoMemoryServer.create();
        mongoUri = mongod.getUri();
        await mongoose.connect(mongoUri);
        console.log(`[certus] in-memory MongoDB fallback connected at ${mongoUri}`);
      } catch (fallbackErr) {
        console.error("[certus] In-memory MongoDB fallback failed:", (fallbackErr as Error).message);
      }
    } else {
      console.error(
        "[certus] server will still start, but DB-backed routes will fail until MONGODB_URI is set correctly"
      );
    }
  }

  app.listen(PORT, () => {
    console.log(`[certus] server listening on port ${PORT}`);
    if (process.env.MOCK_MODE === "true") {
      console.log("[certus] MOCK_MODE is ENABLED: Document AI, Gemini, and Atlas Vector Search are mocked.");
    }
  });
}

start();
