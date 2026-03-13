import app, { ensureStartup } from "../server.js";

export default async function handler(req, res) {
  try {
    await ensureStartup();
    return app(req, res);
  } catch (error) {
    return res.status(500).json({
      error: "Startup failed",
      details: error?.message || String(error),
    });
  }
}
