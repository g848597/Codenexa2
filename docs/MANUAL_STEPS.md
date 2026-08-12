# MANUAL STEPS — что нужно сделать руками

Этот файл — единственное место, куда я (ассистент) добавляю шаги, которые
не могу выполнить сам из своей песочницы (нет сети до supabase.co,
api.telegram.org, railway.app). Отмечай выполненное `[x]`, обновляю файл
по мере продвижения по этапам.

---

## 1. База данных (Supabase SQL Editor)

Открой https://supabase.com/dashboard → проект `vlpgdiivliozzhacymaw` → **SQL Editor**.

- [ ] Выполнить `migrations/0001_nexa_core.sql` целиком (создаёт все таблицы `nexa_*`, старые таблицы не трогает — безопасно перезапускать, использует `IF NOT EXISTS`).
- [ ] Выполнить `migrations/0002_nexa_seed_demo_module.sql` (добавляет demo-модуль для проверки Module Registry).
- [ ] Проверить, что появились таблицы: `nexa_users`, `nexa_modules`, `nexa_user_modules`, `nexa_favorites`, `nexa_projects`, `nexa_history`, `nexa_notifications`, `nexa_settings`.
- [ ] Проверить, что старые таблицы (`services`, `bookings`, `working_hours`, `admin_users`, `audit_log`, `blocked_slots`, `booking_attempts`, `breaks`, `reviews`, `settings`) остались без изменений.

## 2. Railway — backend сервис

- [ ] Создать новый Railway-сервис на этот же репозиторий (`g848597/Codenexa2`), ветка `main`, root — корень репо (там `Procfile` и `railway.json`).
- [ ] Задать переменные окружения в Railway → Variables:
  - `DATABASE_URL` — строка подключения к Supabase Postgres (Transaction Pooler, порт 6543 — та же, что использовалась для лендинга Снежаны, либо новая, если хочешь изолировать).
  - `TELEGRAM_BOT_TOKEN` — токен твоего бота (у тебя уже есть).
  - `CORS_ORIGINS` — origin фронтенда после деплоя (например `https://<твой-фронтенд-домен>.up.railway.app`). Можно временно добавить и `http://localhost:5173` через запятую для локальной разработки.
  - `JWT_SECRET` — любая длинная случайная строка (сгенерируй, например: `openssl rand -hex 32`). Никому не показывай, не коммить в git.
  - `SUPABASE_URL` — `https://vlpgdiivliozzhacymaw.supabase.co`
  - `SUPABASE_SERVICE_ROLE_KEY` — если backend будет напрямую дёргать Supabase REST/Storage (сейчас не используется, но пусть будет на будущее). **Только в Railway Variables, никогда не в коде.**
- [ ] После первого деплоя проверить `https://<backend-домен>/health` → должен вернуть `{"status":"ok"}`.
- [ ] Проверить `https://<backend-домен>/ready` → `database: true` (подтверждает, что `DATABASE_URL` рабочий).

## 3. Telegram — настройка Mini App

- [ ] В @BotFather: `/mybots` → выбрать бота → **Bot Settings → Menu Button** (или `/setmenubutton`) → указать URL фронтенда (появится после Этапа 5, когда сделаю frontend + Railway-деплой для него).
- [ ] Либо через `/newapp`, если нужен отдельный Mini App (не просто menu button).
- [ ] Проверить открытие Mini App внутри самого Telegram (не в обычном браузере) — только там будет настоящий `window.Telegram.WebApp` с реальным `initData`.

## 4. Frontend — Railway сервис (появится после Этапа 5)

- [ ] Создать отдельный Railway-сервис (или second service в этом же проекте Railway) для `frontend/` с `npm install && npm run build`, раздачей `dist/`.
- [ ] Задать `VITE_API_BASE_URL` = адрес backend-сервиса из шага 2.

## 5. Секреты — финальная проверка

- [ ] Убедиться, что `.env` (не `.env.example`) нигде не закоммичен — проверить `git log -p -- .env` пустой.
- [ ] Убедиться, что `TELEGRAM_BOT_TOKEN`, `JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` не встречаются в frontend-коде (`grep -r` по `frontend/src`).

---

*Обновляется по ходу работы. Последнее обновление: после Этапа 4 (backend + Telegram auth готовы и протестированы).*
