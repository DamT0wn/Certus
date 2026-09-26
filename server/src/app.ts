import "./config";
import express from "express";
import cors from "cors";
import { router } from "./routes";
import { securityHeaders } from "./middleware/security";
import { errorHandler } from "./middleware/errorHandler";

export const app = express();
app.use(securityHeaders);
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use("/api", router);
app.use(errorHandler);
