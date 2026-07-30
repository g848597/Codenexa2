/** Seed notification feed. iconKey maps to a lucide icon in Notifications.jsx
 *  (icon components themselves can't be persisted to storage as JSON). */
import { isoAgo } from "../utils/helpers";

export const NOTIFICATIONS = [
  { id: "n1", iconKey: "money", color: "#17D896", title: "Оплата получена", desc: "Solaris Retail — 3 600 000 ₸", at: isoAgo(0, 2), read: false },
  { id: "n2", iconKey: "alert", color: "#FF5C5C", title: "Просрочена задача", desc: "CRM миграция — сбор реквизитов", at: isoAgo(0, 5), read: false },
  { id: "n3", iconKey: "doc", color: "#6E6AF6", title: "Документ подписан", desc: "Договор — Aitas Group", at: isoAgo(1), read: false },
  { id: "n4", iconKey: "ai", color: "#F2B84B", title: "AI-рекомендация", desc: "Есть 3 клиента без ответа 48ч+", at: isoAgo(1), read: true },
];
