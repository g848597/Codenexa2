// Модуль 6 — локализация, первый проход. ВАЖНО (см. DoD Модуля 6): перевод ниже
// сделан мной как первое приближение и НЕ вычитан носителем языка — по правилам
// документа это не считается закрытым пунктом, пока такая вычитка не пройдена.
// Пока покрыта "рамка" приложения (навигация, заголовки разделов, онбординг,
// главный экран, общие кнопки/честные пометки) — это то, что решает первые
// 15–20 секунд знакомства с продуктом (см. DoD Модуля 2). Контент, завязанный
// на бизнес-конфиги (карточки продуктов, партнёрские условия, раздел «Доверие»),
// в этом проходе остаётся на русском и ждёт отдельного перевода + вычитки.

const LANG_KEY = 'codenexa_lang_v1';

const dict = {
  ru: {
    nav_dashboard: 'Дэшборд',
    nav_flywheel: 'Экосистема',
    nav_roadmap: 'Дорожная карта',
    nav_partners: 'Партнёры',
    nav_trust: 'Доверие',
    stage_validation: 'Валидация',
    stage_traction: 'Тракшн',
    stage_scale: 'Масштаб',
    data_badge: 'Данные проверены',
    current_period: 'Июль 2026',

    products_title: 'Продукты',
    products_count: (n) => `${n} в леджере`,

    flywheel_title: 'Карта экосистемы',
    flywheel_tag: 'растёт с каждым ботом',
    flywheel_lead:
      'Это не список из пары продуктов — это открытая система, куда боты добавляются постоянно. Каждый бот работает независимо от остальных, но усиливает общую экосистему. Схема ниже строится автоматически по каталогу продуктов: добавили бота в каталог — он сам появился на карте.',

    roadmap_title: 'Roadmap',
    roadmap_tag: '6–12 месяцев',

    hero_welcome_back: 'С возвращением',
    hero_welcome_first: 'Growth Console',
    hero_h1_first: 'Не каталог продуктов —<br><em>командный центр</em> бизнеса.',
    hero_h1_back: 'Твой путь <em>в экосистеме</em><br>уже начался.',
    hero_p_first:
      'Каждая карточка ниже — это не описание фичи, а живая запись в бизнес-леджере: модель монетизации, стадия роста и метрика с указанием источника.',
    hero_p_back: 'Прогресс считается по факту твоих действий — не по шаблону.',
    hero_empty_title: 'Ты ещё не подключил ни одного продукта',
    hero_empty_desc: (name) =>
      `Начни с ${name} — остальное экосистема предложит сама, по мере твоих реальных действий.`,
    hero_empty_button: (name) => `Подключить ${name}`,
    hero_honesty:
      '<b>Правило №1: без выдуманных цифр.</b> Если у метрики ещё нет реального источника данных, карточка честно показывает «Собираем данные».',
    hero_progress_of: (count, total) => `${count}/${total} продуктов`,
    hero_progress_all: 'Всё подключено',

    ob_back: 'Назад',
    ob_next: 'Далее',
    ob_start: 'Начать',
    ob_step1_eyebrow: 'Шаг 1 из 3',
    ob_step1_title: 'Это не набор карточек.<br>Это <em>растущая система</em>.',
    ob_step1_desc:
      'Каждый бот CodeNexa работает сам по себе — но все они делят одну экосистему, и новые появляются в каталоге постоянно.',
    ob_step2_eyebrow: 'Шаг 2 из 3',
    ob_step2_title: 'Выбери, что тебе<br>интересно <em>сейчас</em>.',
    ob_step2_desc:
      'Мы соберём для тебя маршрут по продуктам — без готовой истории, которой ещё не было.',
    ob_step3_eyebrow: 'Шаг 3 из 3',
    ob_step3_title: 'Дальше — твой<br>собственный <em>путь</em>.',
    ob_step3_desc:
      'Прогресс в системе считается по факту твоих действий: что подключил, что открыл дальше.',
    ob_interest_sport: 'Спорт-аналитика',
    ob_interest_docs: 'Документы',
    ob_interest_automation: 'Автоматизация',
    ob_interest_premium: 'Всё сразу',

    footer_status: (module) => `CODENEXA GROWTH CONSOLE · МОДУЛЬ ${module} В РАБОТЕ · ИЮЛЬ 2026`,

    ledger_connected: 'Подключено',
    ledger_not_connected: 'Не подключено',
    ledger_connect_btn: 'Подключить',
    ledger_done_btn: 'Готово',
    ledger_open_product: 'Открыть раздел продукта',
    ledger_open_product_short: 'Открыть',
    ledger_collecting_data: 'Собираем данные · появится после первых 30 дней',

    investor_toggle: 'Инвесторский слой',
    investor_role: 'Роль',
    investor_economics: 'Экономика',
    investor_risk: 'Риск',

    pd_back: '← Назад к продуктам',

    footer_legal_link: 'Политика конфиденциальности · Условия использования',

    lang_toggle_label: 'EN',

    // --- Модуль 6, второй проход локализации: раздел продукта ---
    pd_you_get: 'Что вы получаете',
    pd_changelog_title: 'История версий',
    pd_changelog_empty:
      'История версий появится с первым реальным релизом — раздел не заполняется примерами.',
    pd_tech_status_title: 'Технический статус',
    pd_tech_status_hint:
      'Продукт на стадии validation — честно показываем, что сделано, а что ещё нет',
    pd_live_title: 'Живые данные',
    pd_live_desc:
      'Интеграция с live-событиями пока не подключена. Как только API будет активен, здесь появятся реальные данные — без демо-примеров в этом слоте.',
    status_done: 'Готово',
    status_in_progress: 'В работе',
    status_planned: 'Запланировано',

    // --- Партнёрства ---
    partners_header_title: 'Партнёрства',
    partners_header_tag: 'CodeNexa открывается наружу',
    partners_lead:
      'Реферальная программа, заявки для бизнеса и техническое партнёрство через Automation Hub — фундамент будущей платформы, на которой строят другие, а не только CodeNexa.',
    pt_referral_title: 'Реферальная программа',
    pt_copy_btn: 'Копировать',
    pt_copied_btn: 'Скопировано',
    pt_invited_label: 'приглашено',
    pt_reward_label: 'вознаграждение',
    pt_pending: 'Условия уточняются',
    pt_referral_note:
      'Счётчик считает только подтверждённые переходы через бота. Пока бот не подключён к этому счётчику — значение растёт лишь тогда, когда это подтверждает сервер, не сам факт открытия ссылки.',
    pt_become_partner_title: 'Стать партнёром',
    pt_name_placeholder: 'Имя / название',
    pt_contact_placeholder: 'Контакт (Telegram, email)',
    pt_message_placeholder: 'Коротко о себе / аудитории',
    pt_submit_btn: 'Отправить заявку',
    pt_form_note:
      'Заявка уходит письмом — реального CRM/бота для приёма заявок пока не подключено (см. TODO в src/config/partners.js).',
    pt_api_title: 'API-партнёрство · Automation Hub',
    pt_api_status_not_available: 'Пока недоступно',
    pt_api_status_waitlist: 'Лист ожидания',
    pt_api_status_available: 'Доступно',
    pt_api_waitlist_btn: 'Оставить заявку в лист ожидания',
    pt_partners_title: 'Партнёры',
    pt_partners_empty:
      'Партнёров пока нет — будь первым. Витрина заполняется по мере подписания реальных соглашений.',
    pt_subject_api: 'Заявка на API-партнёрство · Automation Hub',
    pt_subject_partner: (tier) => `Заявка в партнёрскую программу · ${tier}`,
    pt_body_api: 'Заявка в лист ожидания API-доступа к Automation Hub.',
    pt_body_type: (tier) => `Тип: ${tier}`,
    pt_body_name: (v) => `Имя: ${v}`,
    pt_body_contact: (v) => `Контакт: ${v}`,
    pt_body_message: (v) => `Сообщение: ${v}`,

    // --- Доверие ---
    trust_header_title: 'Доверие',
    trust_header_tag: 'метрики → доверие',
    trust_lead:
      'Отзывы, отчёты роста, поддержка и статус системы — только реальные данные, честно помеченные пустые состояния там, где реальных данных пока нет.',
    reviews_title: 'Отзывы',
    reviews_empty:
      'Реальных отзывов с согласием автора на публикацию пока нет. Раздел в наполнении — публикуем только то, что реально подтверждено автором, ни одного примера ради заполнения.',
    review_anon: 'Аноним',
    growth_report_title: 'Отчёт роста',
    growth_report_empty:
      'Первый публичный отчёт появится по итогам первого полностью прошедшего отчётного периода — отчитываться заранее не за что.',
    report_worked: 'Что получилось',
    report_didnt: 'Что не получилось',
    report_next: 'Фокус на следующий период',
    report_published: (date) => `опубликован ${date}`,
    support_title: 'Поддержка',
    support_channel_pending: 'канал уточняется',
    sla_label: (time, period, sample) =>
      `среднее время ответа · ${period}${sample ? ` · ${sample} обращений` : ''}`,
    sla_empty:
      'SLA ещё не посчитан по факту — как только наберётся выборка обращений за полный месяц, здесь появится реальное среднее время ответа, а не декларация.',
    community_title: 'Сообщество',
    community_join: 'Присоединиться в Telegram →',
    community_empty: 'Точка входа в сообщество (канал/чат) ещё не открыта публично.',
    community_count_label: (source) => `участников · ${source}`,
    community_counter_note:
      'Счётчик участников появится, когда будет подключено получение реального числа через API — придуманное число здесь не показываем.',
    status_title: 'Статус системы',
    status_operational: 'Всё работает штатно',
    status_degraded: 'Частичная деградация',
    status_outage: 'Сбой в работе',
    incident_investigating: 'Расследуем',
    incident_monitoring: 'Наблюдаем',
    incident_resolved: 'Устранено',
    status_empty:
      'Известных инцидентов не зафиксировано. Как только что-то реально произойдёт — появится здесь, не под ковром.',

    // --- Документы (юридический раздел) ---
    legal_back: '← Назад',
    legal_header_title: 'Документы',
    legal_header_tag: 'юридический минимум',
    legal_draft_banner:
      '<b>Черновик.</b> Структура и содержание документов готовы, но текст ещё не прошёл юридическую вычитку и содержит плейсхолдеры вместо реальных реквизитов (юрлицо, адрес, контакты). Не является финальной юридической версией.',
    legal_updated: (date) => `Обновлено: ${date}`,
    legal_pending_review: 'Дата утверждения: ожидает юридической вычитки',
    legal_doc_privacy: 'Политика конфиденциальности',
    legal_doc_terms: 'Условия использования',
    legal_doc_partner_terms: 'Условия партнёрской программы',

    // --- Инвесторы ---
    nav_investors: 'Инвесторы',
    inv_hero_eyebrow: 'Investor Relations',
    inv_hero_title_1: 'Люди, которые',
    inv_hero_title_em: 'верят в рост',
    inv_hero_lead:
      'Инвесторы и партнёры, поддерживающие развитие экосистемы CodeNexa на разных стадиях — от валидации до масштабирования.',
    inv_stat_investors: 'инвесторов',
    inv_stat_countries: 'стран',
    inv_geo_title: 'География инвесторов',
    inv_stat_other: 'ещё страны',
    inv_amount_chart_title: 'Инвестиции по валютам',
    inv_amount_chart_note: 'Суммы в разных валютах не складываются напрямую — курс не учитывается.',
    inv_verified_badge: 'Подтверждено',
    inv_amount_label: 'Инвестировано',
    inv_amount_pending: 'Сумма не раскрывается',
    inv_visit_btn: 'Профиль',
    inv_empty_state:
      'Пока нет опубликованных карточек инвесторов — они появятся здесь сразу после публикации в админ-панели.',
    inv_load_error: 'Не удалось загрузить данные. Попробуйте обновить страницу.',
    inv_generic_error: 'Что-то пошло не так. Попробуйте ещё раз.',

    inv_admin_toggle_label: 'Управление инвесторами (админ)',
    inv_admin_add_btn: 'Добавить инвестора',
    inv_admin_loading: 'Загрузка…',
    inv_admin_empty: 'Пока нет ни одной карточки — добавьте первую.',
    inv_admin_edit: 'Редактировать',
    inv_admin_delete: 'Удалить',
    inv_admin_delete_confirm: (name) => `Удалить карточку «${name}»? Это действие необратимо.`,
    inv_admin_deleted_toast: 'Карточка удалена',
    inv_admin_saved_toast: 'Изменения сохранены',
    inv_admin_created_toast: 'Карточка создана — теперь можно загрузить фото',
    inv_admin_photo_updated_toast: 'Фото обновлено',
    inv_admin_edit_title: 'Редактировать инвестора',
    inv_admin_add_title: 'Новый инвестор',
    inv_admin_close: 'Закрыть',
    inv_admin_photo_upload: 'Загрузить фото',
    inv_admin_photo_remove: 'Удалить фото',
    inv_admin_photo_after_save: 'Фото можно загрузить после сохранения карточки',
    inv_admin_cancel: 'Отмена',
    inv_admin_save: 'Сохранить',
    inv_admin_saving: 'Сохранение…',
    inv_admin_saved_continue: 'Готово — продолжить',

    // Раунд 8 (модуль 5): UI-панель аудит-лога поверх API из раунда 7
    // (GET /api/admin/users/audit-log). Доступна только superadmin — при
    // 403 (обычный admin) показываем честное сообщение, а не пустой экран.
    inv_audit_toggle_label: 'Аудит-лог действий админов',
    inv_audit_loading: 'Загрузка журнала…',
    inv_audit_empty: 'Записей пока нет.',
    inv_audit_forbidden: 'Доступно только главным администраторам (superadmin).',
    inv_audit_filter_all_actions: 'Все действия',
    inv_audit_col_date: 'Когда',
    inv_audit_col_admin: 'Кто',
    inv_audit_col_action: 'Действие',
    inv_audit_col_target: 'Объект',
    inv_audit_prev_page: '← Раньше',
    inv_audit_next_page: 'Позже →',
    inv_audit_page_of: (offset, limit, total) =>
      `${Math.min(offset + 1, total)}–${Math.min(offset + limit, total)} из ${total}`,
    inv_audit_action_role_change: 'Смена роли',
    inv_audit_action_plan_price_change: 'Изменение цены тарифа',
    // "create"/"update"/"delete"/"reorder"/"photo_upload"/"photo_delete" —
    // сейчас используются только для target_type="investor" (см.
    // app/web/api/investors.py), поэтому подписаны в контексте инвесторов;
    // если позже action с таким именем появится для другого target_type,
    // это нужно будет разделить по паре (targetType, action).
    inv_audit_action_create: 'Инвестор создан',
    inv_audit_action_update: 'Инвестор изменён',
    inv_audit_action_delete: 'Инвестор удалён',
    inv_audit_action_reorder: 'Порядок инвесторов изменён',
    inv_audit_action_photo_upload: 'Фото инвестора загружено',
    inv_audit_action_photo_delete: 'Фото инвестора удалено',

    inv_status_published: 'Опубликовано',
    inv_status_hidden: 'Скрыто',
    inv_status_draft: 'Черновик',
    inv_field_name: 'Имя',
    inv_field_position: 'Должность',
    inv_field_country: 'Страна',
    inv_field_company: 'Компания',
    inv_field_amount: 'Сумма инвестиций (текст на карточке)',
    inv_field_amount_hint:
      'Свободный текст для отображения, например "$50k" или "по договорённости"',
    inv_field_amount_value: 'Сумма (число, для диаграммы)',
    inv_field_currency: 'Валюта',
    inv_currency_none: '— не указана —',
    inv_error_amount_pair: 'Заполните и сумму, и валюту вместе — либо оставьте оба поля пустыми',
    inv_field_website: 'Ссылка на профиль/сайт',
    inv_field_description: 'Краткое описание',
    inv_error_name_required: 'Укажите имя инвестора.',
    inv_error_website_format: 'Ссылка должна начинаться с http:// или https://',
  },

  en: {
    nav_dashboard: 'Dashboard',
    nav_flywheel: 'Ecosystem',
    nav_roadmap: 'Roadmap',
    nav_partners: 'Partners',
    nav_trust: 'Trust',
    stage_validation: 'Validation',
    stage_traction: 'Traction',
    stage_scale: 'Scale',
    data_badge: 'Data verified',
    current_period: 'July 2026',

    products_title: 'Products',
    products_count: (n) => `${n} in the ledger`,

    flywheel_title: 'Ecosystem map',
    flywheel_tag: 'grows with every bot',
    flywheel_lead:
      "This isn't a short list of a couple of products — it's an open system that new bots join continuously. Each bot works independently of the others, while still reinforcing the shared ecosystem. The diagram below is generated automatically from the product catalog: add a bot to the catalog, and it appears on the map on its own.",

    roadmap_title: 'Roadmap',
    roadmap_tag: '6–12 months',

    hero_welcome_back: 'Welcome back',
    hero_welcome_first: 'Growth Console',
    hero_h1_first: 'Not a product catalog —<br>a business <em>command center</em>.',
    hero_h1_back: 'Your path <em>through the ecosystem</em><br>has already begun.',
    hero_p_first:
      'Every card below is not a feature description, but a live entry in the business ledger: monetization model, growth stage, and a metric with a named source.',
    hero_p_back: 'Progress is measured by your real actions — not a template.',
    hero_empty_title: "You haven't connected any product yet",
    hero_empty_desc: (name) =>
      `Start with ${name} — the ecosystem will suggest the rest based on your real actions.`,
    hero_empty_button: (name) => `Connect ${name}`,
    hero_honesty:
      '<b>Rule #1: no invented numbers.</b> If a metric has no verified data source yet, the card honestly shows "Collecting data".',
    hero_progress_of: (count, total) => `${count}/${total} products`,
    hero_progress_all: 'All connected',

    ob_back: 'Back',
    ob_next: 'Next',
    ob_start: 'Start',
    ob_step1_eyebrow: 'Step 1 of 3',
    ob_step1_title: "It's not a set of cards.<br>It's a <em>growing system</em>.",
    ob_step1_desc:
      'Every CodeNexa bot stands on its own — but they all share one ecosystem, and new ones join the catalog continuously.',
    ob_step2_eyebrow: 'Step 2 of 3',
    ob_step2_title: 'Pick what interests<br>you <em>right now</em>.',
    ob_step2_desc:
      "We'll put together a route through the products for you — no ready-made history that never happened.",
    ob_step3_eyebrow: 'Step 3 of 3',
    ob_step3_title: 'From here — your<br>own <em>path</em>.',
    ob_step3_desc:
      'Progress in the system is measured by your real actions: what you connected, what you opened next.',
    ob_interest_sport: 'Sport analytics',
    ob_interest_docs: 'Documents',
    ob_interest_automation: 'Automation',
    ob_interest_premium: 'Everything at once',

    footer_status: (module) => `CODENEXA GROWTH CONSOLE · MODULE ${module} IN PROGRESS · JULY 2026`,

    ledger_connected: 'Connected',
    ledger_not_connected: 'Not connected',
    ledger_connect_btn: 'Connect',
    ledger_done_btn: 'Done',
    ledger_open_product: 'Open product section',
    ledger_open_product_short: 'Open',
    ledger_collecting_data: 'Collecting data · appears after the first 30 days',

    investor_toggle: 'Investor layer',
    investor_role: 'Role',
    investor_economics: 'Economics',
    investor_risk: 'Risk',

    pd_back: '← Back to products',

    footer_legal_link: 'Privacy Policy · Terms of Use',

    lang_toggle_label: 'RU',

    pd_you_get: 'What you get',
    pd_changelog_title: 'Version history',
    pd_changelog_empty:
      'Version history will appear with the first real release — this section is never filled with examples.',
    pd_tech_status_title: 'Technical status',
    pd_tech_status_hint:
      "Product is in the validation stage — we honestly show what's done and what isn't yet",
    pd_live_title: 'Live data',
    pd_live_desc:
      "Live-event integration isn't connected yet. Once the API is active, real data will appear here — no demo examples in this slot.",
    status_done: 'Done',
    status_in_progress: 'In progress',
    status_planned: 'Planned',

    partners_header_title: 'Partners',
    partners_header_tag: 'CodeNexa opens up to the outside',
    partners_lead:
      'A referral program, business applications, and technical partnership via Automation Hub — the foundation of a future platform that others build on, not just CodeNexa.',
    pt_referral_title: 'Referral program',
    pt_copy_btn: 'Copy',
    pt_copied_btn: 'Copied',
    pt_invited_label: 'invited',
    pt_reward_label: 'reward',
    pt_pending: 'Terms pending',
    pt_referral_note:
      'The counter only tracks confirmed referrals through the bot. Until the bot is connected to this counter, the value only grows when the server confirms it — not just from opening the link.',
    pt_become_partner_title: 'Become a partner',
    pt_name_placeholder: 'Name / company',
    pt_contact_placeholder: 'Contact (Telegram, email)',
    pt_message_placeholder: 'A short note about you / your audience',
    pt_submit_btn: 'Submit application',
    pt_form_note:
      'The application is sent by email — no real CRM/bot for applications is connected yet (see the TODO in src/config/partners.js).',
    pt_api_title: 'API partnership · Automation Hub',
    pt_api_status_not_available: 'Not available yet',
    pt_api_status_waitlist: 'Waitlist',
    pt_api_status_available: 'Available',
    pt_api_waitlist_btn: 'Join the waitlist',
    pt_partners_title: 'Partners',
    pt_partners_empty:
      'No partners yet — be the first. This showcase fills in as real agreements are signed.',
    pt_subject_api: 'API partnership application · Automation Hub',
    pt_subject_partner: (tier) => `Partner program application · ${tier}`,
    pt_body_api: 'Waitlist application for API access to Automation Hub.',
    pt_body_type: (tier) => `Type: ${tier}`,
    pt_body_name: (v) => `Name: ${v}`,
    pt_body_contact: (v) => `Contact: ${v}`,
    pt_body_message: (v) => `Message: ${v}`,

    trust_header_title: 'Trust',
    trust_header_tag: 'metrics → trust',
    trust_lead:
      "Reviews, growth reports, support and system status — only real data, with honest empty states wherever real data doesn't exist yet.",
    reviews_title: 'Reviews',
    reviews_empty:
      "There are no real reviews with author consent to publish yet. This section is being filled in — we only publish what's genuinely confirmed by the author, never an example just to fill space.",
    review_anon: 'Anonymous',
    growth_report_title: 'Growth report',
    growth_report_empty:
      "The first public report will appear once the first full reporting period has actually passed — there's nothing to report on in advance.",
    report_worked: 'What worked',
    report_didnt: "What didn't work",
    report_next: 'Focus for the next period',
    report_published: (date) => `published ${date}`,
    support_title: 'Support',
    support_channel_pending: 'channel pending',
    sla_label: (time, period, sample) =>
      `average response time · ${period}${sample ? ` · ${sample} requests` : ''}`,
    sla_empty:
      "SLA hasn't been calculated from real data yet — once a full month of requests is sampled, a real average response time will appear here, not a declaration.",
    community_title: 'Community',
    community_join: 'Join on Telegram →',
    community_empty: "The community entry point (channel/chat) isn't public yet.",
    community_count_label: (source) => `members · ${source}`,
    community_counter_note:
      "A member counter will appear once a real number via the API is connected — we don't show a made-up figure here.",
    status_title: 'System status',
    status_operational: 'Everything is operating normally',
    status_degraded: 'Partial degradation',
    status_outage: 'Outage',
    incident_investigating: 'Investigating',
    incident_monitoring: 'Monitoring',
    incident_resolved: 'Resolved',
    status_empty:
      'No known incidents recorded. If something actually happens, it will appear here — not swept under the rug.',

    legal_back: '← Back',
    legal_header_title: 'Documents',
    legal_header_tag: 'legal minimum',
    legal_draft_banner:
      '<b>Draft.</b> The structure and content of the documents are ready, but the text has not yet gone through legal review and contains placeholders instead of real business details (entity, address, contacts). This is not the final legal version.',
    legal_updated: (date) => `Updated: ${date}`,
    legal_pending_review: 'Approval date: pending legal review',
    legal_doc_privacy: 'Privacy Policy',
    legal_doc_terms: 'Terms of Use',
    legal_doc_partner_terms: 'Partner Program Terms',

    // --- Investors ---
    nav_investors: 'Investors',
    inv_hero_eyebrow: 'Investor Relations',
    inv_hero_title_1: 'People who',
    inv_hero_title_em: 'believe in growth',
    inv_hero_lead:
      'Investors and partners backing the CodeNexa ecosystem across every stage — from validation to scale.',
    inv_stat_investors: 'investors',
    inv_stat_countries: 'countries',
    inv_geo_title: 'Investor geography',
    inv_stat_other: 'other countries',
    inv_amount_chart_title: 'Investments by currency',
    inv_amount_chart_note:
      "Amounts in different currencies aren't added together — no exchange rate is applied.",
    inv_verified_badge: 'Verified',
    inv_amount_label: 'Invested',
    inv_amount_pending: 'Amount not disclosed',
    inv_visit_btn: 'Profile',
    inv_empty_state:
      'No published investor cards yet — they will appear here as soon as they are published in the admin panel.',
    inv_load_error: 'Could not load data. Try refreshing the page.',
    inv_generic_error: 'Something went wrong. Please try again.',

    inv_admin_toggle_label: 'Manage investors (admin)',
    inv_admin_add_btn: 'Add investor',
    inv_admin_loading: 'Loading…',
    inv_admin_empty: 'No cards yet — add the first one.',
    inv_admin_edit: 'Edit',
    inv_admin_delete: 'Delete',
    inv_admin_delete_confirm: (name) => `Delete "${name}"? This cannot be undone.`,
    inv_admin_deleted_toast: 'Card deleted',
    inv_admin_saved_toast: 'Changes saved',
    inv_admin_created_toast: 'Card created — you can upload a photo now',
    inv_admin_photo_updated_toast: 'Photo updated',
    inv_admin_edit_title: 'Edit investor',
    inv_admin_add_title: 'New investor',
    inv_admin_close: 'Close',
    inv_admin_photo_upload: 'Upload photo',
    inv_admin_photo_remove: 'Remove photo',
    inv_admin_photo_after_save: 'Photo can be uploaded after the card is saved',
    inv_admin_cancel: 'Cancel',
    inv_admin_save: 'Save',
    inv_admin_saving: 'Saving…',
    inv_admin_saved_continue: 'Done — continue',

    inv_audit_toggle_label: 'Admin action audit log',
    inv_audit_loading: 'Loading log…',
    inv_audit_empty: 'No entries yet.',
    inv_audit_forbidden: 'Available to superadmins only.',
    inv_audit_filter_all_actions: 'All actions',
    inv_audit_col_date: 'When',
    inv_audit_col_admin: 'Who',
    inv_audit_col_action: 'Action',
    inv_audit_col_target: 'Target',
    inv_audit_prev_page: '← Older',
    inv_audit_next_page: 'Newer →',
    inv_audit_page_of: (offset, limit, total) =>
      `${Math.min(offset + 1, total)}–${Math.min(offset + limit, total)} of ${total}`,
    inv_audit_action_role_change: 'Role changed',
    inv_audit_action_plan_price_change: 'Plan price changed',
    inv_audit_action_create: 'Investor created',
    inv_audit_action_update: 'Investor updated',
    inv_audit_action_delete: 'Investor deleted',
    inv_audit_action_reorder: 'Investor order changed',
    inv_audit_action_photo_upload: 'Investor photo uploaded',
    inv_audit_action_photo_delete: 'Investor photo deleted',

    inv_status_published: 'Published',
    inv_status_hidden: 'Hidden',
    inv_status_draft: 'Draft',
    inv_field_name: 'Name',
    inv_field_position: 'Position',
    inv_field_country: 'Country',
    inv_field_company: 'Company',
    inv_field_amount: 'Investment amount (card text)',
    inv_field_amount_hint: 'Free text for display, e.g. "$50k" or "undisclosed"',
    inv_field_amount_value: 'Amount (number, for chart)',
    inv_field_currency: 'Currency',
    inv_currency_none: '— none —',
    inv_error_amount_pair: 'Fill in both amount and currency together — or leave both empty',
    inv_field_website: 'Profile / website link',
    inv_field_description: 'Short description',
    inv_error_name_required: 'Investor name is required.',
    inv_error_website_format: 'The link must start with http:// or https://',
  },
};

function loadLang() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'ru' || saved === 'en') return saved;
  } catch {
    /* localStorage unavailable — fall back to default */
  }
  return 'ru';
}

let currentLang = loadLang();

export function getLang() {
  return currentLang;
}

export function setLang(lang) {
  if (lang !== 'ru' && lang !== 'en') return;
  currentLang = lang;
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* non-fatal */
  }
  document.documentElement.lang = lang;
}

export function toggleLang() {
  setLang(currentLang === 'ru' ? 'en' : 'ru');
  return currentLang;
}

// t(key, ...args) — returns the translated string; if the value is a function
// (used for strings with interpolated dynamic data), calls it with args.
export function t(key, ...args) {
  const entry =
    dict[currentLang] && dict[currentLang][key] !== undefined
      ? dict[currentLang][key]
      : dict.ru[key];
  if (typeof entry === 'function') return entry(...args);
  return entry !== undefined ? entry : key;
}

// tl(field) — resolves a localizable CONTENT field coming from src/config/*.js
// (products, productDetails, partners, trust, legal). Accepts either:
//   - a plain string/null (legacy/not-yet-translated content — returned as-is)
//   - an object { ru: '...', en: '...' } — returns the string for the current
//     language, falling back to ru if the current language isn't filled in yet.
// This lets config files hold real content in both languages without every
// component needing its own translation logic.
export function tl(field) {
  if (field === null || field === undefined) return field;
  if (typeof field === 'object' && !Array.isArray(field) && ('ru' in field || 'en' in field)) {
    return field[currentLang] !== undefined && field[currentLang] !== null
      ? field[currentLang]
      : field.ru;
  }
  return field;
}
