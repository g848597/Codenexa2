/**
 * Generic personal, workspace-scoped collection storage. clientsStorage.js
 * and projectsStorage.js keep their own hand-written versions of this
 * (they predate this helper and have a couple of domain-specific bits),
 * but every newer domain (tasks, marketing, team, notifications) is built
 * on this factory so the persistence pattern — and the `shared: false`
 * privacy guarantee — stays identical everywhere.
 */
import { safeGet, safeSet, safeDelete } from "./storageClient";
import { scopedKey } from "./workspace";

/**
 * @param {string} namespace e.g. "tasks", "marketing"
 * @param {Array} seed seed/demo records, each with a stable `id`
 */
export function createCollectionStorage(namespace, seed) {
  const indexKeyName = `${namespace}:ids`;
  const itemKey = async (id) => scopedKey(`${namespace}:item:${id}`);

  async function load() {
    const hasStorage = typeof window !== "undefined" && !!window.storage;
    if (!hasStorage) return { items: seed, persistent: false };

    const indexKey = await scopedKey(indexKeyName);
    const idsRaw = await safeGet(indexKey, false);
    if (idsRaw === undefined) {
      const ok = await safeSet(indexKey, JSON.stringify(seed.map((i) => i.id)), false);
      await Promise.all(seed.map(async (i) => safeSet(await itemKey(i.id), JSON.stringify(i), false)));
      return { items: seed, persistent: ok };
    }

    let ids = [];
    try { ids = JSON.parse(idsRaw); } catch { ids = []; }
    const fetched = await Promise.all(ids.map(async (id) => safeGet(await itemKey(id), false)));
    const items = [];
    fetched.forEach((raw) => {
      if (raw === undefined) return;
      try { items.push(JSON.parse(raw)); } catch {}
    });
    return { items, persistent: true };
  }

  async function persistIndex(items) {
    const indexKey = await scopedKey(indexKeyName);
    return safeSet(indexKey, JSON.stringify(items.map((i) => i.id)), false);
  }
  async function persistItem(item) {
    return safeSet(await itemKey(item.id), JSON.stringify(item), false);
  }
  async function deleteItem(id) {
    return safeDelete(await itemKey(id), false);
  }

  return { load, persistIndex, persistItem, deleteItem };
}
