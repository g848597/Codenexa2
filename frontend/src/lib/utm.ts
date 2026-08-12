/**
 * Модуль 3.5 UTM Builder.
 *
 * Автодополнение source/medium хранится в localStorage (не в Smart History
 * — это просто "запомненные значения полей", а не сгенерированный
 * результат) — по спеке "хранить последние 10" на каждое из двух полей.
 */
export interface UtmFields {
  baseUrl: string;
  source: string;
  medium: string;
  campaign: string;
  content: string; // опционально
  term: string; // опционально
}

export const EMPTY_UTM_FIELDS: UtmFields = {
  baseUrl: "",
  source: "",
  medium: "",
  campaign: "",
  content: "",
  term: "",
};

const STORAGE_KEY_PREFIX = "utm_builder:recent:";
const MAX_RECENT = 10;

function storageKey(field: "source" | "medium"): string {
  return `${STORAGE_KEY_PREFIX}${field}`;
}

export function getRecentValues(field: "source" | "medium"): string[] {
  try {
    const raw = localStorage.getItem(storageKey(field));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function rememberValue(field: "source" | "medium", value: string): void {
  const trimmed = value.trim();
  if (!trimmed) return;
  try {
    const existing = getRecentValues(field).filter((v) => v !== trimmed);
    const updated = [trimmed, ...existing].slice(0, MAX_RECENT);
    localStorage.setItem(storageKey(field), JSON.stringify(updated));
  } catch {
    // localStorage недоступен (приватный режим и т.п.) — автодополнение
    // просто не сохранится, на сборку ссылки это не влияет.
  }
}

export interface BuildUtmResult {
  ok: boolean;
  url: string;
  error?: string;
}

/** Экранирование через URLSearchParams — корректно обрабатывает пробелы,
 * кириллицу и спецсимволы в значениях меток. */
export function buildUtmUrl(fields: UtmFields): BuildUtmResult {
  const base = fields.baseUrl.trim();
  if (!base) return { ok: false, url: "", error: "Укажите базовый URL" };
  if (!/^https?:\/\//i.test(base)) {
    return { ok: false, url: "", error: "URL должен начинаться с http:// или https://" };
  }
  if (!fields.source.trim()) return { ok: false, url: "", error: "Укажите utm_source" };
  if (!fields.medium.trim()) return { ok: false, url: "", error: "Укажите utm_medium" };
  if (!fields.campaign.trim()) return { ok: false, url: "", error: "Укажите utm_campaign" };

  let parsed: URL;
  try {
    parsed = new URL(base);
  } catch {
    return { ok: false, url: "", error: "Некорректный URL" };
  }

  parsed.searchParams.set("utm_source", fields.source.trim());
  parsed.searchParams.set("utm_medium", fields.medium.trim());
  parsed.searchParams.set("utm_campaign", fields.campaign.trim());
  if (fields.content.trim()) parsed.searchParams.set("utm_content", fields.content.trim());
  if (fields.term.trim()) parsed.searchParams.set("utm_term", fields.term.trim());

  return { ok: true, url: parsed.toString() };
}
