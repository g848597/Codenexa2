"""Бизнес-логика раздела «Telegram Tools» (Этап 2, см. 02-telegram-tools.md),
без привязки к FastAPI/HTTP — тот же паттерн разделения, что у repo.py для
SQL: роуты в app/api/telegram_tools.py только вызывают эти функции."""
import re

import httpx

# ---------- 2.1 Username Checker ----------

# Правила Telegram для username: 5-32 символа, только латиница/цифры/"_",
# начинается с буквы, не заканчивается на "_", без двух "_" подряд.
_USERNAME_CHARS_RE = re.compile(r"^[A-Za-z0-9_]+$")


def validate_username_format(username: str) -> str | None:
    """Возвращает текст ошибки или None, если формат корректный."""
    if not username:
        return "Введите username"
    if len(username) < 5 or len(username) > 32:
        return "Длина должна быть от 5 до 32 символов"
    if not _USERNAME_CHARS_RE.fullmatch(username):
        return "Допустимы только латинские буквы, цифры и подчёркивание"
    if not username[0].isalpha():
        return "Username должен начинаться с буквы"
    if username.endswith("_"):
        return 'Username не должен заканчиваться на "_"'
    if "__" in username:
        return "Два подчёркивания подряд недопустимы"
    return None


async def check_username_availability(username: str) -> dict:
    """Определяет занят/свободен username через t.me/<username>.

    Telegram не отдаёт честный 404 для свободных username — страница всегда
    200, различается только содержимое. Эвристика: если в HTML есть маркер
    tgme_page_title/tgme_page_extra (значит там реально отрисован профиль/
    канал/бот) — считаем занятым, иначе свободным. Best-effort для MVP;
    при появлении ложных срабатываний эвристику стоит уточнить вручную по
    актуальной вёрстке t.me."""
    error = validate_username_format(username)
    if error:
        return {"username": username, "status": "invalid", "error": error, "profile_url": None}

    url = f"https://t.me/{username}"
    try:
        async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as client:
            resp = await client.get(url)
    except httpx.HTTPError:
        return {
            "username": username,
            "status": "unknown",
            "error": "Не удалось обратиться к Telegram, попробуйте позже",
            "profile_url": None,
        }

    if resp.status_code != 200:
        return {
            "username": username,
            "status": "unknown",
            "error": f"Telegram вернул статус {resp.status_code}",
            "profile_url": None,
        }

    taken = "tgme_page_title" in resp.text or "tgme_page_extra" in resp.text
    if taken:
        return {"username": username, "status": "taken", "error": None, "profile_url": url}
    return {"username": username, "status": "free", "error": None, "profile_url": None}


# ---------- 2.3 Deep Link Builder ----------

DEEP_LINK_TYPES = {"start", "startgroup", "startapp", "startchannel"}
# Параметр deep-link у Telegram: A-Z a-z 0-9 "_" "-", до 64 символов.
_PARAM_RE = re.compile(r"^[A-Za-z0-9_\-]{0,64}$")


def build_deep_link(bot_username: str, link_type: str, param: str) -> dict:
    """Валидирует и собирает https://t.me/<bot>?<type>=<param>.

    Сборка синтаксически несложная и могла бы жить только на клиенте, но по
    DoD Этапа 2 Deep Link Builder должен делать "рабочий запрос к бэкенду/
    валидация" — так в generated_items не попадёт невалидный payload,
    даже если фронтенд что-то пропустит."""
    errors: dict[str, str] = {}

    if not bot_username:
        errors["bot_username"] = "Введите username бота"
    else:
        username_error = validate_username_format(bot_username)
        if username_error:
            errors["bot_username"] = username_error

    if link_type not in DEEP_LINK_TYPES:
        errors["link_type"] = f"Тип ссылки должен быть одним из: {', '.join(sorted(DEEP_LINK_TYPES))}"

    if param and not _PARAM_RE.fullmatch(param):
        errors["param"] = 'Параметр — только A-Z, a-z, 0-9, "_" и "-", до 64 символов'

    if errors:
        return {"ok": False, "errors": errors}

    url = f"https://t.me/{bot_username}?{link_type}={param}"
    return {
        "ok": True,
        "url": url,
        "bot_username": bot_username,
        "link_type": link_type,
        "param": param,
    }


# ---------- 2.2 Bio Generator ----------

# MVP без AI (по спеке) — шаблоны-заготовки на 3 тона, дефолт тона
# подхватывается на фронтенде из Brand Kit.tone_of_voice, если задан.
_BIO_PATTERNS: dict[str, list[str]] = {
    "friendly": [
        "Привет! Здесь про {niche} — просто, по-доброму и без занудства{kw}",
        "Заглядывай, если любишь {niche} — тепло, честно и рады новым лицам{kw}",
        "{niche_cap} — моя маленькая радость, которой делюсь каждый день{kw}",
    ],
    "expert": [
        "Разбираю {niche} на факты и практику — без воды, только рабочее{kw}",
        "{niche_cap}: экспертный взгляд, проверенные источники, чёткие выводы{kw}",
        "Профессионально про {niche} — опыт, аналитика, разбор кейсов{kw}",
    ],
    "sales": [
        "{niche_cap} — который решает вашу задачу. Пишите, посчитаем выгоду{kw}",
        "Лучшие предложения по {niche} — выгодно, быстро, с гарантией{kw}",
        "Нужен {niche} без переплат? Вы по адресу, подробности внутри{kw}",
    ],
}
_DEFAULT_TONE = "friendly"
_LENGTH_LIMITS = {"short": 70, "medium": 140}

BIO_TONES = set(_BIO_PATTERNS.keys())  # публичный список для валидации в api/telegram_tools.py


def _keywords_suffix(keywords: str | None) -> str:
    if not keywords:
        return ""
    words = [w.strip() for w in re.split(r"[,;]", keywords) if w.strip()]
    if not words:
        return ""
    return " · " + " · ".join(words[:3])


def _truncate(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0]
    return cut.rstrip(" ·") + "…"


def generate_bio_variants(niche: str, tone: str, keywords: str | None, length: str) -> list[str]:
    """Возвращает 3 варианта био (карточки по спеке 2.2)."""
    niche = niche.strip()
    tone = tone if tone in _BIO_PATTERNS else _DEFAULT_TONE
    limit = _LENGTH_LIMITS.get(length, _LENGTH_LIMITS["short"])
    kw = _keywords_suffix(keywords)
    niche_cap = niche[:1].upper() + niche[1:] if niche else niche

    variants = []
    for pattern in _BIO_PATTERNS[tone]:
        text = pattern.format(niche=niche, niche_cap=niche_cap, kw=kw)
        variants.append(_truncate(text, limit))
    return variants
