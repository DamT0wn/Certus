import "./config";
import express from "express";
import { router } from "./routes";
import { securityHeaders } from "./middleware/security";
import { errorHandler } from "./middleware/errorHandler";

export const app = express();
app.use(securityHeaders);
app.disable("x-powered-by");
app.use(express.json({ limit: "64kb", strict: true }));
app.use("/api", router);
app.use(errorHandler);
