/** Status label -> color maps shared by the CRM and Projects modules. */

export const STATUS_COLOR = {
  "Переговоры": "#6E6AF6",
  "Ждёт ответа": "#F2B84B",
  "Новый лид": "#22B8FF",
  "Просрочка": "#FF5C5C",
  "Сделка закрыта": "#17D896",
};
export const STATUS_LIST = Object.keys(STATUS_COLOR);

export const PROJECT_STATUS_COLOR = {
  "Планирование": "#9A9EA6",
  "В работе": "#6E6AF6",
  "На паузе": "#F2B84B",
  "На проверке": "#22B8FF",
  "Завершён": "#17D896",
};
export const PROJECT_STATUS_LIST = Object.keys(PROJECT_STATUS_COLOR);
