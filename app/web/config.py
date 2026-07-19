"""Единая точка загрузки конфигурации из .env — больше нигде в коде os.environ не читаем напрямую."""
import os
import secrets

from dotenv import load_dotenv

load_dotenv()

ENV = os.getenv("ENV", "development").strip().lower()  # "development" | "staging" | "production"


def _clean_env(name: str, default: str = "") -> str:
    """os.getenv() + защита от "красивых" кавычек и прочего мусора, который
    мобильные клавиатуры (Gboard и т.п.) подставляют вместо обычных символов
    при ручном вводе значений в Raw Editor Railway. Прямые кавычки Railway
    распознаёт и сам убирает как обрамление, а вот кавычки-ёлочки/лапки и
    прочие невидимые не-ASCII символы — нет, и они остаются частью значения,
    ломая любой HTTP-заголовок, где используются (см. чат: UnicodeEncodeError
    при обращении к внешнему API из-за этого). Ключи API и base URL по
    стандарту обязаны быть чистым ASCII — поэтому здесь безопасно срезать
    вообще все символы вне ASCII, а не только кавычки по краям.
    """
    value = os.getenv(name, default).strip().strip("\"'\u201c\u201d\u2018\u2019\u00ab\u00bb")
    return value.encode("ascii", errors="ignore").decode("ascii")


# Раунд 8 (аудит, раздел 9, "DevOps: нет staging-окружения"): ENV="staging"
# теперь первоклассное значение, не просто "ещё одна production-строка,
# которую никто не проверял". По требованиям безопасности (secure-cookie,
# HSTS, обязательный JWT_SECRET) staging ведёт себя ТАК ЖЕ, как production —
# это реальный интернет-доступный деплой, а не локальная разработка, и
# единственное окружение, где можно позволить себе незакреплённый
# JWT_SECRET/http-cookie — "development". Используйте settings.is_production_like()
# вместо прямого сравнения `ENV == "production"` в новом коде (модульная
# версия ниже нужна только потому, что JWT_SECRET резолвится ДО того, как
# создан объект settings — см. Settings.JWT_SECRET = _resolve_jwt_secret()).
def _is_production_like(env: str) -> bool:
    return env != "development"

# Технический долг из аудита (п.0.4): раньше при отсутствии JWT_SECRET он тихо
# генерировался заново на каждый рестарт процесса — это разлогинивало всех
# пользователей при каждом деплое и ломало авторизацию при >1 воркере (у
# каждого воркера был свой секрет). Теперь:
#   - в production отсутствие JWT_SECRET — фатальная ошибка при старте;
#   - в development секрет один раз генерируется и сохраняется в локальный
#     файл (не в .env, чтобы не путать с "настоящим" секретом), поэтому
#     сессии переживают `--reload` и обычные рестарты локального сервера.
_DEV_SECRET_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".dev_jwt_secret")


def _resolve_jwt_secret() -> str:
    value = os.getenv("JWT_SECRET", "").strip()
    if value:
        return value

    if _is_production_like(ENV):
        raise RuntimeError(
            "JWT_SECRET не задан в переменных окружения. В production/staging "
            "это фатальная ошибка (см. аудит, п.0.4): без фиксированного "
            "секрета все пользователи разлогиниваются при каждом рестарте/"
            "деплое, а при нескольких воркерах токены не будут совместимы "
            "между ними. Сгенерируйте: "
            "python -c \"import secrets; print(secrets.token_hex(32))\" "
            "и пропишите как JWT_SECRET в переменных окружения хостинга."
        )

    # Только для локальной разработки — персистентный фолбэк, не для прода.
    try:
        if os.path.isfile(_DEV_SECRET_FILE):
            with open(_DEV_SECRET_FILE, "r") as f:
                cached = f.read().strip()
                if cached:
                    return cached
        generated = secrets.token_hex(32)
        with open(_DEV_SECRET_FILE, "w") as f:
            f.write(generated)
        print(
            "[config] JWT_SECRET не задан — сгенерирован временный секрет для "
            f"локальной разработки и сохранён в {_DEV_SECRET_FILE} (не коммитить). "
            "Перед деплоем в production обязательно задайте JWT_SECRET явно."
        )
        return generated
    except OSError:
        # Файловая система недоступна (serverless и т.п.) — fallback in-memory,
        # но с явным предупреждением, а не молча.
        print("[config] ВНИМАНИЕ: не удалось сохранить dev JWT_SECRET на диск — "
              "используется временный секрет только для этого процесса.")
        return secrets.token_hex(32)


def _bool(name, default=False):
    val = os.getenv(name)
    if val is None:
        return default
    return val.strip().lower() in ("1", "true", "yes", "on")


class Settings:
    ENV = ENV

    SENTRY_DSN = os.getenv("SENTRY_DSN", "")

    TELEGRAM_BOT_TOKEN = _clean_env("TELEGRAM_BOT_TOKEN")
    TELEGRAM_BOT_USERNAME = _clean_env("TELEGRAM_BOT_USERNAME")
    TELEGRAM_WEBHOOK_SECRET = _clean_env("TELEGRAM_WEBHOOK_SECRET")

    CRYPTOBOT_API_TOKEN = _clean_env("CRYPTOBOT_API_TOKEN")
    CRYPTOBOT_NETWORK = _clean_env("CRYPTOBOT_NETWORK", "mainnet")
    # HMAC-подпись вебхуков CryptoBot проверяется этим секретом (см.
    # integrations/cryptobot.py::verify_webhook_signature). Это ТОТ ЖЕ токен,
    # что и CRYPTOBOT_API_TOKEN — так требует Crypto Pay API.
    CRYPTOBOT_WEBHOOK_SECRET = CRYPTOBOT_API_TOKEN

    # AI Sport (см. app/web/integrations/footballdata.py, app/web/api/sport_routes.py).
    # Источник — footballdata.io (документация: https://footballdata.io/documentation/).
    # Без ключа модуль работает в режиме "не настроено" — /api/sport/status
    # честно вернёт configured=false, фронтенд покажет соответствующее
    # сообщение вместо ошибки (см. sportApp.js).
    FOOTBALLDATA_API_KEY = _clean_env("FOOTBALLDATA_API_KEY")
    FOOTBALLDATA_BASE_URL = _clean_env("FOOTBALLDATA_BASE_URL", "https://footballdata.io/api/v1")
    # Второй источник в цепочке (см. app/web/integrations/sport_provider.py) —
    # подключается автоматически, когда footballdata.io исчерпает лимит или
    # ответит ошибкой.
    CLEARSPORTS_API_KEY = _clean_env("CLEARSPORTS_API_KEY")
    # ИСПРАВЛЕНО: реальные пути ClearSports начинаются с "/api/v1/..." — без
    # сегмента "/api" каждый запрос ловил 404 (подтверждено проверкой).
    CLEARSPORTS_BASE_URL = _clean_env("CLEARSPORTS_BASE_URL", "https://api.clearsportsapi.com/api/v1")
    SPORT_API_TIMEOUT = float(os.getenv("API_TIMEOUT", "10"))
    SPORT_API_RETRIES = int(os.getenv("API_RETRIES", "2"))
    SPORT_CACHE_TTL = int(os.getenv("CACHE_TTL", "300"))
    SPORT_REQUEST_DELAY_MS = int(os.getenv("REQUEST_DELAY_MS", "0"))

    JWT_SECRET = _resolve_jwt_secret()
    JWT_TTL_DAYS = int(os.getenv("JWT_TTL_DAYS", "30"))

    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "")

    YANDEX_CLIENT_ID = os.getenv("YANDEX_CLIENT_ID", "")
    YANDEX_CLIENT_SECRET = os.getenv("YANDEX_CLIENT_SECRET", "")
    YANDEX_REDIRECT_URI = os.getenv("YANDEX_REDIRECT_URI", "")

    # Опционально: если задан — rate-limit на /api/auth/* и одноразовые OAuth-коды
    # используют общий Redis вместо памяти процесса (нужно для >1 воркера/инстанса).
    # Без переменной поведение как раньше — состояние живёт в памяти одного процесса.
    REDIS_URL = os.getenv("REDIS_URL", "")

    PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "http://localhost:8000").rstrip("/")
    # Postgres (Supabase). Пример:
    # postgresql://postgres:PASSWORD@db.xxxxx.supabase.co:5432/postgres
    DATABASE_URL = os.getenv("DATABASE_URL", "")

    # Пул соединений к Postgres (аудит, раздел 13, "Средний приоритет", п.1).
    # DB_POOL_MAX должен быть заметно меньше лимита соединений на стороне
    # Supabase Session Pooler (обычно 15-60 в зависимости от плана) — с
    # запасом на другие процессы/миграции. По умолчанию рассчитано на один
    # воркер; при нескольких воркерах на одном хосте суммируйте вручную и
    # уменьшайте DB_POOL_MAX так, чтобы (воркеры × DB_POOL_MAX) не превышало
    # лимит провайдера.
    DB_POOL_MIN = int(os.getenv("DB_POOL_MIN", "1"))
    DB_POOL_MAX = int(os.getenv("DB_POOL_MAX", "10"))

    # Ключи Supabase API (пригодятся для Storage/Auth, если понадобятся позже —
    # текущий код работает напрямую по SQL и их не использует).
    SUPABASE_URL = os.getenv("SUPABASE_URL", "")
    SUPABASE_PUBLISHABLE_KEY = os.getenv("SUPABASE_PUBLISHABLE_KEY", "")
    SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY", "")

    # === Админ-доступ ===
    # Роль хранится в БД (users.role: 'user' | 'admin' | 'superadmin' — см.
    # app/web/deps.py, app/web/repo.py, app/web/api/admin_users.py). Списки
    # ниже — ТОЛЬКО bootstrap для холодного старта: пока в БД нет ни одного
    # superadmin, первый вход под email/telegram_id из этого списка
    # автоматически получает роль superadmin (см. deps._apply_admin_bootstrap).
    # После этого момента управление ролями идёт исключительно через
    # /api/admin/users — редактирование .env больше не выдаёт и не
    # восстанавливает роль в обход явного решения другого superadmin (иначе
    # отзыв роли через API был бы бессмысленным, пока запись остаётся здесь).
    # Раньше (до раунда 6) это был единственный источник правды для
    # is_admin_user() — минус такого подхода: выдача/отзыв доступа требовали
    # правки .env и передеплоя, а не пары кликов в панели.
    ADMIN_EMAILS = {
        e.strip().lower() for e in os.getenv("ADMIN_EMAILS", "").split(",") if e.strip()
    }
    ADMIN_TELEGRAM_IDS = {
        t.strip().strip("\"'\u201c\u201d\u2018\u2019\u00ab\u00bb")
        for t in _clean_env("ADMIN_TELEGRAM_IDS").split(",")
        if t.strip()
    }

    # === Реферальная программа (раунд 8, аудит, раздел 13 "Средний
    # приоритет") ===
    # Как и REFERRAL_TERMS во фронтенде (webapp/src/config/partners.js) —
    # намеренно None, пока владелец не впишет реальные условия. Без этой
    # переменной бэкенд по-прежнему честно ведёт учёт (кто кого пригласил,
    # у кого была первая оплата) и переводит запись в 'confirmed', но НЕ
    # начисляет выдуманную сумму — правило проекта №1 запрещает придуманные
    # цифры в интерфейсе, и то же самое правило соблюдается здесь.
    REFERRAL_REWARD_USD = os.getenv("REFERRAL_REWARD_USD", "").strip() or None

    # === Загрузка файлов (фото инвесторов) ===
    UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./data/uploads")
    MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(5 * 1024 * 1024)))  # 5MB

    @property
    def google_configured(self):
        return bool(self.GOOGLE_CLIENT_ID and self.GOOGLE_CLIENT_SECRET)

    @property
    def yandex_configured(self):
        return bool(self.YANDEX_CLIENT_ID and self.YANDEX_CLIENT_SECRET)

    def is_production_like(self) -> bool:
        """True для 'staging' и 'production' — окружений с реальным HTTPS-
        доступом извне, где нужны secure-cookie/HSTS/обязательный JWT_SECRET.
        False только для 'development' (раунд 8, аудит раздел 9)."""
        return _is_production_like(self.ENV)

    # === Email (задача 3, CODENEXA_TASKLIST.md): подтверждение почты и сброс
    # пароля по одноразовому 6-значному коду (см. app/web/email.py,
    # app/web/security.py::generate_otp_code, app/web/api/auth.py). SMTP, а не
    # транзакционный провайдер (SendGrid/Postmark/Resend и т.п.) — сознательный
    # выбор для старта: ноль внешних SaaS-зависимостей и ключей API, письма
    # уходят напрямую через ящик компании. Если объём вырастет настолько, что
    # Gmail начнёт душить лимитами (~500 писем/сутки на обычный ящик) или
    # понадобится DKIM/аналитика доставляемости — см. README_BACKEND.md,
    # раздел про email, там описан путь миграции на транзакционного провайдера
    # без изменения кода эндпоинтов (email.py — единственная точка отправки).
    SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
    # Адрес и отображаемое имя в поле "От" — по умолчанию тот же ящик, что
    # логинится по SMTP (Gmail всё равно перезаписывает "From" на адрес
    # аккаунта, если он не совпадает и не добавлен как алиас).
    SMTP_FROM = os.getenv("SMTP_FROM", "") or SMTP_USER
    # Код действителен ограниченное время — коротко, т.к. это OTP, а не
    # ссылка, которую могут открыть через день после письма.
    OTP_TTL_SECONDS = int(os.getenv("OTP_TTL_SECONDS", str(15 * 60)))

    @property
    def smtp_configured(self):
        return bool(self.SMTP_HOST and self.SMTP_USER and self.SMTP_PASSWORD)


settings = Settings()

if not settings.smtp_configured:
    # Не фатально ни в одном ENV: без SMTP подтверждение email и сброс пароля
    # по коду просто не смогут отправить письмо (auth.py логирует это и
    # отвечает тем же самым "универсальным" ответом, что и при успехе — см.
    # комментарий в auth.py про защиту от enumeration), остальной сервис
    # продолжает работать.
    print("[config] ВНИМАНИЕ: SMTP не настроен (SMTP_USER/SMTP_PASSWORD) — "
          "письма подтверждения email и сброса пароля отправляться не будут")

if not settings.TELEGRAM_BOT_TOKEN:
    # Не роняем импорт — но громко предупреждаем в логах, т.к. без токена
    # не будет работать ни проверка initData, ни платежи Stars.
    print("[config] ВНИМАНИЕ: TELEGRAM_BOT_TOKEN не задан в .env")

if not settings.DATABASE_URL:
    print("[config] ВНИМАНИЕ: DATABASE_URL не задан в .env — подключение к Postgres/Supabase не настроено")
