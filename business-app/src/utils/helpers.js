/**
 * Small, dependency-free utility functions shared across features:
 * relative time formatting, id generation, deterministic colors from
 * a name, simple field validation, deadline helpers and number formatting.
 */

export function isoAgo(days, hours = 0) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(d.getHours() - hours);
  return d.toISOString();
}

export function formatRelative(iso) {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 0) return "только что";
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "только что";
  if (diffMin < 60) return `${diffMin} мин назад`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} ч назад`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 0) return "сегодня";
  if (diffD === 1) return "вчера";
  if (diffD < 7) return `${diffD} дн. назад`;
  const diffW = Math.floor(diffD / 7);
  if (diffW < 5) return `${diffW} нед. назад`;
  return new Date(iso).toLocaleDateString("ru-RU");
}

export function genId(prefix = "c") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

const CLIENT_PALETTE = ["#6E6AF6", "#17D896", "#F2B84B", "#22B8FF", "#FF5C5C"];
export function colorForName(name = "") {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return CLIENT_PALETTE[hash % CLIENT_PALETTE.length];
}

export function isValidEmail(v) { return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()); }
export function isValidPhone(v) { return !v || /^[+\d][\d\s\-()]{6,}$/.test(v.trim()); }

export function formatDeadline(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" }).replace(".", "");
}
export function daysUntil(iso) {
  if (!iso) return null;
  const ms = new Date(iso).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  return Math.round(ms / 86400000);
}
export function deadlineTone(iso, status) {
  if (status === "Завершён") return "#17D896";
  const d = daysUntil(iso);
  if (d === null) return "#9A9EA6";
  if (d < 0) return "#FF5C5C";
  if (d <= 5) return "#F2B84B";
  return "#9A9EA6";
}

export function seedActivity(entries) {
  // entries: [kind, text, daysAgo, color]
  return entries.map(([kind, text, days, color]) => ({
    id: genId("a"), kind, text, at: isoAgo(days), color,
  }));
}

export function fmt(n) {
  return new Intl.NumberFormat("ru-RU").format(n);
}
