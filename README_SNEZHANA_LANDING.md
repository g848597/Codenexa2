# Снежана Утешева — Supabase-версия: инструкция по запуску

## 1. Создать проект Supabase

1. supabase.com → New project.
2. SQL Editor → выполнить `supabase/migrations/0001_init.sql` целиком.
3. Authentication → Providers → Email: включить, а также включить "Confirm email"
   и в Auth → Rate Limits ограничить попытки входа.
4. Authentication → Users → Add user — создать первого администратора (email + пароль).
5. В SQL Editor выполнить:
   ```sql
   insert into admin_users (id, email) values ('<uuid созданного пользователя>', '<email>');
   ```
   (uuid берётся со страницы пользователя в Authentication → Users)
6. (Рекомендуется) Auth → MFA — включить TOTP, чтобы у админа была 2FA.
7. (Рекомендуется, платный план) Database → Backups → включить Point-in-Time Recovery.

## 2. Задеплоить Edge Functions

Понадобится Supabase CLI (`npm install -g supabase`).

```bash
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase functions deploy create-booking
supabase functions deploy get-available-slots
```

Функции сами используют `SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY` — эти переменные
Supabase прокидывает в Edge Functions автоматически, вручную их задавать не нужно.

## 3. Переменные окружения Edge Functions (секреты)

Задать через `supabase secrets set`:

```bash
supabase secrets set TELEGRAM_BOT_TOKEN=123456:AA...   # опционально, для уведомлений в Telegram
```

Если используете email-уведомления вместо Telegram (Resend/SendGrid) — добавьте
соответствующий `RESEND_API_KEY` и допишите вызов в `notifyAdmin()` внутри
`supabase/functions/create-booking/index.ts`.

Как получить `telegram_chat_id`: создайте бота через @BotFather, получите
`TELEGRAM_BOT_TOKEN`, напишите боту любое сообщение, узнайте свой chat_id через
@userinfobot — впишите его в Настройки → Telegram chat_id в самой админке сайта.

## 4. Переменные во фронтенде (`index.html`)

Открыть `index.html`, в начале `<script>` найти и заменить:

```js
const SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR-ANON-PUBLIC-KEY';
```

Оба значения — из Project Settings → API. `anon` ключ публичный и безопасен
для фронтенда: реальная защита данных обеспечивается RLS-политиками в БД,
а не секретностью этого ключа. Секретный `service_role` ключ **никогда**
не должен попасть в `index.html` — он используется только внутри Edge Functions.

## 5. Что уже сделано из списка доработок (промпт, разделы 1–6)

- ✅ Таблицы, индексы, `EXCLUDE`-constraint против двойной записи на уровне БД.
- ✅ Авторизация админа полностью через Supabase Auth, пароль нигде не хранится в коде.
- ✅ RLS включён на всех таблицах; `bookings` не имеет anon-политик вовсе —
  создание записи возможно только через Edge Function на `service_role`.
- ✅ Audit log — автоматически через триггеры на `bookings`, `services`, `working_hours`,
  отображается в Настройках админки (последние 50 действий).
- ✅ `create-booking` и `get-available-slots` — серверный пересчёт слотов,
  клиент ничего не решает сам.
- ✅ Уведомление в Telegram при новой записи (опционально, через `TELEGRAM_BOT_TOKEN`).
- ✅ Серверная валидация имени/телефона/длины комментария в `create-booking`.
- ✅ Rate limiting на `create-booking` (5 попыток / 10 минут с одного IP,
  таблица `booking_attempts`).

## 6. Что осталось сделать отдельно (раздел 7 промпта, вне ядра архитектуры)

Эти пункты не блокируют запуск, но стоит закрыть до продакшна:

- **Капча** (Cloudflare Turnstile/hCaptcha) на форме записи — добавляется на фронте
  перед вызовом `create-booking`, токен передаётся в edge function и там же
  проверяется через API Turnstile/hCaptcha.
- **Изображения**: перенести с Unsplash в Supabase Storage, сжать в WebP.
- **SEO**: `sitemap.xml`, `robots.txt` (запретить `/admin`), дополнить `schema.org`
  разметку (`openingHours`, `address`, `telephone`) реальными данными.
- **Аналитика**: Яндекс.Метрика / GA4.
- **Напоминания клиентам** за 24 часа (Twilio/WhatsApp Business API) — отдельная
  Edge Function по расписанию (`pg_cron` + `supabase.functions.invoke`).
- **a11y**: проверить контраст `#8a8078` на фоне `#F5F0E8`, добавить `aria-label`
  на кнопки-иконки, проверить табуляцию в визарде записи.
- **Sentry** на фронт и Edge Functions.
- **CSP/HTTPS-заголовки** — настраиваются на уровне хостинга (Vercel/Netlify/Nginx),
  не в самом `index.html`.

## 7. Быстрая проверка перед запуском

1. Открыть `index.html` локально (или задеплоить на любой статический хостинг).
2. Попробовать записаться клиентом — должно дойти до Edge Function `create-booking`.
3. Открыть `/#admin/login`, войти под созданным админом, проверить, что запись видна.
4. Попробовать создать вторую запись на то же время — должна прийти ошибка
   «это время только что заняли» (`SLOT_TAKEN`).
