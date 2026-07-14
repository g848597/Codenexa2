// Контент полноценного раздела продукта. Ключ — id из products.js.
//
// changelog: пусто по умолчанию — это НЕ баг. Правило №1 запрещает подставлять
// выдуманные записи истории версий. Заполняется реальными релизами по факту.
//
// techProgress: только для продуктов на стадии validation. Список задач — заготовка
// структуры; реальные статусы (done/in_progress/planned) должен проставить владелец
// продукта — я не могу подтвердить техническое состояние Automation Hub без доступа
// к вашему беклогу/репозиторию. Отмечено ниже как TODO.
//
// liveDataSlot: честный слот под живую интеграцию (например, live-события у Sport).
// Пока API не подключён — компонент покажет явное "не подключено", а не пример данных.
//
// Модуль 6, второй проход локализации: steps[].title/desc и techProgress[].label —
// объекты { ru, en }, рендерятся через tl().

export const PRODUCT_DETAILS = {
  sport: {
    steps: [
      { title: { ru: 'Подключаешь бота', en: 'Connect the bot' }, desc: { ru: 'Открываешь AI Sport внутри CodeNexa — без отдельной регистрации.', en: 'Open AI Sport inside CodeNexa — no separate sign-up needed.' } },
      { title: { ru: 'Выбираешь вид спорта и лигу', en: 'Pick a sport and league' }, desc: { ru: 'Фильтруешь по интересующим событиям.', en: 'Filter down to the events you care about.' } },
      { title: { ru: 'Получаешь аналитику к событию', en: 'Get analytics for the event' }, desc: { ru: 'Разбор перед матчем и по ходу, если статус подписки это открывает.', en: 'Pre-match and in-play breakdowns, if your subscription tier unlocks it.' } },
    ],
    changelog: [],
    techProgress: null, // не validation-стадия — этот блок не показывается
    // Раньше здесь был честный "не подключено" слот-заглушка (Правило №1).
    // Теперь есть реальный веб-модуль с live-табло и карточками команд —
    // см. кнопку запуска ниже и src/components/sportApp.js — поэтому общий
    // liveDataSlot больше не нужен, как и в разделе docs.
    liveDataSlot: false,
  },
  docs: {
    steps: [
      { title: { ru: 'Описываешь задачу', en: 'Describe the task' }, desc: { ru: 'Указываешь тип документа и вводные текстом.', en: 'Specify the document type and the details as text.' } },
      { title: { ru: 'Получаешь черновик', en: 'Get a draft' }, desc: { ru: 'AI собирает структуру и текст документа.', en: 'AI assembles the structure and text of the document.' } },
      { title: { ru: 'Донастраиваешь и экспортируешь', en: 'Fine-tune and export' }, desc: { ru: 'Правки вручную, экспорт в нужный формат.', en: 'Manual edits, then export to the format you need.' } },
    ],
    changelog: [],
    techProgress: null,
    liveDataSlot: false,
  },
  automation: {
    steps: [
      { title: { ru: 'Описываешь сценарий', en: 'Describe the workflow' }, desc: { ru: 'Какой процесс нужно автоматизировать и с чем он должен интегрироваться.', en: 'What process needs automating and what it needs to integrate with.' } },
      { title: { ru: 'Проверяем совместимость', en: 'We check feasibility' }, desc: { ru: 'Design-partner этап: смотрим, что технически возможно уже сейчас.', en: "Design-partner stage: we assess what's technically possible right now." } },
      { title: { ru: 'Запускаем пилот', en: 'We launch a pilot' }, desc: { ru: 'Первая работающая интеграция — вручную, до появления самостоятельного API.', en: 'The first working integration — done manually, until a standalone API exists.' } },
    ],
    changelog: [],
    // TODO(владелец продукта): проставить реальные статусы. Ничего из списка ниже
    // не подтверждено фактическим состоянием разработки — это черновая структура,
    // не готовые данные. Замените "planned" на факт по каждому пункту перед релизом раздела.
    techProgress: [
      { label: { ru: 'Базовый API для приёма сценариев', en: 'Base API for accepting workflows' }, status: 'planned' },
      { label: { ru: 'Первая design-partner интеграция', en: 'First design-partner integration' }, status: 'planned' },
      { label: { ru: 'Usage-based биллинг', en: 'Usage-based billing' }, status: 'planned' },
    ],
    liveDataSlot: false,
  },
  premium: {
    steps: [
      { title: { ru: 'Оформляешь единую подписку', en: 'Set up a single subscription' }, desc: { ru: 'Один платёж вместо нескольких отдельных.', en: 'One payment instead of several separate ones.' } },
      { title: { ru: 'Получаешь доступ ко всем продуктам', en: 'Get access to all products' }, desc: { ru: 'Sport, Docs и далее по мере запуска новых.', en: 'Sport, Docs, and more as new ones launch.' } },
      { title: { ru: 'Управляешь всем в одном месте', en: 'Manage everything in one place' }, desc: { ru: 'Единый профиль, единая история подключений.', en: 'A single profile, a single connection history.' } },
    ],
    changelog: [],
    techProgress: null,
    liveDataSlot: false,
  },
};
