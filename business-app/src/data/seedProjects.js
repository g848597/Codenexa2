/** Seed / demo data for the Projects module, used until real data is loaded. */
import { genId, isoAgo, seedActivity } from "../utils/helpers";

export function seedTransactions(entries) {
  // entries: [type, amount, note, daysAgo]
  return entries.map(([type, amount, note, daysAgo]) => ({
    id: genId("tx"), type, amount, note, at: isoAgo(daysAgo),
  }));
}

export const SEED_PROJECTS = [
  {
    id: "p1", name: "Rebrand OS", client: "Aster Group", manager: "Тимур", status: "В работе",
    progress: 72, budget: 6200000, deadline: "2026-08-12", team: ["А", "Т", "Д"], color: "#6E6AF6",
    createdAt: isoAgo(48),
    transactions: seedTransactions([
      ["income", 3200000, "Предоплата 50%", 45], ["income", 3000000, "Второй транш", 10],
      ["expense", 1400000, "Зарплата команды", 30], ["expense", 1000000, "Подрядчик-дизайнер", 15],
    ]),
    documents: [
      { id: genId("d"), name: "Договор на разработку.pdf", at: isoAgo(46) },
      { id: genId("d"), name: "Смета проекта.xlsx", at: isoAgo(40) },
      { id: genId("d"), name: "Бриф от клиента.docx", at: isoAgo(47) },
    ],
    activity: seedActivity([
      ["history", "Проект переведён в статус «В работе»", 40, "#6E6AF6"],
      ["comment", "Обновила макет главного экрана", 2, null],
      ["comment", "Согласовали сроки с клиентом", 5, null],
    ]),
  },
  {
    id: "p2", name: "Mobile Banking UX", client: "Verto Finance", manager: "Айгерим", status: "В работе",
    progress: 45, budget: 9800000, deadline: "2026-08-28", team: ["А", "К"], color: "#17D896",
    createdAt: isoAgo(60),
    transactions: seedTransactions([
      ["income", 4400000, "Предоплата", 55],
      ["expense", 2100000, "Команда разработки", 25], ["expense", 1000000, "UX-исследование", 12],
    ]),
    documents: [{ id: genId("d"), name: "Техническое задание.pdf", at: isoAgo(58) }],
    activity: seedActivity([["history", "Старт разработки прототипа", 25, "#17D896"]]),
  },
  {
    id: "p3", name: "Логистика 2.0", client: "MOST Logistics", manager: "Тимур", status: "Планирование",
    progress: 18, budget: 2100000, deadline: "2026-09-05", team: ["Т"], color: "#F2B84B",
    createdAt: isoAgo(20),
    transactions: seedTransactions([["income", 500000, "Аванс на старт", 18], ["expense", 220000, "Настройка интеграции 1С", 6]]),
    documents: [],
    activity: seedActivity([["history", "Проект создан из сделки MOST Logistics", 20, "#F2B84B"]]),
  },
  {
    id: "p4", name: "Retail Loyalty App", client: "Solaris Retail", manager: "Дана", status: "На проверке",
    progress: 95, budget: 5100000, deadline: "2026-07-26", team: ["Д", "К", "А"], color: "#22B8FF",
    createdAt: isoAgo(70),
    transactions: seedTransactions([
      ["income", 3600000, "Предоплата", 65], ["income", 1500000, "Финальный платёж", 3],
      ["expense", 1200000, "Команда", 40], ["expense", 600000, "Съёмка контента", 8],
    ]),
    documents: Array.from({ length: 3 }).map((_, i) => ({ id: genId("d"), name: `Акт выполненных работ ${i + 1}.pdf`, at: isoAgo(3 + i) })),
    activity: seedActivity([
      ["history", "Проект передан на финальную проверку", 3, "#22B8FF"],
      ["comment", "Ждём подтверждение от клиента по последним правкам", 1, null],
    ]),
  },
  {
    id: "p5", name: "CRM миграция", client: "Bereke Corp", manager: "Тимур", status: "В работе",
    progress: 30, budget: 1850000, deadline: "2026-09-14", team: ["Т", "А"], color: "#FF5C5C",
    createdAt: isoAgo(14),
    transactions: seedTransactions([["income", 900000, "Аванс", 12], ["expense", 650000, "Лицензии и настройка", 5]]),
    documents: [],
    activity: seedActivity([["history", "Проект создан", 14, "#FF5C5C"]]),
  },
  {
    id: "p6", name: "Brand Identity", client: "Aitas Group", manager: "Дана", status: "В работе",
    progress: 60, budget: 2100000, deadline: "2026-08-01", team: ["Д"], color: "#6E6AF6",
    createdAt: isoAgo(35),
    transactions: seedTransactions([["income", 1400000, "Предоплата", 30], ["expense", 700000, "Внешний иллюстратор", 14]]),
    documents: [{ id: genId("d"), name: "Логотип v3.pdf", at: isoAgo(4) }],
    activity: seedActivity([["history", "Логотип v3 утверждён", 4, "#6E6AF6"]]),
  },
];
