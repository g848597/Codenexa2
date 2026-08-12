/**
 * Статусы контент-плана (6.1/6.2, см. app/repo.py CONTENT_PLAN_STATUSES на
 * бэкенде) — общий список для канбана и календаря, чтобы порядок колонок,
 * подписи и цвет точки статуса не разъезжались между двумя страницами,
 * читающими один и тот же content_plan_items.
 */
export interface ContentPlanStatusDef {
  key: string;
  label: string;
  dotClass: string;
}

export const CONTENT_PLAN_STATUSES: ContentPlanStatusDef[] = [
  { key: "idea", label: "Идея", dotClass: "bg-muted" },
  { key: "in_progress", label: "В работе", dotClass: "bg-accent" },
  { key: "done", label: "Готово", dotClass: "bg-accent-2" },
  // Отдельного токена под "опубликовано" в tailwind.config.js нет (только
  // accent/accent-2/danger/muted) — берём произвольное значение Tailwind
  // (янтарный), чтобы 4-я колонка визуально не совпадала с "Готово".
  { key: "published", label: "Опубликовано", dotClass: "bg-[#eab308]" },
];

export function statusLabel(key: string): string {
  return CONTENT_PLAN_STATUSES.find((s) => s.key === key)?.label ?? key;
}

export function statusDotClass(key: string): string {
  return CONTENT_PLAN_STATUSES.find((s) => s.key === key)?.dotClass ?? "bg-muted";
}
