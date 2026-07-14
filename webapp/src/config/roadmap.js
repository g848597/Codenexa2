// Таймлайн roadmap — тоже конфиг-based. Добавить веху = добавить объект.
// when/title/desc/tag — объекты { ru, en }, резолвятся через tl() в компоненте (Модуль 6, локализация).
//
// Важно: ни одна веха здесь не называет фиксированное число ботов как потолок.
// Первая веха берёт актуальное количество продуктов из PRODUCTS.length — когда
// в products.js добавляется новый бот, текст этой вехи обновляется сам, без
// правки строки руками.
import { PRODUCTS } from './products.js';

const liveCount = PRODUCTS.length;

export const ROADMAP = [
  {
    when: { ru: 'Сейчас · Июль 2026', en: 'Now · July 2026' },
    status: 'now',
    title: {
      ru: `Каталог: ${liveCount} бота живы, новые — на подходе`,
      en: `Catalog: ${liveCount} bots live, more on the way`,
    },
    desc: {
      ru: 'Каталог не заканчивается на паре продуктов — это открытая линейка, которая постоянно пополняется новыми независимыми ботами. Метрики роста подключаются к реальным источникам в рамках Модуля 1, честно, без потолка «столько и будет».',
      en: "The catalog doesn't stop at a couple of products — it's an open lineup that keeps growing with new, independent bots. Growth metrics are being connected to real data sources as part of Module 1, honestly, with no artificial ceiling on how many bots there will be.",
    },
    tag: { ru: 'Live', en: 'Live' },
  },
  {
    when: { ru: 'Постоянно', en: 'Ongoing' },
    status: 'soon',
    title: { ru: 'Новые боты добавляются в каталог по мере готовности', en: 'New bots are added to the catalog as they ship' },
    desc: {
      ru: 'Каждый новый бот подключается к общей базе пользователей и работает самостоятельно — без зависимости от остальных продуктов линейки. Требование к любому новому боту то же, что и к первым: честная стадия, честная метрика, честный источник данных.',
      en: 'Every new bot plugs into the shared user base and runs on its own — with no dependency on the rest of the lineup. Every new bot is held to the same bar as the first ones: an honest stage, an honest metric, an honest data source.',
    },
    tag: { ru: 'Непрерывно', en: 'Continuous' },
  },
  {
    when: { ru: 'Этот квартал', en: 'This quarter' },
    status: '',
    title: { ru: 'Automation Hub выходит из validation', en: 'Automation Hub moves out of validation' },
    desc: {
      ru: 'Первые design-partner интеграции. Цель — подтверждённая usage-based модель вместо гипотезы. Это же тот слой, через который боты каталога смогут соединяться сценариями между собой.',
      en: "First design-partner integrations. Goal: a confirmed usage-based model instead of a hypothesis. This is also the layer through which catalog bots will be able to connect with cross-scenarios.",
    },
    tag: { ru: 'В работе', en: 'In progress' },
  },
  {
    when: { ru: 'Через 6 месяцев', en: 'In 6 months' },
    status: '',
    title: { ru: 'Партнёрская программа', en: 'Partner program' },
    desc: {
      ru: 'Реферальная система для пользователей и программа для бизнес-партнёров — платформа открывается наружу.',
      en: 'A referral system for users and a program for business partners — the platform opens up outward.',
    },
    tag: { ru: 'План', en: 'Planned' },
  },
  {
    when: { ru: 'Горизонт 12 месяцев', en: '12-month horizon' },
    status: '',
    title: { ru: 'Публичная прозрачность метрик', en: 'Public metrics transparency' },
    desc: {
      ru: 'Ежеквартальный отчёт роста и полностью верифицированный дэшборд по всему каталогу — ни одной цифры без источника, сколько бы ботов в нём ни было.',
      en: 'A quarterly growth report and a fully verified dashboard across the whole catalog — not a single figure without a source, no matter how many bots it holds.',
    },
    tag: { ru: 'Стратегия', en: 'Strategy' },
  },
];
