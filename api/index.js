// Vercel entry point: importing the app must not open a listening socket or
// start MongoMemoryServer. Production requires a persistent MongoDB connection.
let connection;

module.exports = async function handler(req, res) {
  const missing = ["MONGODB_URI", "JWT_SECRET"].filter(
    (key) => !process.env[key] || /<|replace_with|your-|dev_secret/.test(process.env[key])
  );
  const path = (req.url || "").split("?")[0];
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
    // Rewrites preserve the original URL; allow the function URL as a health alias.
    if (path === "/api" || path === "/api/") req.url = "/api/health";
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
