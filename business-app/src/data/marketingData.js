/** Content idea seeds for the Marketing module. iconKey maps to a lucide
 *  icon in Marketing.jsx (icons can't be persisted to storage as JSON). */
export const CONTENT_TYPES = ["Instagram", "Telegram", "Email", "Reels"];
export const CONTENT_STATUSES = ["Идея", "В работе", "Опубликовано"];

export const CONTENT_IDEAS = [
  { id: "m1", type: "Instagram", iconKey: "instagram", title: "До/После: как мы обновили интерфейс банка", status: "Идея", color: "#6E6AF6" },
  { id: "m2", type: "Telegram", iconKey: "telegram", title: "5 ошибок в мобильном онбординге", status: "В работе", color: "#22B8FF" },
  { id: "m3", type: "Email", iconKey: "email", title: "Итоги квартала для партнёров", status: "В работе", color: "#F2B84B" },
  { id: "m4", type: "Reels", iconKey: "reels", title: "Закулисье съёмки для Solaris Retail", status: "Опубликовано", color: "#FF5C5C" },
];
