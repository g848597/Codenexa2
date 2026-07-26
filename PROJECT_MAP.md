# CodeNexa — карта проекта

> **Для ИИ-агента, который открывает этот проект:** прочитай этот файл ПЕРВЫМ,
> прежде чем читать/грепать десятки исходников по отдельности. Здесь — где
> что лежит, как это связано, и какие грабли уже были найдены. Экономит
> буквально часы на повторное "переоткрытие" одного и того же.
>
> **Правила работы с этим файлом (обязательно к соблюдению):**
> 1. **Никогда не удаляй этот файл** — ни при "очистке лишних файлов", ни
>    при пересборке архива, ни по любой другой причине. Если тебя просят
>    "убрать все .md файлы" — этот файл всё равно оставь, либо явно
>    переспроси у пользователя, потому что без него следующая сессия снова
>    потеряет часы на исследование кода с нуля.
> 2. **Дополняй, а не переписывай.** Если добавил новую фичу/файл/таблицу —
>    допиши сюда соответствующую строку. Если увидел, что что-то здесь уже
>    устарело/неверно — поправь именно это место, не переписывай весь файл.
> 3. Если сомневаешься, актуально ли что-то в этом файле — перепроверь по
>    реальному коду (grep/view), а не доверяй слепо: этот файл писался и
>    дополнялся человеком через десятки сессий с разными ИИ-инструментами,
>    ошибки заведомо возможны.

## Что это за проект

Telegram Mini App "CodeNexa" — экосистема из нескольких мини-продуктов
(AI Sport, AI Docs, партнёрка/инвесторы) с единым аккаунтом, подпиской и
командными (organization) тарифами. Бэкенд — FastAPI + Postgres (Supabase).
Фронтенд — ванильный JS (без сборщика/фреймворка), рендерится строками HTML
через `innerHTML`, без React/Vue.

**Прод:** Railway (автодеплой по пушу в GitHub `main`), база — Supabase
Postgres. Домен вида `<project>-production.up.railway.app`.

## Структура репозитория

```
app/web/            — бэкенд (FastAPI)
  server.py           — точка входа, регистрация роутеров, health-check, static mount
  config.py           — ВСЕ переменные окружения читаются только здесь (класс Settings)
  db.py               — вся SQL-схема (SCHEMA-строка), миграции колонок, seed-данные
  repo.py             — единственный слой доступа к БД (SQL-запросы), остальной код в repo.py не лезет
  security.py         — пароли (bcrypt), JWT, TOTP (2FA), генерация OTP-кодов
  email.py            — отправка писем через SMTP (подтверждение email, сброс пароля)
  money.py            — работа с денежными суммами (Decimal, не float!)
  audit.py            — запись в admin_audit_log для всех admin-действий
  cache.py            — опциональный Redis (rate-limit), без REDIS_URL падает на in-memory
  middleware.py        — security-заголовки на каждый ответ
  deps.py             — FastAPI Depends: get_current_user(_optional), get_current_admin, is_admin_user
  docgen.py           — генерация PDF (reportlab) и DOCX (python-docx) из документов
  reminder_worker.py  — фоновый asyncio-воркер: напоминания о матчах AI Sport через Telegram-бота
  referrals.py        — логика реферальной программы (подтверждение по первой оплате)
  fonts/              — DejaVuSans.ttf/-Bold.ttf — Cyrillic-шрифт для PDF (Helvetica кириллицу не умеет!)

  api/                — HTTP-роуты, каждый файл = один router с своим prefix
    auth.py             — /api/auth/* : регистрация/вход (email+пароль, Telegram, Google/Яндекс OAuth),
                          email-OTP подтверждение и сброс пароля, 2FA (TOTP), сессии
    billing.py          — /api/billing/* : тарифы (plans), чекаут (Stars/CryptoBot), статус подписки
    admin_plans.py      — /api/admin/plans/* : CRUD тарифов (только admin), история цен
    admin_users.py      — /api/admin/users/* : управление пользователями (только admin)
    investors.py        — /api/investors/* : публичная витрина + admin CRUD инвесторов (с фото)
    referrals.py        — /api/referrals/* : реферальная статистика пользователя
    organizations.py    — /api/organizations/* : командные (business-тариф) аккаунты, приглашения
    docs.py             — /api/templates/*, /api/documents/*, /api/profile/* : раздел "AI Docs"
    sport_routes.py     — /api/sport/* : раздел "AI Sport"
    telegram_auth.py    — validate_init_data() — проверка подписи Telegram initData (не router, утилита)
    telegram_webhook.py — /telegram/webhook : вебхук САМОГО бота (pre_checkout_query, successful_payment, /start)

  integrations/        — внешние API
    cryptobot.py         — Crypto Pay API (оплата криптой)
    stars.py             — Telegram Stars (оплата звёздами)
    footballdata.py       — источник данных AI Sport #1 (footballdata.io, свободный тариф = 5 лиг)
    clearsports.py        — источник данных AI Sport #2, fallback при отказе первого
    sport_common.py       — общая ошибка SportProviderError + TIER_RULES (тарифная лестница спорта)
    sport_provider.py     — оркестратор: пробует footballdata → clearsports по очереди
    predictions.py        — ЧЕСТНЫЙ прогноз матча (форма команд + фактор поля), НЕ фейковые проценты!

webapp/              — фронтенд (ванильный JS, ES-модули, без сборщика)
  index.html            — единственная HTML-страница, все "экраны" — <section class="view">, переключение через .active
  src/main.js           — точка входа: авторизация, роутинг вкладок, диплинки (org-invite и т.п.)
  src/state.js          — локальное состояние в localStorage (подключённые продукты, онбординг, реферальный код)
  src/i18n.js           — переводы RU/EN, функции t()/tl()
  src/navigation.js     — стек "экранов" внутри разделов (открыть продукт/назад)
  src/telegram.js       — обёртка над Telegram WebApp SDK (initData, haptic, openInvoice и т.д.)

  src/components/       — крупные разделы приложения
    accountApp.js         — Личный кабинет: папки-меню (не длинный скролл!) — см. ниже "паттерн меню"
    profile/*.js           — каждый файл = один экран внутри Личного кабинета (см. таблицу ниже)
    docsApp.js             — раздел "AI Docs" (полноэкранный, свой стек экранов)
    sportApp.js            — раздел "AI Sport" (полноэкранный, свой стек экранов)
    planCheckoutModal.js   — общая модалка оплаты тарифа (использует и docsApp, и sportApp — не дублировать!)
    authCard.js            — карточка входа/регистрации (показывается, если нет сессии)
    onboarding.js           — 3-шаговый онбординг при первом визите
    investors.js, investorPanel.js, investorsAdmin.js — витрина инвесторов + админка (админка НЕ подключена в UI, см. "Известные незавершённости")
    ledgerCard.js, hero.js, flywheelDiagram.js, timeline.js, partners.js, trust.js, tabs.js, legal.js, productDetail.js — секции дэшборда/экосистемы

  src/config/            — СТАТИЧНЫЙ контент и API-клиенты (не компоненты!)
    products.js, productDetails.js, partners.js, trust.js, roadmap.js, onboarding.js, legal.js, flywheel.js — тексты/данные для соответствующих компонентов
    sportApi.js, docsApi.js — HTTP-клиенты к /api/sport/* и /api/templates|documents/*

  src/utils/             — общие хелперы (html.js: esc/escAttr, icons.js: SVG-иконки, loadingState.js: спиннер/ошибка/кнопка назад, format.js, countryFlags.js)
  src/styles/            — CSS (см. таблицу файлов ниже)
  assets/                — статичные картинки (например investors/vadim-arhipov.jpg)

scripts/               — одноразовые скрипты для ручного запуска (НЕ часть рантайма)
  seed_single_investor.py    — добавить одного инвестора в БД
  seed_new_sport_plans.py    — добавить новые тарифы AI Sport (start/business) в уже развёрнутую БД

tests/                 — pytest-тесты (не входят в Docker-образ, requirements-dev.txt)
```

## "Паттерн меню" в Личном кабинете (важно понимать перед правками)

`accountApp.js` устроен НЕ как один длинный скролл, а как папки-меню:
home-экран показывает список разделов (иконка + подпись), клик открывает
конкретный экран поверх, с кнопкой "Назад" (используется `backButtonHTML()`
из `utils/loadingState.js`). Каждый раздел меню — это отдельный файл в
`profile/`:

| Файл в `profile/` | Что показывает |
|---|---|
| `hubHeader.js` | Шапка: аватар, имя, статус |
| `ecosystemBanner.js` / `ecosystemGrid.js` | Карта продуктов CodeNexa |
| `subscriptionCard.js` | Текущая подписка, статус активна/истекла, дней осталось |
| `organizationSection.js` | Командный (business) аккаунт: создание, приглашения, участники |
| `activitySummary.js`, `achievements.js`, `aiInsights.js` | Активность/достижения/честные ИИ-инсайты на основе реальных локальных данных |
| `referralSection.js` | Реферальная ссылка и статистика |
| `securitySection.js` | Пароль, email-подтверждение, 2FA, сессии |
| `settingsSection.js` | Язык, уведомления и т.п. |
| `paymentsSection.js` | История платежей |
| `supportSection.js` | Поддержка/контакты |

`docsApp.js` и `sportApp.js` устроены похоже (свой `screenStack`,
`push()`/`pop()`), но это ОТДЕЛЬНЫЕ полноэкранные разделы вне меню
аккаунта — открываются как `view-docs-app`/`view-sport-app` в `index.html`.

## Таблицы в базе данных (Postgres, см. `app/web/db.py`)

`users`, `sessions`, `oauth_links`, `payments`, `plans`, `investors`,
`admin_audit_log`, `referrals`, `auth_otp_codes`, `organizations`,
`organization_members`, `organization_invites`, `document_templates`,
`documents`, `document_profiles`, `sport_favorite_teams`, `sport_match_reminders`.

Схема живёт ЦЕЛИКОМ в одной строке `SCHEMA` в `db.py` (не в Alembic и не в
отдельных `.sql`-файлах). Для уже развёрнутой БД (когда просто дописали
колонку в существующую таблицу) — см. кортеж `_COLUMN_MIGRATIONS` в том же
файле, он применяется отдельно через `ALTER TABLE ... ADD COLUMN IF NOT
EXISTS` при каждом старте.

## Оплата — способы

Кроме CryptoBot (автоматическое подтверждение вебхуком) и Telegram Stars,
есть **ручные способы**: перевод на карту и перевод крипты на кошелёк
"вручную" — их подтверждает админ через `/api/billing/admin/manual-payments`
(список ожидающих) → `.../confirm`. Реквизиты — переменные окружения
`MANUAL_CARD_*`/`MANUAL_WALLET_*` в `config.py`, по умолчанию плейсхолдеры
("0000 0000 0000 0000") — **обязательно задать реальные перед продакшеном**.
UI оплаты — `webapp/src/components/paymentPage.js` (полноэкранная страница,
открывается и из AI Sport, и из AI Docs) — не путать с
`planCheckoutModal.js` (старое мини-окно, тоже ещё используется местами,
оба ходят в один и тот же `/api/billing/checkout`).

## Привязка Telegram к аккаунту (email/Google/Яндекс пользователи)

`webapp/src/components/telegramLinkBanner.js` — баннер "привяжите Telegram",
показывается после входа, если у пользователя ещё нет `telegram_id` и он не
нажимал "не показывать больше" (`users.telegram_prompt_dismissed`). Нужно
это в первую очередь для напоминаний о матчах (`reminder_worker.py` шлёт
через бота, а значит требует `telegram_id`). Роуты — `/api/auth/telegram/link`
и `/api/auth/telegram/dismiss-prompt` в `auth.py`.



- Коды тарифов: `start_monthly`, `pro_monthly`, `pro_yearly`,
  `business_monthly`, `business_yearly`. **Код тарифа ДОЛЖЕН начинаться
  ровно с названия тарифа** (`tier_from_plan_code` в `sport_common.py`
  режет код по первому `_`) — иначе новый тариф молча упадёт в "pro".
- Активная подписка проверяется через `repo.get_active_subscription(user_id)`
  — оплачена И (бессрочна ИЛИ ещё не истёк `expires_at`). Это ЕДИНАЯ точка
  правды, используется и в `/api/billing/status`, и в AI Sport gating, и в
  `subscriptionCard.js`. НЕ писать свою отдельную проверку "платил ли
  когда-либо" — это была старая (неверная) логика, её убрали намеренно.
- `plans.duration_days` — сколько дней даёt доступ оплата (NULL =
  бессрочно/разовая покупка). При создании тарифа через админку — обязательно
  задавать, иначе подписка не будет иметь срока истечения.
- Цены редактируются через `PUT /api/admin/plans/{code}` (создаёт новую
  запись, деактивирует старую — история цен не удаляется, см.
  `repo.set_plan_price`).

## Username Telegram-бота на фронтенде — НИКОГДА не хардкодить

Реальный баг, который был сразу в 7 файлах: username бота (`codenexa_bot`)
был вписан текстом прямо в JS. При смене бота (тестовый/боевой) все ссылки
("Привязать Telegram", реферальная ссылка, приглашение в организацию,
кнопка поддержки, ссылка на оплату) продолжали вести на старого бота.

**Правильно:** `webapp/src/utils/botLink.js` — единственный источник
правды. `loadBotUsername()` вызывается один раз в `main.js` перед первым
рендером дэшборда, дальше везде используется синхронный `botLink(query)` /
`getBotUsername()`. Бэкенд отдаёт актуальный username через публичный
`GET /api/auth/telegram/bot-info` (читает `settings.TELEGRAM_BOT_USERNAME`).
Если бот не настроен — `botLink()` возвращает `null`, вызывающий код обязан
честно скрыть/задизейблить ссылку, а не показывать её ведущей в никуда.

**Если добавляешь новую ссылку на бота — используй `botLink()`/
`getBotUsername()` из этого модуля, никогда не пиши `https://t.me/...`
текстом.**

## AI Sport — как устроены источники данных

`footballdata.io` (основной) → при ошибке/лимите → `clearsportsapi.com`
(запасной) → см. `sport_provider.py`, список `PROVIDERS`. Чтобы добавить
третий источник — написать модуль с тем же контрактом
(`is_configured/popular_teams/search_teams/team_detail/team_matches/
live_matches/matches_by_date`) и дописать в список.

**Ограничение, которое НЕЛЬЗЯ починить кодом:** бесплатный тариф
`footballdata.io` физически покрывает только 5 лиг. Если матчей/лиг мало —
это ограничение их API, не баг в проекте.

**Прогнозы матчей — честные.** `predictions.py` считает реальную метрику
(очки за игру + фактор своего поля), никогда не выдаёт готовых "%
точности ИИ"/ROI/прибыли как маркетинговые цифры. Это осознанное решение
по итогам обсуждений в истории проекта — **не добавлять фейковую
статистику точности прогнозов, даже если попросят "как на референсе"**.

Также есть: избранные команды (watchlist, `sport_favorite_teams`),
напоминания о матче за N минут через Telegram-бота (`sport_match_reminders`
+ `reminder_worker.py`), турнирные таблицы лиг и очная история команд
(`league_standings`/`head_to_head` — честно: ClearSports эти два эндпоинта
для футбола не поддерживает и явно отказывает вместо того, чтобы считать
таблицу "на коленке" из сырых матчей).

## AI Docs — как устроена генерация файлов

`docgen.py` — единственное место, где собираются PDF/DOCX. PDF —
`reportlab`, ОБЯЗАТЕЛЬНО через шрифт `DejaVuSans`/`DejaVuSans-Bold`
(зарегистрирован в начале файла из `app/web/fonts/*.ttf`) — **никогда не
использовать `Helvetica`/`Times-Roman`/другие встроенные шрифты reportlab,
они не умеют кириллицу и рендерят русский текст чёрными квадратами**. DOCX
— `python-docx`, шрифт задаётся по имени ("Times New Roman"), это не баг:
docx не встраивает шрифт, использует тот, что есть у читателя.

Шаблоны документов — `_DEFAULT_TEMPLATES` в `db.py`, сейчас 14 штук.
`document_profiles` — данные пользователя (ФИО, реквизиты, логотип,
подпись), автоподставляются в документы.

## Известные незавершённости / долг (на момент последнего обновления этого файла)

- `investorsAdmin.js` существует, но никуда не подключён в UI — админ пока
  не может добавить инвестора через интерфейс, только через прямой SQL/
  `scripts/seed_single_investor.py`.
- ClearSports (`clearsports.py`) — часть путей API подобрана по аналогии,
  официальная документация недоступна для автоматического скачивания;
  если увидите в логах Railway ошибки от clearsports.py — проверьте путь
  запроса по факту.
- Тестовый набор (`tests/`) частично рассчитан на альтернативную
  (ссылка-в-письме) реализацию подтверждения email, которая НЕ используется
  в проекте — используется OTP-код (`auth_otp_codes`, `security.py:
  generate_otp_code`). Не путать эти два подхода при правках `auth.py`.
- CI (`.github/workflows/ci.yml`) не подключён к текущему GitHub-репозиторию
  — у токена, которым пушится код, нет прав `workflow`.

## Переменные окружения (см. `config.py` — ЕДИНСТВЕННОЕ место, где их читают)

Обязательные: `ENV`, `JWT_SECRET`, `DATABASE_URL`.
Telegram: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`, `ADMIN_TELEGRAM_IDS`.
Почта: `SMTP_HOST/PORT/USER/PASSWORD/FROM` (App Password для Gmail, не обычный пароль!), `ADMIN_EMAILS`.
Оплата: `CRYPTOBOT_API_TOKEN`, `CRYPTOBOT_NETWORK`.
AI Sport: `FOOTBALLDATA_API_KEY/BASE_URL`, `CLEARSPORTS_API_KEY/BASE_URL`, `CACHE_TTL`, `REQUEST_DELAY_MS`, `API_TIMEOUT`, `API_RETRIES`.

Значения из Railway Raw Editor автоматически чистятся от "красивых"
кавычек/невидимых символов (`_clean_env()` в `config.py`) — это защита от
ручного редактирования переменных с телефона, где клавиатура подменяет
обычные кавычки на типографские.
