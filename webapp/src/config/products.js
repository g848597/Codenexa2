// Каждый продукт экосистемы — один объект. Чтобы добавить новый продукт,
// достаточно добавить запись сюда — верстка ledgerCard.js подхватит её автоматически.
//
// ВАЖНО, зафиксировано как принцип архитектуры: этот массив не рассчитан на
// фиксированное число элементов. Сегодня здесь 4 записи, завтра может быть 8,
// через месяц — 20: новые боты добавляются в каталог непрерывно. Каждый бот
// работает независимо от остальных (можно добавить/убрать один — остальные не
// затронуты), они лишь дополняют друг друга через общую базу пользователей и
// Premium. Ни ledgerCard.js, ни карта экосистемы (flywheelDiagram.js) не имеют
// зашитого числа продуктов — оба читают длину этого массива и подстраиваются.
//
// metric.value === null означает: подтверждённого источника данных ещё нет.
// Согласно Модулю 0 / правилу №1 мастер-роадмапа — в этом случае UI обязан
// показать честное пустое состояние, а не придуманное число.
//
// Модуль 6, второй проход локализации: текстовые поля (tagline, model.label,
// metric.label/source, investor.*) теперь объекты { ru, en } — рендерится через
// tl() из src/i18n.js. Имя продукта (name) не переводится — это бренд.

export const STAGE_META = {
  validation: { fill: '20%', order: 1 },
  traction:   { fill: '62%', order: 2 },
  scale:      { fill: '100%', order: 3 },
};

export const PRODUCTS = [
  {
    id: 'sport',
    name: 'AI Sport',
    tagline: { ru: 'Спорт-аналитика на живых событиях', en: 'Sports analytics on live events' },
    model: { label: { ru: 'Подписка', en: 'Subscription' }, cls: 'model-subscription' },
    stage: 'traction',
    webAppEntry: true, // есть рабочее веб-приложение — см. src/components/sportApp.js
    metric: {
      label: { ru: 'Активные пользователи (MAU)', en: 'Active users (MAU)' },
      source: { ru: 'Источник: аналитика бота', en: 'Source: bot analytics' },
      value: null,
      unit: '',
    },
    investor: {
      role: { ru: 'Основной канал привлечения аудитории в экосистему', en: 'Primary channel for bringing an audience into the ecosystem' },
      economics: { ru: 'Подписочная модель, единая точка входа для новых пользователей', en: 'Subscription model, a single entry point for new users' },
      risk: { ru: 'Зависит от календаря живых спортивных событий', en: 'Depends on the calendar of live sporting events' },
    },
  },
  {
    id: 'docs',
    name: 'AI Docs',
    tagline: { ru: 'Генерация и оформление документов', en: 'Document generation and formatting' },
    model: { label: { ru: 'Freemium', en: 'Freemium' }, cls: 'model-freemium' },
    stage: 'traction',
    webAppEntry: true, // есть рабочее веб-приложение (не только карточка-описание) — см. src/components/docsApp.js
    metric: {
      label: { ru: 'Конверсия в платящих', en: 'Conversion to paying users' },
      source: { ru: 'Источник: платёжный провайдер', en: 'Source: payment provider' },
      value: null,
      unit: '',
    },
    investor: {
      role: { ru: 'Продукт для удержания: решает регулярную, а не разовую задачу', en: 'A retention product: solves a recurring need, not a one-off task' },
      economics: { ru: 'Бесплатный лимит + платное расширение объёма', en: 'Free limit + paid volume expansion' },
      risk: { ru: 'Высокая конкуренция в нише генерации документов', en: 'High competition in the document-generation niche' },
    },
  },
  {
    id: 'automation',
    name: 'Automation Hub',
    tagline: { ru: 'Автоматизация рутинных сценариев', en: 'Automating routine workflows' },
    model: { label: { ru: 'Usage-based', en: 'Usage-based' }, cls: 'model-usage' },
    stage: 'validation',
    metric: {
      label: { ru: 'Design-partner интеграции', en: 'Design-partner integrations' },
      source: { ru: 'Статус: собираем первых партнёров', en: 'Status: recruiting first partners' },
      value: null,
      unit: '',
    },
    investor: {
      role: { ru: 'Будущая точка входа для партнёрских и API-интеграций', en: 'A future entry point for partner and API integrations' },
      economics: { ru: 'Оплата за объём выполненных автоматизаций (модель не запущена)', en: 'Pay per volume of completed automations (model not yet launched)' },
      risk: { ru: 'Технически самый ранний продукт линейки', en: 'The technically earliest-stage product in the lineup' },
    },
  },
  {
    id: 'premium',
    name: 'Premium',
    tagline: { ru: 'Единая подписка на всю экосистему', en: 'A single subscription for the whole ecosystem' },
    model: { label: { ru: 'Bundle', en: 'Bundle' }, cls: 'model-bundle' },
    stage: 'scale',
    metric: {
      label: { ru: 'Retention 30 дней', en: '30-day retention' },
      source: { ru: 'Источник: логи активности', en: 'Source: activity logs' },
      value: null,
      unit: '',
    },
    investor: {
      role: { ru: 'Связывающий слой флайвила — открывает все продукты разом', en: 'The flywheel connective layer — unlocks every product at once' },
      economics: { ru: 'Один платёж вместо нескольких отдельных подписок', en: 'One payment instead of several separate subscriptions' },
      risk: { ru: 'Ценность растёт только вместе с числом продуктов в пакете', en: 'Value grows only alongside the number of products in the bundle' },
    },
  },
];
