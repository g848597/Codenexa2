/**
 * Account / workspace scoping.
 *
 * window.storage's `shared` flag only has two states: visible to nobody-else
 * (personal) or visible to every user of this artifact (shared). Setting
 * `shared: false` on CRM/Projects data (see clientsStorage.js /
 * projectsStorage.js) is the fix for the data-leak described in the upgrade
 * brief — it stops one business's clients from being readable by anyone
 * else who opens the app.
 *
 * On top of that we add an explicit workspace id and prefix every storage
 * key with it. This does two things even within "personal" scope:
 *   1. It future-proofs the app for a real multi-tenant backend: swapping
 *      `getWorkspaceId()` for "the company id returned by our auth/API"
 *      is the only change needed anywhere in the codebase.
 *   2. If this app is ever embedded somewhere that shares one underlying
 *      storage identity across multiple businesses (e.g. a shared device,
 *      or a future non-Telegram host), records still can't collide or
 *      bleed into each other because the key itself is namespaced.
 *
 * In the Telegram Mini App context we prefer the Telegram user id (stable,
 * unique per person opening the bot) over a randomly generated id, so the
 * same person always lands on the same workspace across sessions/devices.
 */
import { safeGet, safeSet } from "./storageClient";

const WORKSPACE_ID_KEY = "cnb:workspace-id";
let cachedWorkspaceId = null;
let inflight = null;

function fromTelegram() {
  try {
    const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : null;
    const user = tg?.initDataUnsafe?.user;
    if (user?.id) return `tg_${user.id}`;
  } catch {
    /* Telegram SDK not present — fall through to generated id */
  }
  return null;
}

function generateWorkspaceId() {
  const rand = Math.random().toString(36).slice(2, 10);
  return `ws_${Date.now().toString(36)}_${rand}`;
}

/**
 * Resolve (and persist) the workspace id for this account. Safe to call
 * many times — subsequent calls return the cached/persisted value.
 */
export async function getWorkspaceId() {
  if (cachedWorkspaceId) return cachedWorkspaceId;
  if (inflight) return inflight;

  inflight = (async () => {
    const fromTg = fromTelegram();
    if (fromTg) {
      cachedWorkspaceId = fromTg;
      return fromTg;
    }
    // Personal (shared: false) — this record can never be read by another account.
    const existing = await safeGet(WORKSPACE_ID_KEY, false);
    if (existing) {
      cachedWorkspaceId = existing;
      return existing;
    }
    const id = generateWorkspaceId();
    await safeSet(WORKSPACE_ID_KEY, id, false);
    cachedWorkspaceId = id;
    return id;
  })();

  const result = await inflight;
  inflight = null;
  return result;
}

/** Namespace a logical key with the current workspace id. */
export async function scopedKey(key) {
  const ws = await getWorkspaceId();
  return `${ws}:${key}`;
}
