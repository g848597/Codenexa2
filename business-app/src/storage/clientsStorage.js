/**
 * Persistence layer for CRM clients, backed by window.storage with a
 * seed-data fallback so the app still works before storage is ready
 * or when it is unavailable.
 *
 * SECURITY: every call below uses `shared: false`. This data is scoped to
 * a single account/workspace (see workspace.js) and must never be written
 * with `shared: true` — that flag makes a record readable by every user of
 * this app, which would leak one business's clients to every other business.
 */
import { safeGet, safeSet, safeDelete } from "./storageClient";
import { scopedKey } from "./workspace";
import { SEED_CLIENTS } from "../data/seedClients";

const CRM_INDEX_KEY = "crm:client-ids";
export const crmKey = async (id) => scopedKey(`crm:client:${id}`);

export async function loadClientsFromStorage() {
  const hasStorage = typeof window !== "undefined" && !!window.storage;
  if (!hasStorage) return { clients: SEED_CLIENTS, persistent: false };

  const indexKey = await scopedKey(CRM_INDEX_KEY);
  const idsRaw = await safeGet(indexKey, false);
  if (idsRaw === undefined) {
    // First run (or storage briefly unreachable): seed storage with demo data.
    const ok = await safeSet(indexKey, JSON.stringify(SEED_CLIENTS.map((c) => c.id)), false);
    await Promise.all(SEED_CLIENTS.map(async (c) => safeSet(await crmKey(c.id), JSON.stringify(c), false)));
    return { clients: SEED_CLIENTS, persistent: ok };
  }

  let ids = [];
  try { ids = JSON.parse(idsRaw); } catch { ids = []; }
  const fetched = await Promise.all(ids.map(async (id) => safeGet(await crmKey(id), false)));
  const clients = [];
  fetched.forEach((raw) => {
    if (raw === undefined) return; // skip records that failed to load individually
    try { clients.push(JSON.parse(raw)); } catch {}
  });
  return { clients, persistent: true };
}

export async function persistClientsIndex(clients) {
  const indexKey = await scopedKey(CRM_INDEX_KEY);
  return safeSet(indexKey, JSON.stringify(clients.map((c) => c.id)), false);
}
export async function persistClient(client) {
  return safeSet(await crmKey(client.id), JSON.stringify(client), false);
}
export async function deleteClientFromStorage(id) {
  return safeDelete(await crmKey(id), false);
}
