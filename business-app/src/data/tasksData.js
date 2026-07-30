/** Seed data for the Kanban-style Tasks board. */
import { genId, isoAgo } from "../utils/helpers";

export const TASK_COLUMNS = ["К выполнению", "В работе", "На проверке", "Готово"];

function inDays(n) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

export const TASKS = [
  { id: genId("t"), title: "Согласовать макет главной", project: "Rebrand OS", status: "К выполнению", due: inDays(0), tag: "#6E6AF6" },
  { id: genId("t"), title: "Собрать реквизиты Bereke Corp", project: "CRM миграция", status: "К выполнению", due: inDays(1), tag: "#FF5C5C" },
  { id: genId("t"), title: "Прототип онбординга", project: "Mobile Banking UX", status: "В работе", due: inDays(3), tag: "#17D896" },
  { id: genId("t"), title: "Настройка интеграции 1С", project: "Логистика 2.0", status: "В работе", due: inDays(6), tag: "#F2B84B" },
  { id: genId("t"), title: "Съёмка Reels для клиента", project: "Retail Loyalty App", status: "В работе", due: inDays(-1), tag: "#22B8FF" },
  { id: genId("t"), title: "Финансовая модель Q3", project: "Verto Finance", status: "На проверке", due: inDays(2), tag: "#6E6AF6" },
  { id: genId("t"), title: "Логотип v3", project: "Brand Identity", status: "Готово", due: isoAgo(5), tag: "#17D896" },
  { id: genId("t"), title: "Договор подписан", project: "Solaris Retail", status: "Готово", due: isoAgo(8), tag: "#22B8FF" },
];
