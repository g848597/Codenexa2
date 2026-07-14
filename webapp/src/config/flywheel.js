// Карта экосистемы — раньше это был "флайвил" из 4 захардкоженных узлов с
// фиксированными связями конкретных id друг с другом (Sport -> Docs -> Premium
// -> Automation -> Sport). Это ломалось при любом расширении линейки: диаграмма
// не умела показать 5-й, 10-й, 20-й бот без ручной правки координат и текста.
//
// Новая модель: узлы диаграммы генерируются автоматически из PRODUCTS
// (см. flywheelDiagram.js) — сколько продуктов в конфиге, столько узлов и
// появится, без единой правки здесь. Каждый бот подключается к общему центру
// экосистемы, а не к конкретному соседу — потому что по бизнес-логике боты
// НЕ зависят друг от друга, а лишь дополняют общую систему.
//
// Здесь остаётся только то, что не привязано к конкретным id и не устаревает
// при добавлении нового бота: цветовая палитра узлов и список общих принципов
// ("почему это экосистема, а не список приложений").

export const NODE_COLOR_PALETTE = [
  '#00d9a0', // ledger green
  '#5b9dff', // steel blue
  '#f0a93a', // amber
  '#c792ea', // orchid — для 4-го+ узла
  '#ff8a65', // coral — для 5-го+ узла
  '#4fd1c5', // teal — для 6-го+ узла
];

export const FLYWHEEL_CENTER = {
  title: { ru: 'Экосистема', en: 'Ecosystem' },
};

// Общие механики — верны при 2 ботах и останутся верны при 20.
// Никаких "Sport -> Docs": ни один пункт не называет конкретный бот по id.
export const FLYWHEEL_MECHANICS = [
  {
    color: '#00d9a0',
    text: {
      ru: 'Каждый новый бот в каталоге сразу видит ту же базу пользователей — не нужно строить аудиторию с нуля.',
      en: 'Every new bot in the catalog reaches the same shared user base immediately — no audience built from zero.',
    },
  },
  {
    color: '#5b9dff',
    text: {
      ru: 'Боты работают независимо друг от друга: выключить или добавить один — не ломает остальные.',
      en: 'Bots work independently of each other: removing or adding one never breaks the rest.',
    },
  },
  {
    color: '#f0a93a',
    text: {
      ru: 'Premium объединяет весь каталог в одну подписку — чем больше ботов, тем выше её ценность.',
      en: 'Premium bundles the entire catalog into one subscription — the more bots, the more valuable it gets.',
    },
  },
  {
    color: 'rgba(255,255,255,0.4)',
    text: {
      ru: 'Automation Hub — общий слой, который соединяет боты между собой сценариями, когда это даёт пользователю смысл.',
      en: 'Automation Hub is the shared layer that wires bots together with cross-scenarios whenever it creates real user value.',
    },
  },
];
