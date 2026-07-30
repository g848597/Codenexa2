/**
 * Thin, failure-resilient wrapper around the global `window.storage`
 * key-value API. All functions swallow errors and return a sentinel
 * (undefined/false) instead of throwing, so callers can always fall
 * back to in-memory / seed data.
 */

export async function safeGet(key, shared) {
  try {
    if (typeof window === "undefined" || !window.storage) return undefined;
    const r = await window.storage.get(key, shared);
    return r ? r.value : undefined;
  } catch (e) {
    return undefined;
  }
}
export async function safeSet(key, value, shared) {
  try {
    if (typeof window === "undefined" || !window.storage) return false;
    const r = await window.storage.set(key, value, shared);
    return !!r;
  } catch (e) {
    return false;
  }
}
export async function safeDelete(key, shared) {
  try {
    if (typeof window === "undefined" || !window.storage) return false;
    await window.storage.delete(key, shared);
    return true;
  } catch (e) {
    return false;
  }
}
