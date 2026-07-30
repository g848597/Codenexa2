/**
 * Frontend-side client for the AI Director. This never talks to
 * api.anthropic.com directly — the Anthropic API key must only ever live
 * on a server. Instead it POSTs to a same-origin backend proxy which holds
 * the key and forwards the request. See /server for the reference Node
 * implementation of that proxy — in this deployment the equivalent lives
 * in the main CodeNexa FastAPI backend (see app/web/api/ai_director.py),
 * so this app doesn't need its own backend process.
 *
 * That endpoint requires the same auth as the rest of CodeNexa. Since this
 * app is served from the same origin as the main webapp (just a different
 * path, /business-app/ — see webapp/src/components/businessApp.js), it can
 * read the already-issued session token straight out of localStorage
 * instead of asking the person to log in a second time.
 */
const AI_PROXY_ENDPOINT = "/api/ai-director";
const CODENEXA_TOKEN_KEY = "codenexa_auth_token_v1"; // must match webapp/src/api/authApi.js

function getCodenexaToken() {
  try {
    return localStorage.getItem(CODENEXA_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function sendToAIDirector({ messages, businessContext, signal }) {
  const token = getCodenexaToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(AI_PROXY_ENDPOINT, {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify({ messages, businessContext }),
  });

  if (!response.ok) {
    let detail = "";
    try {
      const errBody = await response.json();
      detail = errBody?.detail || errBody?.error || "";
    } catch { /* body wasn't JSON — leave detail empty */ }
    if (response.status === 401) {
      throw new Error("Сессия истекла — откройте AI Business заново из CodeNexa.");
    }
    throw new Error(`AI proxy вернул статус ${response.status}${detail ? `: ${detail}` : ""}`);
  }

  const data = await response.json();
  if (!data.reply) throw new Error("Пустой ответ от AI Director.");
  return data.reply;
}
