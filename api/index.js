// Vercel entry point: importing the app must not open a listening socket or
// start MongoMemoryServer. Production requires a persistent MongoDB connection.
let connection;

module.exports = async function handler(req, res) {
  const path = (req.url || "").split("?")[0];
  if (path === "/api" || path === "/api/" || path === "/api/health") {
    return res.status(200).json({ status: "ok", mode: process.env.MOCK_MODE === "true" ? "mock" : "live" });
  }

  const missing = ["MONGODB_URI"].filter(
    (key) => !process.env[key] || /<|replace_with|your-|dev_secret/.test(process.env[key])
  );
  if (missing.length) {
    return res.status(503).json({
      error: "The service is not fully configured. Please contact the administrator.",
      code: "SERVER_NOT_CONFIGURED",
    });
  }

  try {
    const mongoose = require("../server/node_modules/mongoose");
    if (mongoose.connection.readyState !== 1) {
      if (!connection) {
        connection = mongoose.connect(process.env.MONGODB_URI, {
          serverSelectionTimeoutMS: 5000,
          maxPoolSize: 5,
        }).catch((error) => {
          connection = undefined;
          throw error;
        });
      }
      await connection;
    }
  } catch {
    return res.status(503).json({
      error: "The service is temporarily unavailable. Please retry later.",
      code: "DATABASE_UNAVAILABLE",
    });
  }
  try {
    const { app } = require("../server/dist/app");
    return app(req, res);
  } catch {
    return res.status(503).json({
      error: "The service is temporarily unavailable. Please retry later.",
      code: "API_INITIALIZATION_FAILED",
    });
  }
};
