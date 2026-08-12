/**
 * Тон — 4 значения Brand Kit.tone_of_voice (см. app/api/brand_kit.py
 * VALID_TONES на бэкенде и app/content_logic.py CONTENT_TONES). Общий
 * список для всех 6 страниц раздела «Контент», чтобы селект тона
 * выглядел и вёл себя одинаково везде.
 */
export const CONTENT_TONES: { key: string; label: string }[] = [
  { key: "friendly", label: "Дружелюбный" },
  { key: "expert", label: "Экспертный" },
  { key: "sales", label: "Продающий" },
  { key: "official", label: "Официальный" },
];

export const DEFAULT_TONE = "friendly";
