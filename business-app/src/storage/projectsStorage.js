/**
 * Persistence layer for Projects, backed by window.storage with a
 * seed-data fallback so the app still works before storage is ready
 * or when it is unavailable. Also exposes projectFinancials(), a pure
 * helper that derives income/expense/profit from a project.
 *
 * SECURITY: every call below uses `shared: false` — see clientsStorage.js
 * for why this matters. Projects/finances must never be `shared: true`.
 */
import { safeGet, safeSet, safeDelete } from "./storageClient";
import { scopedKey } from "./workspace";
import { SEED_PROJECTS } from "../data/seedProjects";

const PROJECTS_INDEX_KEY = "projects:project-ids";
export const projectKey = async (id) => scopedKey(`projects:project:${id}`);

export async function loadProjectsFromStorage() {
  const hasStorage = typeof window !== "undefined" && !!window.storage;
  if (!hasStorage) return { projects: SEED_PROJECTS, persistent: false };

  const indexKey = await scopedKey(PROJECTS_INDEX_KEY);
  const idsRaw = await safeGet(indexKey, false);
  if (idsRaw === undefined) {
    const ok = await safeSet(indexKey, JSON.stringify(SEED_PROJECTS.map((p) => p.id)), false);
    await Promise.all(SEED_PROJECTS.map(async (p) => safeSet(await projectKey(p.id), JSON.stringify(p), false)));
    return { projects: SEED_PROJECTS, persistent: ok };
  }

  let ids = [];
  try { ids = JSON.parse(idsRaw); } catch { ids = []; }
  const fetched = await Promise.all(ids.map(async (id) => safeGet(await projectKey(id), false)));
  const projects = [];
  fetched.forEach((raw) => {
    if (raw === undefined) return;
    try { projects.push(JSON.parse(raw)); } catch {}
  });
  return { projects, persistent: true };
}

export async function persistProjectsIndex(projects) {
  const indexKey = await scopedKey(PROJECTS_INDEX_KEY);
  return safeSet(indexKey, JSON.stringify(projects.map((p) => p.id)), false);
}
export async function persistProject(project) {
  return safeSet(await projectKey(project.id), JSON.stringify(project), false);
}
export async function deleteProjectFromStorage(id) {
  return safeDelete(await projectKey(id), false);
}

export function projectFinancials(project) {
  const txs = project.transactions || [];
  const income = txs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = txs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  return { income, expense, profit: income - expense };
}
