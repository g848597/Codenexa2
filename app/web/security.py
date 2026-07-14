"""Пароли, сессии (JWT) и 2FA (TOTP) — всё, что касается безопасности аккаунта."""
import time
import uuid

import jwt
import pyotp
from passlib.context import CryptContext

from app.web.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(raw: str) -> str:
    return pwd_context.hash(raw)


def verify_password(raw: str, hashed: str) -> bool:
    if not hashed:
        return False
    try:
        return pwd_context.verify(raw, hashed)
    except Exception:
        return False


def issue_session_token(user_id: int) -> tuple[str, str]:
    """Возвращает (jwt, token_id). token_id хранится в таблице sessions,
    чтобы сессию можно было отозвать (logout / 'выйти на всех устройствах')."""
    token_id = uuid.uuid4().hex
    now = int(time.time())
    payload = {
        "sub": str(user_id),
        "jti": token_id,
        "iat": now,
        "exp": now + settings.JWT_TTL_DAYS * 86400,
    }
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")
    return token, token_id


def decode_session_token(token: str):
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None


# --- 2FA (TOTP) ---

def new_totp_secret() -> str:
    return pyotp.random_base32()


def totp_uri(secret: str, account_name: str, issuer: str = "CodeNexa") -> str:
    return pyotp.totp.TOTP(secret).provisioning_uri(name=account_name, issuer_name=issuer)


def verify_totp(secret: str, code: str) -> bool:
    if not secret or not code:
        return False
    return pyotp.TOTP(secret).verify(code, valid_window=1)
