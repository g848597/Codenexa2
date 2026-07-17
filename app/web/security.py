"""Пароли, сессии (JWT) и 2FA (TOTP) — всё, что касается безопасности аккаунта."""
import secrets
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


# --- OTP-коды на email: подтверждение адреса и сброс пароля (задача 3,
# CODENEXA_TASKLIST.md). secrets.randbelow (а не random.randint) — это
# криптографически стойкий генератор, важно для кода, который защищает смену
# пароля/подтверждение аккаунта. Код хранится в БД только хешем через тот же
# bcrypt-контекст, что и пароли (см. hash_password/verify_password выше) —
# отдельный контекст здесь не нужен, входные данные симметричны (короткая
# строка), поэтому переиспользуем существующий, а не заводим новый.

def generate_otp_code() -> str:
    """6-значный цифровой код, всегда с ведущими нулями (например '004213') —
    длина фиксирована, поэтому в письме и на экране ввода код выглядит
    единообразно."""
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_otp_code(code: str) -> str:
    return pwd_context.hash(code)


def verify_otp_code(code: str, hashed: str) -> bool:
    return verify_password(code, hashed)
