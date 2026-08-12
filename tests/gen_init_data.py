"""Dev-утилита: генерирует валидную подпись initData для ручного тестирования
API без реального Telegram-клиента.

Использование:
    TELEGRAM_BOT_TOKEN=<токен из .env> python tests/gen_init_data.py [telegram_id]

Выводит готовую строку initData — подставь её в заголовок:
    Authorization: tma <вывод скрипта>
"""
import hashlib
import hmac
import json
import os
import sys
import time
from urllib.parse import quote


def build_init_data(user: dict, bot_token: str) -> str:
    pairs = {
        "user": json.dumps(user, separators=(",", ":")),
        "auth_date": str(int(time.time())),
        "query_id": "AAHtest",
    }
    data_check_string = "\n".join(f"{k}={pairs[k]}" for k in sorted(pairs.keys()))
    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    computed_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    pairs["hash"] = computed_hash
    return "&".join(f"{k}={quote(v, safe='')}" for k, v in pairs.items())


if __name__ == "__main__":
    token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    if not token:
        print("Задай TELEGRAM_BOT_TOKEN (тот же, что в .env) перед запуском.", file=sys.stderr)
        sys.exit(1)
    tg_id = int(sys.argv[1]) if len(sys.argv) > 1 else 111222333
    print(build_init_data(
        {"id": tg_id, "first_name": "Test", "username": "test_user", "language_code": "ru"},
        token,
    ))
