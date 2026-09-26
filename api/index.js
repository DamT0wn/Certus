// Vercel entry point: importing the app must not open a listening socket or
// start MongoMemoryServer. Production requires a persistent MongoDB connection.
const { app } = require("../server/dist/app");
const mongoose = require("../server/node_modules/mongoose");

let connection;

module.exports = async function handler(req, res) {
  const missing = ["MONGODB_URI", "JWT_SECRET"].filter(
    (key) => !process.env[key] || /<|replace_with|your-|dev_secret/.test(process.env[key])
  );
  const path = (req.url || "").split("?")[0];
  if (missing.length) {
    return res.status(503).json({
      error: `Server setup incomplete: configure ${missing.join(", ")} in Vercel production environment variables.`,
      code: "SERVER_NOT_CONFIGURED",
    });
  }

  try {
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
    return app(req, res);
  } catch {
    return res.status(503).json({
      error: "Database unavailable. Check the production MongoDB connection and network access settings.",
      code: "DATABASE_UNAVAILABLE",
    });
  }
};
