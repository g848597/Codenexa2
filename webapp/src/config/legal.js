// Модуль 6, п.5 — юридический минимум. Тексты ниже — не Lorem ipsum и не общие
// фразы "мы заботимся о вашей приватности": это содержательная структура типовых
// документов (что именно собираем, зачем, права пользователя, условия сервиса).
// НО: я не знаю ваши реальные юридические реквизиты (наименование юрлица/ИП,
// юрисдикция регистрации, юридический адрес, реальный email для обращений,
// реальный список используемых сервисов-обработчиков данных типа платёжного
// провайдера). Эти места помечены плейсхолдерами в квадратных скобках — их
// обязательно должен закрыть владелец бизнеса или юрист перед реальным релизом.
// Пока плейсхолдеры не заменены — раздел «Документы» в приложении явно
// помечает статус как «черновик, не является финальной юридической версией».
//
// Модуль 6, второй проход локализации: title/body каждой секции — объекты
// { ru, en }, рендерятся через tl(). Плейсхолдеры в квадратных скобках оставлены
// как есть в обоих языках — это места для реальных реквизитов, не текст для перевода.

export const LEGAL_STATUS = 'draft'; // 'draft' | 'reviewed' — переключите на 'reviewed' после юридической вычитки

export const PRIVACY_POLICY = {
  updatedAt: null, // TODO(владелец): дата реального юридического утверждения
  sections: [
    {
      title: { ru: 'Кто мы', en: 'Who we are' },
      body: {
        ru: 'CodeNexa — экосистема продуктов, доступная как Telegram Mini App. Оператором персональных данных является [юридическое наименование / ИП, регистрационный номер, юрисдикция]. Контакт по вопросам данных: [email для обращений по приватности].',
        en: 'CodeNexa is a product ecosystem available as a Telegram Mini App. The data controller is [legal entity name / sole proprietor, registration number, jurisdiction]. Contact for data questions: [privacy inquiries email].',
      },
    },
    {
      title: { ru: 'Какие данные мы получаем', en: 'What data we receive' },
      body: {
        ru: 'Из Telegram WebApp SDK: идентификатор пользователя, имя, язык интерфейса, часовой пояс — только то, что реально передаёт Telegram при открытии приложения. Мы не запрашиваем номер телефона, геолокацию или доступ к контактам. Локально на устройстве (localStorage) хранится: факт прохождения онбординга, выбранный интерес, список подключённых продуктов, реферальный код и счётчик приглашений — это не передаётся на сервер, пока не подключён реальный бэкенд.',
        en: "From the Telegram WebApp SDK: user ID, name, interface language, time zone — only what Telegram actually passes when the app is opened. We don't request a phone number, geolocation, or contact access. Stored locally on the device (localStorage): onboarding completion, the chosen interest, the list of connected products, a referral code, and an invite counter — none of this is sent to a server until a real backend is connected.",
      },
    },
    {
      title: { ru: 'Зачем нам эти данные', en: 'Why we use this data' },
      body: {
        ru: 'Персонализация приветствия и прогресса в приложении, работа реферальной программы, честный расчёт метрик продуктов (когда источники данных подключены). Данные не используются для показа рекламы третьих лиц и не продаются.',
        en: "Personalizing the greeting and progress in the app, running the referral program, honestly calculating product metrics (once data sources are connected). Data is not used to show third-party ads and is not sold.",
      },
    },
    {
      title: { ru: 'Кто ещё видит данные', en: 'Who else sees the data' },
      body: {
        ru: 'Заявки в партнёрскую программу отправляются на [реальный email/CRM партнёрского отдела]. Платёжные данные, если и когда появится подписка, будут обрабатываться [название платёжного провайдера] — отдельным оператором со своей политикой. Список реальных обработчиков данных должен быть заполнен владельцем перед запуском платежей.',
        en: 'Partner program applications are sent to [real email/CRM of the partnerships team]. Payment data, if and when a subscription launches, will be processed by [payment provider name] as a separate controller with its own policy. The list of real data processors must be filled in by the owner before payments launch.',
      },
    },
    {
      title: { ru: 'Хранение и удаление', en: 'Storage and deletion' },
      body: {
        ru: 'Данные в localStorage хранятся на устройстве пользователя и удаляются при очистке данных браузера/приложения Telegram. Для запроса удаления любых данных, хранящихся на нашей стороне (после подключения реального бэкенда), — обращение на [email для обращений по приватности].',
        en: "Data in localStorage is stored on the user's device and is removed when browser/Telegram app data is cleared. To request deletion of any data stored on our side (once a real backend is connected), contact [privacy inquiries email].",
      },
    },
    {
      title: { ru: 'Права пользователя', en: 'User rights' },
      body: {
        ru: 'Запросить, какие данные о вас хранятся; попросить их исправить или удалить; отозвать согласие на публикацию отзыва (см. раздел «Доверие»). Обращение — на [email для обращений по приватности].',
        en: 'Request what data is stored about you; ask for it to be corrected or deleted; withdraw consent to publish a review (see the "Trust" section). Contact [privacy inquiries email].',
      },
    },
  ],
};

export const TERMS_OF_USE = {
  updatedAt: null, // TODO(владелец): дата реального юридического утверждения
  sections: [
    {
      title: { ru: 'Принятие условий', en: 'Acceptance of terms' },
      body: {
        ru: 'Используя CodeNexa как Telegram Mini App, вы соглашаетесь с этими условиями. Если вы не согласны — не используйте приложение.',
        en: 'By using CodeNexa as a Telegram Mini App, you agree to these terms. If you disagree, do not use the app.',
      },
    },
    {
      title: { ru: 'Что такое CodeNexa', en: 'What CodeNexa is' },
      body: {
        ru: 'Экосистема продуктов на стадиях от validation до scale (см. раздел «Продукты»). Стадия каждого продукта отражает его реальную готовность — использование продуктов на стадии validation может означать неполный функционал.',
        en: 'A product ecosystem spanning stages from validation to scale (see the "Products" section). Each product\'s stage reflects its real readiness — using products in the validation stage may mean incomplete functionality.',
      },
    },
    {
      title: { ru: 'Оплата и подписки', en: 'Payment and subscriptions' },
      body: {
        ru: 'Модели монетизации указаны у каждого продукта (подписка/freemium/usage/пакет). Условия оплаты, отмены и возврата средств для конкретного продукта будут описаны отдельно на момент, когда у продукта появится реальный платный тариф — [дополнить по мере запуска платежей].',
        en: 'Monetization models are shown for each product (subscription/freemium/usage/bundle). Payment, cancellation, and refund terms for a specific product will be described separately once that product has a real paid tier — [to be filled in once payments launch].',
      },
    },
    {
      title: { ru: 'Реферальная и партнёрская программы', en: 'Referral and partner programs' },
      body: {
        ru: 'Условия вознаграждения — см. раздел «Партнёрства» в приложении, значения там являются актуальными на момент показа. Начисления по реферальной программе засчитываются только после подтверждения через сервер (см. описание в разделе «Партнёрства»).',
        en: 'Reward terms — see the "Partners" section in the app; the values shown there are current as of display. Referral program credits are only counted after server-side confirmation (see the description in the "Partners" section).',
      },
    },
    {
      title: { ru: 'Ограничение ответственности', en: 'Limitation of liability' },
      body: {
        ru: 'Продукты на стадии validation/traction могут содержать ошибки или временные ограничения функциональности — это явно обозначено в интерфейсе. [Юридически точная формулировка ограничения ответственности должна быть проверена вашим юристом с учётом юрисдикции.]',
        en: '[Legally precise limitation-of-liability language must be reviewed by your lawyer for your jurisdiction.] Products in the validation/traction stage may contain bugs or temporary functional limitations — this is clearly indicated in the interface.',
      },
    },
    {
      title: { ru: 'Изменение условий', en: 'Changes to these terms' },
      body: {
        ru: 'Мы можем обновлять эти условия по мере развития продукта; дата последнего обновления указана вверху документа.',
        en: 'We may update these terms as the product evolves; the date of the last update is shown at the top of the document.',
      },
    },
  ],
};

export const PARTNER_TERMS = {
  updatedAt: null, // TODO(владелец): дата реального юридического утверждения
  sections: [
    {
      title: { ru: 'Кто может стать партнёром', en: 'Who can become a partner' },
      body: {
        ru: 'Блогеры/медиа и бизнес-партнёры — по формам заявки в разделе «Партнёрства». Технические партнёры — через лист ожидания API Automation Hub.',
        en: 'Bloggers/media and business partners — via the application forms in the "Partners" section. Technical partners — through the Automation Hub API waitlist.',
      },
    },
    {
      title: { ru: 'Вознаграждение', en: 'Reward' },
      body: {
        ru: 'Точные условия (процент/фиксированная сумма) указаны в разделе «Партнёрства» и являются частью этих условий. Пока значения не заполнены владельцем — публичной оферты по вознаграждению не существует, заявки принимаются как предварительный интерес.',
        en: 'Exact terms (percentage/fixed amount) are shown in the "Partners" section and form part of this agreement. Until the owner fills in real values, there is no public offer regarding reward — applications are accepted as preliminary interest only.',
      },
    },
    {
      title: { ru: 'Обязательства партнёра', en: 'Partner obligations' },
      body: {
        ru: 'Не использовать вводящие в заблуждение материалы при продвижении, не обещать функциональность, которой ещё нет (сверяться со стадией продукта в приложении).',
        en: "Not to use misleading promotional materials, and not to promise functionality that doesn't exist yet (check the product's stage in the app).",
      },
    },
    {
      title: { ru: 'Прекращение партнёрства', en: 'Terminating the partnership' },
      body: {
        ru: '[Дополнить реальными условиями расторжения — сроки уведомления, основания — по решению владельца/юриста.]',
        en: '[To be filled in with real termination terms — notice periods, grounds — per the decision of the owner/lawyer.]',
      },
    },
  ],
};
