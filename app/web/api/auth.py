import hmac
import logging
import secrets
import time
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import BaseModel, EmailStr, field_validator

from app.web import referrals, repo, security
from app.web.api.telegram_auth import validate_init_data
from app.web.cache import get_redis
from app.web.config import settings
from app.web.deps import _apply_admin_bootstrap, get_current_user, is_admin_user

router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = logging.getLogger("codenexa.auth")

# Rate-limit на N попыток / email-или-ip за окно времени. Если задан
# REDIS_URL — счётчик общий для всех воркеров/инстансов в Redis (INCR +
# EXPIRE, фиксированное окно). Без него — фолбэк на память процесса
# (скользящее окно по списку таймстампов), как было раньше: для одного
# воркера/локальной разработки этого достаточно.
_attempts: dict[str, list[float]] = {}
RATE_LIMIT_WINDOW = 15 * 60
RATE_LIMIT_MAX = 8


def _rate_limit_memory(key: str):
    now = time.time()
    bucket = [t for t in _attempts.get(key, []) if now - t < RATE_LIMIT_WINDOW]
    if len(bucket) >= RATE_LIMIT_MAX:
        raise HTTPException(status_code=429, detail="Слишком много попыток. Попробуйте позже.")
    bucket.append(now)
    _attempts[key] = bucket


def _rate_limit(key: str):
    r = get_redis()
    if r is None:
        _rate_limit_memory(key)
        return

    redis_key = f"ratelimit:{key}"
    try:
        count = r.incr(redis_key)
        if count == 1:
            r.expire(redis_key, RATE_LIMIT_WINDOW)
    except Exception as exc:  # noqa: BLE001 — Redis моргнул, не роняем логин/регистрацию
        logger.warning("Redis rate-limit недоступен (%s), фолбэк на память процесса", exc)
        _rate_limit_memory(key)
        return

    if count > RATE_LIMIT_MAX:
        raise HTTPException(status_code=429, detail="Слишком много попыток. Попробуйте позже.")


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    return (fwd.split(",")[0].strip() if fwd else request.client.host) or "unknown"


def _issue_token_response(user_id: int, request: Request):
    token, token_id = security.issue_session_token(user_id)
    repo.create_session(
        user_id=user_id,
        token_id=token_id,
        user_agent=request.headers.get("user-agent", ""),
        ip=_client_ip(request),
    )
    return token


def _public_user(user: dict) -> dict:
    # Применяем bootstrap первого superadmin здесь же (а не только в
    # deps.try_get_current_user_value), чтобы isAdmin в ОТВЕТЕ на сам
    # register/login/telegram/exchange уже отражал выданную роль — без этого
    # поле было бы верным только начиная со следующего запроса (например,
    # /api/auth/me), что путает фронтенд, который ждёт isAdmin сразу после
    # входа. Для уже существующей роли (не 'user'/None) это no-op — см.
    # deps._apply_admin_bootstrap.
    user = _apply_admin_bootstrap(user)
    return {
        "id": user["id"],
        "email": user.get("email"),
        "firstName": user.get("first_name"),
        "lastName": user.get("last_name"),
        "avatarUrl": user.get("avatar_url"),
        "hasTelegram": bool(user.get("telegram_id")),
        "hasGoogle": bool(user.get("google_id")),
        "hasYandex": bool(user.get("yandex_id")),
        "hasPassword": bool(user.get("password_hash")),
        "twoFaEnabled": bool(user.get("totp_enabled")),
        "createdAt": user.get("created_at"),
        "isAdmin": is_admin_user(user),
    }


# ---------- Email + пароль ----------

class RegisterBody(BaseModel):
    email: EmailStr
    password: str
    firstName: str | None = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        if len(v) < 8:
            raise ValueError("Пароль должен быть не короче 8 символов")
        return v


class LoginBody(BaseModel):
    email: EmailStr
    password: str
    totpCode: str | None = None


@router.post("/register")
def register(body: RegisterBody, request: Request):
    _rate_limit(f"register:{_client_ip(request)}")
    if repo.get_user_by_email(body.email):
        raise HTTPException(status_code=409, detail="Этот email уже зарегистрирован")
    user = repo.create_user(
        email=body.email.lower(),
        password_hash=security.hash_password(body.password),
        first_name=body.firstName,
    )
    token = _issue_token_response(user["id"], request)
    return {"token": token, "user": _public_user(user)}


@router.post("/login")
def login(body: LoginBody, request: Request):
    _rate_limit(f"login:{body.email.lower()}:{_client_ip(request)}")
    user = repo.get_user_by_email(body.email)
    if not user or not security.verify_password(body.password, user.get("password_hash") or ""):
        raise HTTPException(status_code=401, detail="Неверный email или пароль")
    if user.get("totp_enabled"):
        if not body.totpCode:
            raise HTTPException(status_code=401, detail="Нужен код из приложения-аутентификатора", headers={"X-Requires-2FA": "1"})
        if not security.verify_totp(user["totp_secret"], body.totpCode):
            raise HTTPException(status_code=401, detail="Неверный код 2FA")
    repo.touch_login(user["id"])
    token = _issue_token_response(user["id"], request)
    return {"token": token, "user": _public_user(user)}


# ---------- Telegram (тихий вход внутри мини-аппа) ----------

class TelegramAuthBody(BaseModel):
    initData: str


@router.post("/telegram")
def telegram_auth(body: TelegramAuthBody, request: Request):
    payload = validate_init_data(body.initData)
    if not payload or not payload.get("user"):
        raise HTTPException(status_code=401, detail="Подпись Telegram initData недействительна")
    tg_user = payload["user"]
    user = repo.get_user_by_telegram_id(tg_user["id"])
    if not user:
        user = repo.create_user(
            telegram_id=tg_user["id"],
            first_name=tg_user.get("first_name"),
            last_name=tg_user.get("last_name"),
        )
        # Раунд 8 (аудит, раздел 13, "Средний приоритет", см.
        # CHANGES_ROUND8.md, модуль 2): только для НОВОГО пользователя — не
        # привязываем повторно при обычном последующем входе.
        referrals.link_referral_on_registration(user, payload.get("start_param"))
    repo.touch_login(user["id"])
    token = _issue_token_response(user["id"], request)
    return {"token": token, "user": _public_user(user)}


# ---------- Текущий пользователь ----------

@router.get("/me")
def me(user: dict = Depends(get_current_user)):
    return {"user": _public_user(user)}


@router.post("/logout")
def logout(request: Request, user: dict = Depends(get_current_user)):
    """Отзывает текущую сессию (по jti из JWT). Для tma-сессий отзывать
    нечего — initData каждый раз проверяется заново самим Telegram."""
    auth = request.headers.get("authorization", "")
    if auth.startswith("Bearer "):
        decoded = security.decode_session_token(auth[7:])
        if decoded and decoded.get("jti"):
            row = repo.get_conn().execute(
                "SELECT id FROM sessions WHERE token_id = ? AND user_id = ?",
                (decoded["jti"], user["id"]),
            ).fetchone()
            if row:
                repo.revoke_session(user["id"], row["id"])
    return {"ok": True}


# ---------- Сессии (устройства) — часть "безопасности аккаунта" ----------

@router.get("/sessions")
def sessions(user: dict = Depends(get_current_user)):
    return {"sessions": repo.list_sessions(user["id"])}


@router.post("/sessions/{session_id}/revoke")
def revoke_session(session_id: int, user: dict = Depends(get_current_user)):
    repo.revoke_session(user["id"], session_id)
    return {"ok": True}


@router.post("/sessions/revoke-all")
def revoke_all(request: Request, user: dict = Depends(get_current_user)):
    auth = request.headers.get("authorization", "")
    current_jti = None
    if auth.startswith("Bearer "):
        decoded = security.decode_session_token(auth[7:])
        current_jti = decoded.get("jti") if decoded else None
    repo.revoke_all_sessions(user["id"], except_token_id=current_jti)
    return {"ok": True}


# ---------- Смена пароля ----------

class ChangePasswordBody(BaseModel):
    currentPassword: str | None = None
    newPassword: str

    @field_validator("newPassword")
    @classmethod
    def strength(cls, v):
        if len(v) < 8:
            raise ValueError("Пароль должен быть не короче 8 символов")
        return v


@router.post("/change-password")
def change_password(body: ChangePasswordBody, user: dict = Depends(get_current_user)):
    if user.get("password_hash"):
        if not body.currentPassword or not security.verify_password(body.currentPassword, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Текущий пароль неверен")
    repo.update_user(user["id"], password_hash=security.hash_password(body.newPassword))
    return {"ok": True}


# ---------- 2FA (TOTP) ----------

@router.post("/2fa/setup")
def setup_2fa(user: dict = Depends(get_current_user)):
    secret = security.new_totp_secret()
    repo.update_user(user["id"], totp_secret=secret)
    label = user.get("email") or f"tg:{user.get('telegram_id')}" or f"user{user['id']}"
    return {"secret": secret, "otpauthUrl": security.totp_uri(secret, label)}


class Confirm2FABody(BaseModel):
    code: str


@router.post("/2fa/confirm")
def confirm_2fa(body: Confirm2FABody, user: dict = Depends(get_current_user)):
    fresh = repo.get_user_by_id(user["id"])
    if not fresh.get("totp_secret"):
        raise HTTPException(status_code=400, detail="Сначала вызовите /2fa/setup")
    if not security.verify_totp(fresh["totp_secret"], body.code):
        raise HTTPException(status_code=401, detail="Неверный код")
    repo.update_user(user["id"], totp_enabled=True)
    return {"ok": True}


@router.post("/2fa/disable")
def disable_2fa(body: Confirm2FABody, user: dict = Depends(get_current_user)):
    fresh = repo.get_user_by_id(user["id"])
    if fresh.get("totp_enabled") and not security.verify_totp(fresh.get("totp_secret", ""), body.code):
        raise HTTPException(status_code=401, detail="Неверный код")
    repo.update_user(user["id"], totp_enabled=False, totp_secret=None)
    return {"ok": True}


# ---------- Google OAuth ----------
# Открывается через Telegram.WebApp.openLink (внешний браузер) — Telegram
# внутри своего WebView не всегда пропускает сторонние OAuth-редиректы.
# После успешного логина показываем страницу "вернитесь в Telegram" со
# ссылкой t.me/<bot>?start=auth_<code>; мини-апп подхватывает код через уже
# существующий механизм start_param (см. START_PARAM_ROUTES в main.js) и
# обменивает его на токен через /api/auth/exchange.

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"

YANDEX_AUTH_URL = "https://oauth.yandex.ru/authorize"
YANDEX_TOKEN_URL = "https://oauth.yandex.ru/token"
YANDEX_INFO_URL = "https://login.yandex.ru/info"

# Cookie, которая привязывает OAuth-`state` к конкретному браузеру.
# См. аудит, раздел 4, п.6: раньше `state` хранился только в БД (защита от
# CSRF была неполной — сервер не мог убедиться, что /callback пришёл из
# того же браузера, что и /start). httpOnly + SameSite=Lax cookie с тем же
# значением, сверяемая на /callback, закрывает классический сценарий:
# атакующий инициирует свой OAuth-flow, получает валидный `state`/`code`, и
# подсовывает жертве ссылку на /callback с этими параметрами, чтобы привязать
# аккаунт жертвы к своему провайдеру. Без cookie-привязки сервер не отличит
# этот запрос от легитimного.
OAUTH_CSRF_COOKIE = "oauth_csrf"
OAUTH_STATE_MAX_AGE = 600  # 10 минут на прохождение redirect-флоу


def _set_oauth_csrf_cookie(response, state: str):
    response.set_cookie(
        OAUTH_CSRF_COOKIE,
        state,
        max_age=OAUTH_STATE_MAX_AGE,
        httponly=True,
        secure=settings.is_production_like(),
        samesite="lax",
        path="/api/auth",
    )


def _verify_oauth_csrf(request: Request, provider: str, state: str):
    """Сверяет state из query с cookie (привязка к браузеру) и с БД
    (существование, провайдер, TTL, однократность — см. repo.validate_oauth_state).
    При любом несовпадении — 400, чтобы не давать атакующему понять, какая
    именно проверка не прошла."""
    cookie_state = request.cookies.get(OAUTH_CSRF_COOKIE)
    if not cookie_state or not hmac.compare_digest(cookie_state, state):
        raise HTTPException(status_code=400, detail="Сессия авторизации недействительна, попробуйте войти заново")
    if not repo.validate_oauth_state(provider, state, OAUTH_STATE_MAX_AGE):
        raise HTTPException(status_code=400, detail="Сессия авторизации недействительна, попробуйте войти заново")


def _complete_oauth_login(*, provider: str, provider_id_field: str, provider_id, email: str | None,
                           first_name: str | None, last_name: str | None, avatar_url: str | None,
                           state: str) -> HTMLResponse:
    """Общая часть google_callback/yandex_callback: найти-или-создать пользователя
    по provider_id (с привязкой по email, если аккаунт уже есть), выписать
    одноразовый код для обмена на JWT внутри мини-аппа и отдать страницу
    "вернитесь в Telegram". Раньше эти ~40 строк были продублированы почти
    один в один под каждого провайдера (см. аудит, раздел 2/12) — при
    добавлении Apple/VK (см. раздел 9) дублирование стало бы утроением."""
    user = repo.get_user_by_provider_id(provider_id_field, provider_id)
    if not user:
        user = repo.get_user_by_email(email) if email else None
        if user:
            user = repo.update_user(user["id"], **{provider_id_field: provider_id})
        else:
            user = repo.create_user(
                **{provider_id_field: provider_id},
                email=email,
                first_name=first_name,
                last_name=last_name,
                avatar_url=avatar_url,
            )

    one_time_code = secrets.token_urlsafe(16)
    repo.attach_oauth_code(state, user["id"], one_time_code)

    deep_link = f"https://t.me/{settings.TELEGRAM_BOT_USERNAME}?start=auth_{one_time_code}"
    response = HTMLResponse(_finish_oauth_page(deep_link))
    response.delete_cookie(OAUTH_CSRF_COOKIE, path="/api/auth")
    return response


def _finish_oauth_page(deep_link: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Готово — вернитесь в Telegram</title>
<style>
body{{background:#0a0b0d;color:#eceef1;font-family:Inter,sans-serif;display:flex;
min-height:100vh;align-items:center;justify-content:center;text-align:center;margin:0;padding:24px}}
.card{{max-width:360px}}
h1{{font-size:20px;margin-bottom:12px}}
p{{color:#8b9099;font-size:14px;line-height:1.5;margin-bottom:22px}}
a{{display:inline-block;background:#00d9a0;color:#031f16;text-decoration:none;font-weight:600;
padding:13px 22px;border-radius:9px;font-size:14px}}
</style></head>
<body><div class="card">
<h1>Вход выполнен ✓</h1>
<p>Нажмите кнопку, чтобы вернуться в приложение CodeNexa в Telegram.</p>
<a href="{deep_link}">Вернуться в Telegram</a>
</div></body></html>"""


@router.get("/google/start")
def google_start():
    if not settings.google_configured:
        raise HTTPException(status_code=503, detail="Google OAuth не настроен на сервере (нет GOOGLE_CLIENT_ID/SECRET)")
    state = secrets.token_urlsafe(24)
    repo.create_oauth_state("google", state)
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
        "prompt": "select_account",
    }
    response = RedirectResponse(f"{GOOGLE_AUTH_URL}?{urlencode(params)}")
    _set_oauth_csrf_cookie(response, state)
    return response


@router.get("/google/callback")
async def google_callback(code: str, state: str, request: Request):
    # Раунд 8 (аудит, раздел 3 — "Синхронный psycopg2 внутри async def
    # эндпоинтов", см. CHANGES_ROUND8.md, модуль 6): _verify_oauth_csrf и
    # _complete_oauth_login делают блокирующий сетевой I/O к Postgres через
    # psycopg2. Внутри async def это раньше блокировало event loop на время
    # запроса к БД — все остальные async-запросы (даже не связанные с БД)
    # ждали. run_in_threadpool уводит блокирующий вызов в тот же threadpool,
    # где и так исполняются sync-эндпоинты FastAPI.
    await run_in_threadpool(_verify_oauth_csrf, request, "google", state)
    async with httpx.AsyncClient(timeout=15) as client:
        token_res = await client.post(GOOGLE_TOKEN_URL, data={
            "code": code,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        })
        if token_res.status_code != 200:
            raise HTTPException(status_code=400, detail="Не удалось обменять код Google на токен")
        access_token = token_res.json().get("access_token")

        info_res = await client.get(GOOGLE_USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"})
        info = info_res.json()

    return await run_in_threadpool(
        _complete_oauth_login,
        provider="google",
        provider_id_field="google_id",
        provider_id=info.get("sub"),
        email=info.get("email"),
        first_name=info.get("given_name"),
        last_name=info.get("family_name"),
        avatar_url=info.get("picture"),
        state=state,
    )


@router.get("/yandex/start")
def yandex_start():
    if not settings.yandex_configured:
        raise HTTPException(status_code=503, detail="Yandex OAuth не настроен на сервере (нет YANDEX_CLIENT_ID/SECRET)")
    state = secrets.token_urlsafe(24)
    repo.create_oauth_state("yandex", state)
    params = {
        "response_type": "code",
        "client_id": settings.YANDEX_CLIENT_ID,
        "redirect_uri": settings.YANDEX_REDIRECT_URI,
        "state": state,
    }
    response = RedirectResponse(f"{YANDEX_AUTH_URL}?{urlencode(params)}")
    _set_oauth_csrf_cookie(response, state)
    return response


@router.get("/yandex/callback")
async def yandex_callback(code: str, state: str, request: Request):
    await run_in_threadpool(_verify_oauth_csrf, request, "yandex", state)
    async with httpx.AsyncClient(timeout=15) as client:
        token_res = await client.post(YANDEX_TOKEN_URL, data={
            "grant_type": "authorization_code",
            "code": code,
            "client_id": settings.YANDEX_CLIENT_ID,
            "client_secret": settings.YANDEX_CLIENT_SECRET,
        })
        if token_res.status_code != 200:
            raise HTTPException(status_code=400, detail="Не удалось обменять код Яндекса на токен")
        access_token = token_res.json().get("access_token")

        info_res = await client.get(YANDEX_INFO_URL, params={"format": "json"}, headers={"Authorization": f"OAuth {access_token}"})
        info = info_res.json()

    return await run_in_threadpool(
        _complete_oauth_login,
        provider="yandex",
        provider_id_field="yandex_id",
        provider_id=info.get("id"),
        email=info.get("default_email"),
        first_name=info.get("first_name"),
        last_name=info.get("last_name"),
        avatar_url=None,
        state=state,
    )


# Раньше рядом существовало два независимых механизма для передачи Google/Yandex
# логина обратно в мини-апп: таблица `oauth_links` (БД, code -> user_id) и
# отдельный in-memory словарь `_pending_tokens` (code -> уже выписанный jwt).
# Реально использовался второй, из-за чего первый был мёртвым кодом, а сессия
# создавалась ещё на /callback — до того, как пользователь вообще вернулся в
# приложение (не проблема безопасности, но лишняя сессия/токен, если он не
# вернулся). Теперь остаётся только `oauth_links`: она и так была нужна для
# state/CSRF-защиты колбэка, и — в отличие от словаря в памяти — переживает
# рестарт процесса и одинаково видна всем воркерам без Redis. Сам JWT здесь
# не хранится нигде: /exchange выписывает свежую сессию в момент, когда
# пользователь реально вернулся в мини-апп.
class ExchangeBody(BaseModel):
    code: str


@router.post("/exchange")
def exchange_code(body: ExchangeBody, request: Request):
    code = body.code[5:] if body.code.startswith("auth_") else body.code
    link = repo.consume_oauth_code(code)
    if not link or not link.get("user_id"):
        raise HTTPException(status_code=400, detail="Код недействителен или уже использован")
    user = repo.get_user_by_id(link["user_id"])
    if not user:
        raise HTTPException(status_code=400, detail="Код недействителен")
    repo.touch_login(user["id"])
    token = _issue_token_response(user["id"], request)
    return {"token": token, "user": _public_user(user)}
