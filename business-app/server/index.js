/**
 * Reference backend proxy for the AI Director.
 *
 * This is the fix for "never call the Anthropic API directly from the
 * browser in production" — the API key lives only here, as an environment
 * variable on the server, and the frontend (src/services/aiDirectorClient.js)
 * only ever talks to this same-origin endpoint.
 *
 * Run:
 *   cd server
 *   cp .env.example .env   # then fill in ANTHROPIC_API_KEY
 *   npm install
 *   npm start
 *
 * In dev, point Vite at it with a proxy (see vite.config.js `server.proxy`).
 * In production, deploy this behind the same domain/reverse-proxy as the
 * built frontend so `/api/ai-director` resolves without CORS.
 */
import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 8787;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Extremely small in-memory rate limiter per IP, so one client can't burn
// through the API budget. Swap for a real store (Redis) in production.
const requestLog = new Map();
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 20;

function rateLimited(ip) {
  const now = Date.now();
  const entries = (requestLog.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  entries.push(now);
  requestLog.set(ip, entries);
  return entries.length > MAX_REQUESTS_PER_WINDOW;
}

app.post("/api/ai-director", async (req, res) => {
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY is not configured on the server." });
  }

  const ip = req.ip || req.socket?.remoteAddress || "unknown";
  if (rateLimited(ip)) {
    return res.status(429).json({ error: "Слишком много запросов. Попробуйте через минуту." });
  }

  const { messages, businessContext } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "`messages` must be a non-empty array." });
  }
  if (typeof businessContext !== "string" || !businessContext.trim()) {
    return res.status(400).json({ error: "`businessContext` must be a non-empty string." });
  }

  // Basic shape validation — never forward arbitrary/unbounded input to the
  // model API without checking it first.
  const cleanMessages = messages
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }));

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1000,
        system: businessContext.slice(0, 20000),
        messages: cleanMessages,
      }),
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      console.error("Anthropic API error", upstream.status, text);
      return res.status(502).json({ error: "AI provider error." });
    }

    const data = await upstream.json();
    const reply = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n\n");

    return res.json({ reply: reply || "Не удалось получить ответ. Попробуйте переформулировать запрос." });
  } catch (err) {
    console.error("AI proxy failed", err);
    return res.status(500).json({ error: "Internal proxy error." });
  }
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`AI Director proxy listening on :${PORT}`);
});
