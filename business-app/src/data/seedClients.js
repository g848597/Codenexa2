/** Seed / demo data for the CRM module, used until real data is loaded. */
import { genId, isoAgo, seedActivity } from "../utils/helpers";

export const SEED_CLIENTS = [
  {
    id: "c1", name: "Aster Group", contact: "Диас Нурланов", color: "#6E6AF6",
    status: "Переговоры", value: 4200000, phone: "+7 701 222 3344", email: "d.nurlanov@aster.kz",
    tg: "@dias_aster", manager: "Айгерим", createdAt: isoAgo(21), lastContactAt: isoAgo(2),
    documents: [
      { id: genId("d"), name: "Коммерческое предложение.pdf", at: isoAgo(3) },
      { id: genId("d"), name: "Бриф проекта.docx", at: isoAgo(10) },
      { id: genId("d"), name: "Договор.pdf", at: isoAgo(14) },
    ],
    activity: seedActivity([
      ["history", "Отправлено коммерческое предложение", 3, "#17D896"],
      ["history", "Звонок: обсуждение условий", 5, "#6E6AF6"],
      ["history", "Первый контакт через Telegram", 9, "#F2B84B"],
      ["comment", "Клиент готов подписать при скидке 5% — уточнить у финансов", 2, null],
    ]),
  },
  {
    id: "c2", name: "Bereke Corp", contact: "Марат Есенов", color: "#17D896", status: "Ждёт ответа",
    value: 1850000, phone: "+7 701 555 1212", email: "m.yessenov@bereke.kz", tg: "@marat_b",
    manager: "Тимур", createdAt: isoAgo(30), lastContactAt: isoAgo(5),
    documents: [{ id: genId("d"), name: "Договор.pdf", at: isoAgo(20) }],
    activity: seedActivity([
      ["history", "Отправлено письмо с условиями", 5, "#F2B84B"],
      ["history", "Первый звонок", 12, "#6E6AF6"],
    ]),
  },
  {
    id: "c3", name: "MOST Logistics", contact: "Алия Сатпаева", color: "#F2B84B", status: "Новый лид",
    value: 640000, phone: "+7 700 111 9090", email: "a.satpayeva@most.kz", tg: "@aliya_most",
    manager: "Айгерим", createdAt: isoAgo(1), lastContactAt: isoAgo(1),
    documents: [],
    activity: seedActivity([["history", "Заявка с сайта", 1, "#22B8FF"]]),
  },
  {
    id: "c4", name: "Aitas Group", contact: "Ержан Болатов", color: "#FF5C5C", status: "Просрочка",
    value: 2100000, phone: "+7 707 444 6688", email: "e.bolatov@aitas.kz", tg: "@erzhan_a",
    manager: "Тимур", createdAt: isoAgo(40), lastContactAt: isoAgo(6),
    documents: Array.from({ length: 5 }).map((_, i) => ({ id: genId("d"), name: `Документ ${i + 1}.pdf`, at: isoAgo(6 + i * 2) })),
    activity: seedActivity([
      ["history", "Просрочен платёж по счёту", 6, "#FF5C5C"],
      ["comment", "Нужно напомнить о просрочке до конца недели", 4, null],
    ]),
  },
  {
    id: "c5", name: "Solaris Retail", contact: "Жанна Ким", color: "#6E6AF6", status: "Сделка закрыта",
    value: 3600000, phone: "+7 702 888 2211", email: "zh.kim@solaris.kz", tg: "@zhanna_k",
    manager: "Айгерим", createdAt: isoAgo(60), lastContactAt: isoAgo(0),
    documents: Array.from({ length: 6 }).map((_, i) => ({ id: genId("d"), name: `Документ ${i + 1}.pdf`, at: isoAgo(i) })),
    activity: seedActivity([
      ["history", "Оплата получена в полном объёме", 0, "#17D896"],
      ["history", "Договор подписан", 6, "#22B8FF"],
    ]),
  },
  {
    id: "c6", name: "Verto Finance", contact: "Игорь Пак", color: "#17D896", status: "Переговоры",
    value: 5400000, phone: "+7 705 333 7777", email: "i.pak@verto.kz", tg: "@igor_verto",
    manager: "Тимур", createdAt: isoAgo(15), lastContactAt: isoAgo(3),
    documents: [
      { id: genId("d"), name: "Финансовая модель.xlsx", at: isoAgo(3) },
      { id: genId("d"), name: "NDA.pdf", at: isoAgo(15) },
    ],
    activity: seedActivity([
      ["history", "Обсуждение технических требований", 3, "#6E6AF6"],
      ["history", "Знакомство на конференции", 15, "#F2B84B"],
    ]),
  },
];
