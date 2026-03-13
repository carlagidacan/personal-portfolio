import app, { ensureStartup } from "../server.js";

export default async function handler(req, res) {
  await ensureStartup();
  return app(req, res);
}
