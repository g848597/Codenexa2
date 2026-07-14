// Партнёрская экосистема — конфиг-based, как всё остальное.
//
// ВАЖНО про rewardValue/rewardUnit: правило №1 запрещает выдуманные цифры.
// Я не знаю ваши реальные условия вознаграждения, поэтому они здесь = null.
// Пока они null — интерфейс честно показывает «условия уточняются», а не
// придуманный процент. Впишите реальные значения — сразу заработает в UI.

export const REFERRAL_TERMS = {
  rewardValue: null,   // например: 15 (%) или 3000 (число ₸) — впишите реальное значение
  rewardUnit: null,    // '%' | '₸'
  description: null,   // короткое пояснение условия, например "за каждого платящего друга"
};

export const PARTNER_TIERS = [
  {
    id: 'blogger',
    label: { ru: 'Блогер / медиа', en: 'Blogger / media' },
    rewardValue: null,  // TODO(владелец): реальные условия
    rewardUnit: null,
  },
  {
    id: 'business',
    label: { ru: 'Бизнес-партнёр', en: 'Business partner' },
    rewardValue: null,  // TODO(владелец): реальные условия
    rewardUnit: null,
  },
];

// Единственный работающий канал приёма заявок без бэкенда — mailto.
// Замените target на реальный адрес/CRM-вебхук, когда он появится.
export const PARTNER_APPLICATION_ENDPOINT = {
  type: 'mailto',
  target: 'partners@codenexa.example', // TODO(владелец): замените на реальный email
};

// Реальные партнёры добавляются сюда по мере подписания соглашений.
// Пусто по умолчанию — это честное стартовое состояние, не баг.
export const PARTNERS_SHOWCASE = [];

export const API_PARTNER_INFO = {
  status: 'not_available', // 'not_available' | 'waitlist' | 'available'
  description: {
    ru: 'Automation Hub ещё на стадии validation — публичного API пока нет. Оставь заявку, чтобы попасть в список первых технических партнёров.',
    en: "Automation Hub is still in the validation stage — there's no public API yet. Apply to get on the list of first technical partners.",
  },
};
