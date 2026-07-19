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
    inv_hero_eyebrow: 'Investor Center',
    inv_hero_title_1: 'Наши',
    inv_hero_title_em: 'инвесторы',
    inv_hero_lead: 'Люди, которые помогают строить будущее CodeNexa.',
    inv_stat_investors: 'инвесторов',
    inv_stat_countries: 'стран',
    inv_geo_title: 'География инвесторов',
    inv_stat_other: 'ещё страны',
    inv_amount_chart_title: 'Инвестиции по валютам',
    inv_amount_hero_label: 'Общий объём инвестиций',
    inv_amount_hero_more: (n) => `+ ещё ${n} ${n === 1 ? 'валюта' : n < 5 ? 'валюты' : 'валют'} ниже`,
    inv_top_investor_badge: 'Топ-инвестор',
    inv_verified_badge: 'Проверенный инвестор',
    inv_amount_label: 'Инвестировано',
    inv_amount_pending: 'Сумма не раскрывается',
    inv_visit_btn: 'Профиль',
    inv_empty_state:
      'Пока нет опубликованных карточек инвесторов — они появятся здесь сразу после публикации в админ-панели.',
    inv_load_error: 'Не удалось загрузить данные. Попробуйте обновить страницу.',
    inv_generic_error: 'Что-то пошло не так. Попробуйте ещё раз.',

    inv_search_placeholder: 'Поиск инвестора…',
    inv_sort_all: 'Все',
    inv_sort_amount: 'По сумме',
    inv_sort_alpha: 'По алфавиту',
    inv_search_no_results: 'Ничего не найдено. Попробуйте другой запрос.',
    inv_search_clear: 'Сбросить поиск',

    inv_detail_close: 'Закрыть',
    inv_detail_history_title: 'История инвестора',
    inv_detail_open_hint: 'Подробнее',

    inv_cta_eyebrow: 'Присоединяйтесь',
    inv_cta_title: 'Хотите стать следующим инвестором?',
    inv_cta_lead: 'CodeNexa открыта к сотрудничеству и новым инвестициям.',
    inv_cta_btn: 'Связаться с нами',
    inv_cta_subject: 'Заявка на инвестиции в CodeNexa',
    inv_cta_body: 'Здравствуйте! Хочу обсудить возможность инвестиций в CodeNexa.\n\nИмя:\nКонтакт:\nКомментарий:',

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

    // ---- Профиль / HUB экосистемы ----
    hub_tier_founder: 'Founder',
    hub_tier_premium: 'Premium Member',
    hub_tier_member: 'CodeNexa Member',
    hub_no_name: 'Без имени',
    hub_back_to_menu: 'Меню',
    pcm_pick_title: 'Выберите тариф',
    pcm_pick_sub: 'Все тарифы — из единого биллинга CodeNexa, те же цены, что и в личном кабинете.',
    pcm_duration: (days) => `${days} дн.`,
    pcm_back_to_plans: 'К тарифам',
    pcm_pay_sub: 'Выберите способ оплаты — тариф активируется автоматически сразу после оплаты.',
    pcm_amount_label: 'К оплате',
    pcm_or_stars: (stars) => `или ${stars} ★ через Telegram Stars`,
    pcm_pay_stars_btn: 'Оплатить Telegram Stars',
    pcm_pay_crypto_btn: 'Оплатить криптовалютой',
    pcm_crypto_prompt: 'Актив для оплаты: USDT, TON или BTC',
    pcm_fineprint: 'Оплата обрабатывается платёжным провайдером Telegram/CryptoBot — CodeNexa не хранит данные карт.',
    pcm_checkout_error: 'Не удалось создать счёт на оплату. Попробуйте ещё раз.',
    pcm_result_stars_title: 'Открываем оплату в Telegram',
    pcm_result_stars_sub: 'Подтвердите платёж во всплывшем окне Telegram Stars.',
    pcm_result_crypto_title: 'Счёт создан',
    pcm_result_crypto_sub: 'Перейдите по ссылке ниже, чтобы оплатить криптовалютой. Тариф активируется автоматически сразу после оплаты.',
    pcm_open_invoice_btn: 'Перейти к оплате',
    pcm_paid_alert: 'Оплата прошла успешно! Тариф активирован.',
    pcm_stars_telegram_only: 'Оплата через Telegram Stars доступна только внутри Telegram.',
    hub_section_organization: 'Организация',
    hub_menu_hint: 'Разделы аккаунта',
    hub_menu_organization_sub: 'Общий аккаунт компании',
    org_title: 'Организация',
    org_none_eligible_title: 'Аккаунт компании',
    org_none_eligible_desc: 'Создайте общий аккаунт компании — сотрудники смогут работать в едином пространстве и делиться шаблонами документов.',
    org_none_eligible_cta: 'Создать организацию',
    org_none_locked_title: 'Доступно на бизнес-тарифе',
    org_none_locked_desc: 'Общий аккаунт компании — это один оплаченный бизнес-тариф на всех сотрудников. Оформите бизнес-тариф, чтобы создать организацию и пригласить команду.',
    org_none_locked_cta: 'Смотреть тариф',
    org_create_name_placeholder: 'Название компании',
    org_create_submit: 'Создать',
    org_purchased_by: 'Аккаунт куплен',
    org_purchased_by_you: 'вами',
    org_your_role_owner: 'Владелец',
    org_your_role_member: 'Сотрудник',
    org_members_title: 'Сотрудники',
    org_invite_btn: 'Пригласить сотрудника',
    org_invite_link_ready: 'Ссылка-приглашение готова — отправьте её сотруднику:',
    org_invite_copy: 'Скопировать',
    org_invite_copied: 'Ссылка скопирована',
    org_remove_member: 'Удалить',
    org_leave_btn: 'Покинуть организацию',
    org_leave_confirm: 'Покинуть организацию? Доступ к общим шаблонам компании будет потерян.',
    org_remove_confirm: 'Удалить сотрудника из организации?',
    org_you_badge: 'вы',
    hub_no_email: 'Email не привязан',
    hub_via_telegram: 'Вход через Telegram',
    hub_edit_profile_btn: 'Управление аккаунтом',

    hub_section_ecosystem: 'CodeNexa Ecosystem',
    hub_section_subscription: 'Моя подписка',
    hub_section_activity: 'Моя активность',
    hub_section_ai: 'AI Center',
    hub_section_achievements: 'Достижения',
    hub_section_payments: 'Платежи',
    hub_section_referral: 'Реферальная программа',
    hub_section_security: 'Безопасность',
    hub_section_settings: 'Настройки',
    hub_section_support: 'Поддержка',

    hub_status_active: 'Активен',
    hub_status_available: 'Доступно',
    hub_status_soon: 'Скоро',
    hub_open_btn: 'Открыть',
    hub_ecosystem_note: 'Каталог продуктов растёт — карточки выше подтягиваются из единого конфига экосистемы, новые сервисы появятся здесь без переделки профиля.',

    hub_sub_free_plan: 'Без подписки',
    hub_sub_paid_plan_fallback: 'CodeNexa Premium',
    hub_sub_active: 'Активна',
    hub_sub_inactive: 'Не активна',
    hub_sub_expired: 'Истекла',
    hub_sub_lifetime: 'Бессрочно',
    hub_sub_expires_in: 'Истекает через',
    hub_sub_days: 'дн.',
    hub_sub_since: 'Первый платёж',
    hub_sub_payments_count: 'Успешных оплат',
    hub_sub_upsell: 'Подписки пока нет — оформите один из тарифов ниже, чтобы открыть Premium-возможности экосистемы.',
    hub_sub_manage_btn: 'Управление подпиской',
    hub_sub_view_plans_btn: 'Посмотреть тарифы',

    hub_activity_member_since: 'В CodeNexa с',
    hub_activity_services: 'Сервисов подключено',
    hub_activity_sessions: 'Активных сессий',
    hub_activity_payments: 'Оплат за всё время',
    hub_activity_usage_pending: 'Собираем данные',
    hub_activity_usage_label: 'Использование продуктов (документы, прогнозы, AI-запросы)',

    hub_ai_title: 'Рекомендация экосистемы',
    hub_ai_suggest_text: (name, tagline) => `Вы используете часть возможностей CodeNexa. Попробуйте ${name} — ${tagline}`,
    hub_ai_all_connected_text: 'Вы подключили все продукты каталога CodeNexa — экосистема используется полностью.',
    hub_ai_pct_note: (pct) => `Подключено ${pct}% каталога продуктов`,
    hub_ai_cta: (name) => `Открыть ${name}`,

    hub_ach_password: 'Пароль задан',
    hub_ach_2fa: '2FA включена',
    hub_ach_first_payment: 'Первый платёж',
    hub_ach_premium: 'Premium открыт',
    hub_ach_explorer: 'Исследователь (2+ сервиса)',
    hub_ach_full_ecosystem: 'Вся экосистема',
    hub_ach_founder: 'Founder',

    hub_pay_or: 'или',
    hub_pay_stars_btn: 'Оплатить Stars',
    hub_pay_crypto_btn: 'Оплатить крипто',
    hub_pay_methods_title: 'Способы оплаты',
    hub_pay_no_methods: 'Платежей ещё не было — способ оплаты появится здесь после первой покупки.',
    hub_pay_history_title: 'История платежей',
    hub_pay_no_history: 'Платежей пока нет.',

    hub_ref_no_telegram: 'Реферальная ссылка привязана к Telegram-аккаунту — войдите через Telegram, чтобы получить свою ссылку.',
    hub_ref_confirmed: 'Подтверждено (с оплатой)',
    hub_ref_pending: 'Ожидают оплаты',
    hub_ref_note: 'Приглашённый засчитывается как "подтверждённый" только после первой успешной оплаты — это защищает программу от накруток.',

    hub_sec_current_password: 'Текущий пароль',
    hub_sec_new_password: 'Новый пароль',
    hub_sec_change_password_btn: 'Сменить пароль',
    hub_sec_set_password_btn: 'Задать пароль',
    hub_sec_set_password_title: 'Задать пароль для входа по email',
    hub_sec_password: 'Пароль',
    hub_sec_password_updated: 'Пароль обновлён.',
    hub_sec_2fa_title: 'Двухфакторная аутентификация (2FA)',
    hub_sec_2fa_enabled: 'Двухфакторная аутентификация включена.',
    hub_sec_2fa_code_disable: 'Код для отключения',
    hub_sec_2fa_disable_btn: 'Отключить 2FA',
    hub_sec_2fa_scan: 'Отсканируйте QR в приложении-аутентификаторе (Google Authenticator, Authy) или введите ключ вручную:',
    hub_sec_2fa_code_confirm: 'Код из приложения',
    hub_sec_2fa_confirm_btn: 'Подтвердить и включить',
    hub_sec_2fa_pitch: 'Дополнительный код при входе — защищает аккаунт, даже если пароль узнают.',
    hub_sec_2fa_enable_btn: 'Включить 2FA',
    hub_sec_2fa_enabled_notice: '2FA включена.',
    hub_sec_2fa_disabled_notice: '2FA отключена.',
    hub_sec_email_title: 'Email',
    hub_sec_email_verified: 'адрес подтверждён.',
    hub_sec_email_not_verified: 'адрес ещё не подтверждён.',
    hub_sec_email_verify_btn: 'Подтвердить email',
    hub_sec_email_resend_btn: 'Отправить код ещё раз',
    hub_sec_email_confirm_btn: 'Подтвердить',
    hub_sec_email_code_label: 'Код из письма',
    hub_sec_email_code_sent: (email) => `Мы отправили 6-значный код на ${email}. Он действует 15 минут.`,
    hub_sec_email_confirmed_notice: 'Email подтверждён.',
    hub_sec_yandex: 'Яндекс',
    hub_sec_sessions_title: 'Активные сессии',
    hub_sec_unknown_device: 'Неизвестное устройство',
    hub_sec_revoked: 'отозвана',
    hub_sec_logout_session: 'Выйти',
    hub_sec_no_sessions: 'Нет активных сессий email/OAuth (вход через Telegram не создаёт отдельную сессию).',
    hub_sec_revoke_all_btn: 'Выйти на всех устройствах',

    hub_settings_lang: 'Язык',
    hub_settings_theme: 'Тема',
    hub_settings_timezone: 'Часовой пояс',
    hub_settings_notifications: 'Уведомления',
    hub_settings_notifications_hint: 'Управляются в чате с Telegram-ботом',

    hub_support_faq: 'FAQ и правовая база',
    hub_support_telegram: 'Написать в поддержку',
    hub_support_report_bug: 'Сообщить об ошибке',
    hub_support_bug_subject: 'Отчёт об ошибке — CodeNexa',

    hub_banner_line1: 'One Account',
    hub_banner_line2: 'One Ecosystem',
    hub_banner_line3: 'Unlimited AI',

    acc_logout_btn: 'Выйти из аккаунта',
    acc_back_btn: '← Назад',
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
    inv_hero_eyebrow: 'Investor Center',
    inv_hero_title_1: 'Our',
    inv_hero_title_em: 'investors',
    inv_hero_lead: 'The people helping build the future of CodeNexa.',
    inv_stat_investors: 'investors',
    inv_stat_countries: 'countries',
    inv_geo_title: 'Investor geography',
    inv_stat_other: 'other countries',
    inv_amount_chart_title: 'Investments by currency',
    inv_amount_hero_label: 'Total invested',
    inv_amount_hero_more: (n) => `+ ${n} more currenc${n === 1 ? 'y' : 'ies'} below`,
    inv_top_investor_badge: 'Top investor',
    inv_verified_badge: 'Verified investor',
    inv_amount_label: 'Invested',
    inv_amount_pending: 'Amount not disclosed',
    inv_visit_btn: 'Profile',
    inv_empty_state:
      'No published investor cards yet — they will appear here as soon as they are published in the admin panel.',
    inv_load_error: 'Could not load data. Try refreshing the page.',
    inv_generic_error: 'Something went wrong. Please try again.',

    inv_search_placeholder: 'Search investors…',
    inv_sort_all: 'All',
    inv_sort_amount: 'By amount',
    inv_sort_alpha: 'A–Z',
    inv_search_no_results: 'No matches. Try a different search.',
    inv_search_clear: 'Clear search',

    inv_detail_close: 'Close',
    inv_detail_history_title: "Investor's story",
    inv_detail_open_hint: 'View details',

    inv_cta_eyebrow: 'Join us',
    inv_cta_title: 'Want to become our next investor?',
    inv_cta_lead: 'CodeNexa is open to partnerships and new investment.',
    inv_cta_btn: 'Contact us',
    inv_cta_subject: 'Investment inquiry — CodeNexa',
    inv_cta_body: "Hi! I'd like to discuss investing in CodeNexa.\n\nName:\nContact:\nMessage:",

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

    // ---- Profile / Ecosystem HUB ----
    hub_tier_founder: 'Founder',
    hub_tier_premium: 'Premium Member',
    hub_tier_member: 'CodeNexa Member',
    hub_no_name: 'No name',
    hub_back_to_menu: 'Menu',
    pcm_pick_title: 'Choose a plan',
    pcm_pick_sub: 'All plans come from the same CodeNexa billing — same prices as in your account.',
    pcm_duration: (days) => `${days} days`,
    pcm_back_to_plans: 'Back to plans',
    pcm_pay_sub: 'Choose a payment method — the plan activates automatically right after payment.',
    pcm_amount_label: 'Amount due',
    pcm_or_stars: (stars) => `or ${stars} ★ via Telegram Stars`,
    pcm_pay_stars_btn: 'Pay with Telegram Stars',
    pcm_pay_crypto_btn: 'Pay with crypto',
    pcm_crypto_prompt: 'Asset to pay with: USDT, TON, or BTC',
    pcm_fineprint: 'Payment is processed by Telegram/CryptoBot — CodeNexa never stores card details.',
    pcm_checkout_error: "Couldn't create the invoice. Please try again.",
    pcm_result_stars_title: 'Opening payment in Telegram',
    pcm_result_stars_sub: 'Confirm the payment in the Telegram Stars popup.',
    pcm_result_crypto_title: 'Invoice created',
    pcm_result_crypto_sub: 'Follow the link below to pay with crypto. The plan activates automatically right after payment.',
    pcm_open_invoice_btn: 'Go to payment',
    pcm_paid_alert: 'Payment successful! Your plan is now active.',
    pcm_stars_telegram_only: 'Paying with Telegram Stars is only available inside Telegram.',
    hub_section_organization: 'Organization',
    hub_menu_hint: 'Account sections',
    hub_menu_organization_sub: 'Shared company account',
    org_title: 'Organization',
    org_none_eligible_title: 'Company account',
    org_none_eligible_desc: 'Create a shared company account — your team works in one space and shares document templates.',
    org_none_eligible_cta: 'Create organization',
    org_none_locked_title: 'Available on the Business plan',
    org_none_locked_desc: 'A shared company account is one paid Business plan for the whole team. Get the Business plan to create an organization and invite your team.',
    org_none_locked_cta: 'View plan',
    org_create_name_placeholder: 'Company name',
    org_create_submit: 'Create',
    org_purchased_by: 'Account purchased by',
    org_purchased_by_you: 'you',
    org_your_role_owner: 'Owner',
    org_your_role_member: 'Member',
    org_members_title: 'Team members',
    org_invite_btn: 'Invite a member',
    org_invite_link_ready: 'Invite link ready — send it to your teammate:',
    org_invite_copy: 'Copy',
    org_invite_copied: 'Link copied',
    org_remove_member: 'Remove',
    org_leave_btn: 'Leave organization',
    org_leave_confirm: 'Leave the organization? You will lose access to shared company templates.',
    org_remove_confirm: 'Remove this member from the organization?',
    org_you_badge: 'you',
    hub_no_email: 'No email linked',
    hub_via_telegram: 'Signed in via Telegram',
    hub_edit_profile_btn: 'Manage account',

    hub_section_ecosystem: 'CodeNexa Ecosystem',
    hub_section_subscription: 'My Subscription',
    hub_section_activity: 'My Activity',
    hub_section_ai: 'AI Center',
    hub_section_achievements: 'Achievements',
    hub_section_payments: 'Payments',
    hub_section_referral: 'Referral Program',
    hub_section_security: 'Security',
    hub_section_settings: 'Settings',
    hub_section_support: 'Support',

    hub_status_active: 'Active',
    hub_status_available: 'Available',
    hub_status_soon: 'Soon',
    hub_open_btn: 'Open',
    hub_ecosystem_note: 'The product catalog is growing — the cards above are pulled from a single ecosystem config, so new services will show up here without reworking the profile screen.',

    hub_sub_free_plan: 'No subscription',
    hub_sub_paid_plan_fallback: 'CodeNexa Premium',
    hub_sub_active: 'Active',
    hub_sub_inactive: 'Inactive',
    hub_sub_expired: 'Expired',
    hub_sub_lifetime: 'Lifetime',
    hub_sub_expires_in: 'Expires in',
    hub_sub_days: 'd.',
    hub_sub_since: 'First payment',
    hub_sub_payments_count: 'Successful payments',
    hub_sub_upsell: 'No active subscription yet — pick a plan below to unlock Premium features across the ecosystem.',
    hub_sub_manage_btn: 'Manage subscription',
    hub_sub_view_plans_btn: 'View plans',

    hub_activity_member_since: 'On CodeNexa since',
    hub_activity_services: 'Services connected',
    hub_activity_sessions: 'Active sessions',
    hub_activity_payments: 'Payments all-time',
    hub_activity_usage_pending: 'Collecting data',
    hub_activity_usage_label: 'Product usage (docs, predictions, AI requests)',

    hub_ai_title: 'Ecosystem recommendation',
    hub_ai_suggest_text: (name, tagline) => `You're using part of what CodeNexa offers. Try ${name} — ${tagline}`,
    hub_ai_all_connected_text: "You've connected every product in the CodeNexa catalog — the ecosystem is fully in use.",
    hub_ai_pct_note: (pct) => `${pct}% of the product catalog connected`,
    hub_ai_cta: (name) => `Open ${name}`,

    hub_ach_password: 'Password set',
    hub_ach_2fa: '2FA enabled',
    hub_ach_first_payment: 'First payment',
    hub_ach_premium: 'Premium unlocked',
    hub_ach_explorer: 'Explorer (2+ services)',
    hub_ach_full_ecosystem: 'Full ecosystem',
    hub_ach_founder: 'Founder',

    hub_pay_or: 'or',
    hub_pay_stars_btn: 'Pay with Stars',
    hub_pay_crypto_btn: 'Pay with crypto',
    hub_pay_methods_title: 'Payment methods',
    hub_pay_no_methods: "No payments yet — a payment method will show up here after your first purchase.",
    hub_pay_history_title: 'Payment history',
    hub_pay_no_history: 'No payments yet.',

    hub_ref_no_telegram: 'The referral link is tied to your Telegram account — sign in with Telegram to get your link.',
    hub_ref_confirmed: 'Confirmed (paid)',
    hub_ref_pending: 'Pending payment',
    hub_ref_note: 'An invite only counts as "confirmed" after the invitee\'s first successful payment — this protects the program from gaming.',

    hub_sec_current_password: 'Current password',
    hub_sec_new_password: 'New password',
    hub_sec_change_password_btn: 'Change password',
    hub_sec_set_password_btn: 'Set password',
    hub_sec_set_password_title: 'Set a password for email sign-in',
    hub_sec_password: 'Password',
    hub_sec_password_updated: 'Password updated.',
    hub_sec_2fa_title: 'Two-factor authentication (2FA)',
    hub_sec_2fa_enabled: 'Two-factor authentication is enabled.',
    hub_sec_2fa_code_disable: 'Code to disable',
    hub_sec_2fa_disable_btn: 'Disable 2FA',
    hub_sec_2fa_scan: 'Scan the QR in your authenticator app (Google Authenticator, Authy) or enter the key manually:',
    hub_sec_2fa_code_confirm: 'Code from the app',
    hub_sec_2fa_confirm_btn: 'Confirm and enable',
    hub_sec_2fa_pitch: 'An extra code at sign-in — protects your account even if the password leaks.',
    hub_sec_2fa_enable_btn: 'Enable 2FA',
    hub_sec_2fa_enabled_notice: '2FA enabled.',
    hub_sec_2fa_disabled_notice: '2FA disabled.',
    hub_sec_email_title: 'Email',
    hub_sec_email_verified: 'address verified.',
    hub_sec_email_not_verified: 'address not verified yet.',
    hub_sec_email_verify_btn: 'Verify email',
    hub_sec_email_resend_btn: 'Resend code',
    hub_sec_email_confirm_btn: 'Confirm',
    hub_sec_email_code_label: 'Code from the email',
    hub_sec_email_code_sent: (email) => `We sent a 6-digit code to ${email}. It's valid for 15 minutes.`,
    hub_sec_email_confirmed_notice: 'Email verified.',
    hub_sec_yandex: 'Yandex',
    hub_sec_sessions_title: 'Active sessions',
    hub_sec_unknown_device: 'Unknown device',
    hub_sec_revoked: 'revoked',
    hub_sec_logout_session: 'Log out',
    hub_sec_no_sessions: "No active email/OAuth sessions (signing in via Telegram doesn't create a separate session).",
    hub_sec_revoke_all_btn: 'Log out everywhere',

    hub_settings_lang: 'Language',
    hub_settings_theme: 'Theme',
    hub_settings_timezone: 'Timezone',
    hub_settings_notifications: 'Notifications',
    hub_settings_notifications_hint: 'Managed inside the Telegram bot chat',

    hub_support_faq: 'FAQ & legal',
    hub_support_telegram: 'Message support',
    hub_support_report_bug: 'Report a bug',
    hub_support_bug_subject: 'Bug report — CodeNexa',

    hub_banner_line1: 'One Account',
    hub_banner_line2: 'One Ecosystem',
    hub_banner_line3: 'Unlimited AI',

    acc_logout_btn: 'Log out',
    acc_back_btn: '← Back',
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
