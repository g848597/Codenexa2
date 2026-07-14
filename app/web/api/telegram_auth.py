"""Проверка подписи initData мини-аппа Telegram.
Алгоритм из официальной документации:
https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app

secret_key = HMAC_SHA256(key="WebAppData", data=bot_token)
hash = HEX(HMAC_SHA256(key=secret_key, data=data_check_string))

Это тот же файл, на который уже ссылается фронтенд (src/telegram.js) как на
`app/web/api/telegram_auth.py` — имя и путь сохранены намеренно.
"""
import hashlib
import hmac
import json
import time
from urllib.parse import parse_qsl

from app.web.config import settings

MAX_AUTH_AGE_SECONDS = 24 * 3600  # initData старше суток считаем протухшим


def validate_init_data(init_data: str, bot_token: str | None = None) -> dict | None:
    """Возвращает распарсенные данные пользователя, если подпись верна и
    initData не протухла, иначе None."""
    bot_token = bot_token or settings.TELEGRAM_BOT_TOKEN
    if not init_data or not bot_token:
        return None

    try:
        pairs = dict(parse_qsl(init_data, strict_parsing=True))
    except ValueError:
        return None

    received_hash = pairs.pop("hash", None)
    if not received_hash:
        return None

    data_check_string = "\n".join(f"{k}={pairs[k]}" for k in sorted(pairs.keys()))

    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    computed_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(computed_hash, received_hash):
        return None

    auth_date = pairs.get("auth_date")
    if auth_date:
        try:
            if time.time() - int(auth_date) > MAX_AUTH_AGE_SECONDS:
                return None
        except ValueError:
            return None

    user_raw = pairs.get("user")
    user = json.loads(user_raw) if user_raw else None

    return {
        "user": user,
        "auth_date": auth_date,
        "start_param": pairs.get("start_param"),
    }
