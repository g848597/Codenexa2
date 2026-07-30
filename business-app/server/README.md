# CodeNexa AI Director proxy

This is the backend the AI Director screen talks to. It exists for one
reason: **the Anthropic API key must never ship inside browser JavaScript.**
Anyone can open devtools and read a key embedded in a frontend bundle; this
server keeps the key out of the client entirely.

## Run locally

```bash
cd server
cp .env.example .env   # fill in ANTHROPIC_API_KEY
npm install
npm start               # listens on :8787
```

Then run the frontend as usual (`npm run dev` from the project root) —
`vite.config.js` proxies `/api/*` to `localhost:8787` in dev.

## Deploying

Deploy this service (or port its single route into whatever backend
framework your stack already uses) behind the same domain/reverse-proxy as
the built frontend, so `/api/ai-director` resolves same-origin with no CORS
configuration needed in production. Set `ANTHROPIC_API_KEY` as a real
secret in your hosting platform — never commit it.

## What it does

`POST /api/ai-director` accepts `{ messages, businessContext }`, validates
and trims that payload, forwards it to `https://api.anthropic.com/v1/messages`
with the server-side key, and returns `{ reply: string }`. It also applies
a minimal per-IP rate limit — replace the in-memory `Map` with Redis (or
your platform's rate limiter) before relying on this in production.
