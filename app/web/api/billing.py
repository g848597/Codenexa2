"""Тарифы и приём оплаты. Два способа: криптовалюта через CryptoBot и
Telegram Stars.

Раунд 8 (аудит, раздел 12 "Объединить" — см. CHANGES_ROUND8.md, модуль 4):
тарифы раньше жили в статичном Python-словаре PLANS прямо в этом файле —
любое изменение цены требовало деплоя. Теперь источник истины — таблица
`plans` (см. app/web/db.py), редактируется через
PUT /api/admin/plans/{code} (см. app/web/api/admin_plans.py, только
superadmin), с полной историей изменений вместо перезаписи текущего
значения."""
import logging
import secrets

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.concurrency import run_in_threadpool

from app.web import money, referrals, repo
from app.web.config import settings
from app.web.deps import get_current_admin, get_current_user
from app.web.integrations import cryptobot, stars

logger = logging.getLogger("codenexa.billing")

router = APIRouter(prefix="/api/billing", tags=["billing"])

CRYPTO_ASSETS = ["USDT", "TON", "BTC"]

# Ручной перевод криптой (метод "crypto_manual" в /checkout, отдельно от
# CryptoBot): пользователь сам выбирает сеть, поэтому один и тот же актив
# может иметь несколько адресов (USDT — TRC20/ERC20/BEP20 это РАЗНЫЕ адреса,
# перепутать сеть = потерять перевод). Ключ словаря — то же, что фронт шлёт
# в body.network при method == "crypto_manual".
CRYPTO_MANUAL_NETWORKS: dict[str, list[str]] = {
    "USDT": ["TRC20", "ERC20", "BEP20"],
    "TON": ["TON"],
    "BTC": ["BTC"],
}


def _manual_wallet(asset: str, network: str) -> str:
    key = f"MANUAL_WALLET_{asset}_{network}" if asset != network else f"MANUAL_WALLET_{asset}"
    return getattr(settings, key, "") or ""


def _format_plan(plan: dict) -> dict:
    return {
        "code": plan["code"],
        "title": plan["title"],
        "usd": money.to_display(plan["usd"], "USD"),
        "stars": plan["stars"],
        "durationDays": plan.get("duration_days"),
    }


def _format_payment(payment: dict) -> dict:
    """Форматирует `amount` (Decimal из NUMERIC-колонки) в строку для JSON-
    ответа API (аудит, раздел 13, "Средний приоритет", п.2) — вместо того,
    чтобы отдавать "голый" Decimal и полагаться на то, как именно его
    сериализует энкодер по умолчанию (обычно через float, что возвращает
    ровно ту IEEE754-погрешность, ради ухода от которой NUMERIC и заводили)."""
    out = dict(payment)
    if out.get("amount") is not None:
        out["amount"] = money.to_display(out["amount"], out.get("currency") or "USD")
    return out


@router.get("/plans")
def get_plans():
    return {"plans": [_format_plan(p) for p in repo.get_active_plans()], "cryptoAssets": CRYPTO_ASSETS}


@router.get("/manual-methods")
def manual_methods():
    """Реквизиты для ручных способов оплаты (страница выбора способа —
    webapp/src/components/paymentPage.js): карта и криптокошельки по сетям.
    Публичный, без авторизации — это просто "куда переводить", не платёж.
    Сеть без заданного адреса помечается configured=false, чтобы фронт мог
    честно скрыть её из выбора вместо показа пустой строки."""
    crypto_networks = []
    for asset, networks in CRYPTO_MANUAL_NETWORKS.items():
        for network in networks:
            address = _manual_wallet(asset, network)
            crypto_networks.append({
                "asset": asset,
                "network": network,
                "address": address,
                "configured": bool(address),
            })
    return {
        "card": {
            "number": settings.MANUAL_CARD_NUMBER,
            "holder": settings.MANUAL_CARD_HOLDER,
            "bank": settings.MANUAL_CARD_BANK,
            "configured": settings.MANUAL_CARD_NUMBER != "0000 0000 0000 0000",
        },
        "crypto": crypto_networks,
    }


@router.get("/status")
def billing_status(user: dict = Depends(get_current_user)):
    payments = [_format_payment(p) for p in repo.list_payments(user["id"])]
    active_paid = [p for p in payments if p["status"] == "paid"]
    # hasPaid оставлен для обратной совместимости (старая логика "платил
    # хоть раз") — новый код должен смотреть на subscription.active, это
    # честная проверка "доступ есть ПРЯМО СЕЙЧАС" (см. repo.get_active_subscription,
    # чат: запрос владельца проекта на реальный срок действия подписки).
    active_sub = repo.get_active_subscription(user["id"])
    subscription = None
    if active_sub:
        subscription = {
            "active": True,
            "plan": active_sub["plan"],
            "expiresAt": active_sub["expires_at"],  # None = бессрочный тариф
        }
    return {
        "payments": payments,
        "hasPaid": bool(active_paid),
        "subscription": subscription or {"active": False, "plan": None, "expiresAt": None},
    }


@router.post("/checkout")
async def checkout(
    body: dict,
    user: dict = Depends(get_current_user),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
):
    plan_code = body.get("plan")
    method = body.get("method")  # 'cryptobot' | 'stars'
    network = body.get("network")  # для cryptobot: 'USDT' | 'TON' | 'BTC'

    # plan_code -> запись в БД теперь блокирующий SELECT (раньше — мгновенный
    # dict-lookup в статичном PLANS) — уводим в threadpool по тому же
    # принципу, что и остальные блокирующие вызовы внутри async def в этом
    # раунде (см. модуль 6 в CHANGES_ROUND8.md), чтобы не завести новый
    # экземпляр той же проблемы, которую только что закрыли.
    plan = await run_in_threadpool(repo.get_active_plan, plan_code) if plan_code else None
    if not plan:
        raise HTTPException(status_code=400, detail="Неизвестный тариф")

    # Идемпотентность (см. аудит, п.0.5): повторный клик/ретрай фронтенда с
    # тем же ключом отдаёт уже созданный платёж, а не плодит новый инвойс.
    # Фронтенду нужно генерировать один Idempotency-Key на попытку оплаты
    # (например uuid4 при открытии формы чекаута) и переслать его же при ретраях.
    if idempotency_key:
        existing = repo.get_payment_by_idempotency_key(user["id"], idempotency_key)
        if existing:
            if existing["provider"] == "stars":
                return {"method": "stars", "invoiceLink": existing.get("external_id"), "idempotent": True}
            if existing["provider"] == "card":
                return {
                    "method": "card", "reference": existing.get("external_id"),
                    "card": {
                        "number": settings.MANUAL_CARD_NUMBER,
                        "holder": settings.MANUAL_CARD_HOLDER,
                        "bank": settings.MANUAL_CARD_BANK,
                    },
                    "amountUsd": money.to_display(plan["usd"], "USD"), "idempotent": True,
                }
            if existing["provider"] == "crypto_manual":
                asset = (body.get("asset") or "USDT").upper()
                net = (network or asset).upper()
                return {
                    "method": "crypto_manual", "reference": existing.get("external_id"),
                    "asset": asset, "network": net, "address": _manual_wallet(asset, net),
                    "amountUsd": money.to_display(plan["usd"], "USD"), "idempotent": True,
                }
            return {
                "method": "cryptobot",
                "invoiceId": existing.get("external_id"),
                "idempotent": True,
            }

    if method == "stars":
        link = await stars.create_invoice_link(
            title=plan["title"],
            description=f"Подписка CodeNexa: {plan['title']}",
            payload=f"plan:{plan_code}:user:{user['id']}",
            stars_amount=plan["stars"],
        )
        repo.create_payment(
            user["id"], "stars", external_id=link, plan=plan_code, amount=str(plan["stars"]), currency="XTR",
            idempotency_key=idempotency_key,
        )
        return {"method": "stars", "invoiceLink": link}

    if method == "cryptobot":
        asset = network if network in CRYPTO_ASSETS else "USDT"
        try:
            asset_amount = await cryptobot.convert_usd_to_asset(plan["usd"], asset)
        except Exception:
            logger.exception("CryptoBot: не удалось получить курс для %s", asset)
            raise HTTPException(
                status_code=503,
                detail="Не удалось получить курс обмена, попробуйте другой актив или повторите позже",
            )
        invoice = await cryptobot.create_invoice(
            amount=asset_amount,
            asset=asset,
            description=f"CodeNexa: {plan['title']}",
            payload=f"plan:{plan_code}:user:{user['id']}",
        )
        repo.create_payment(
            user["id"], "cryptobot", external_id=str(invoice["invoice_id"]),
            plan=plan_code, amount=invoice.get("amount"), currency=asset,
            idempotency_key=idempotency_key,
        )
        return {"method": "cryptobot", "invoiceId": invoice["invoice_id"], "payUrl": invoice.get("pay_url") or invoice.get("bot_invoice_url")}

    if method in ("card", "crypto_manual"):
        # Ручные способы: нет внешнего API, которое сообщит нам об оплате
        # само (в отличие от cryptobot/stars-вебхуков) — платёж создаётся
        # сразу в статусе 'pending' с человекочитаемым номером заявки,
        # который пользователь укажет в переводе/чеке, а админ сверит вручную
        # (см. repo.list_payments в админке) и переведёт в 'paid'.
        reference = f"CX-{user['id']}-{plan_code[:3].upper()}-{secrets.token_hex(3).upper()}"

        if method == "card":
            payment_id = repo.create_payment(
                user["id"], "card", external_id=reference, plan=plan_code,
                amount=plan["usd"], currency="USD", idempotency_key=idempotency_key,
            )
            return {
                "method": "card",
                "reference": reference,
                "paymentId": payment_id,
                "card": {
                    "number": settings.MANUAL_CARD_NUMBER,
                    "holder": settings.MANUAL_CARD_HOLDER,
                    "bank": settings.MANUAL_CARD_BANK,
                },
                "amountUsd": money.to_display(plan["usd"], "USD"),
            }

        asset = (body.get("asset") or "USDT").upper()
        net = (network or asset).upper()
        if asset not in CRYPTO_MANUAL_NETWORKS or net not in CRYPTO_MANUAL_NETWORKS[asset]:
            raise HTTPException(status_code=400, detail="Неизвестный актив или сеть")
        address = _manual_wallet(asset, net)
        if not address:
            raise HTTPException(status_code=503, detail="Для этой сети пока не задан адрес, выберите другую")

        asset_amount = None
        try:
            asset_amount = await cryptobot.convert_usd_to_asset(plan["usd"], asset)
        except Exception:
            logger.warning("crypto_manual: не удалось получить курс для %s, покажем только USD", asset)

        payment_id = repo.create_payment(
            user["id"], "crypto_manual", external_id=reference, plan=plan_code,
            amount=asset_amount or plan["usd"], currency=asset if asset_amount else "USD",
            idempotency_key=idempotency_key,
        )
        return {
            "method": "crypto_manual",
            "reference": reference,
            "paymentId": payment_id,
            "asset": asset,
            "network": net,
            "address": address,
            "amountAsset": asset_amount,
            "amountUsd": money.to_display(plan["usd"], "USD"),
        }

    raise HTTPException(status_code=400, detail="Неизвестный способ оплаты")


@router.post("/cryptobot/webhook")
async def cryptobot_webhook(
    request: Request,
    signature: str | None = Header(default=None, alias="crypto-pay-api-signature"),
):
    """CryptoBot шлёт сюда событие invoice_paid. Настраивается в @CryptoBot ->
    Crypto Pay -> Webhooks -> URL = {PUBLIC_BASE_URL}/api/billing/cryptobot/webhook.

    Подпись ОБЯЗАТЕЛЬНО проверяется (см. аудит, п.0.2 — раньше это было TODO):
    без этого любой человек, знающий URL, мог POST-запросом пометить чужой
    платёж оплаченным. raw body читаем ДО json-парсинга — подпись считается
    по байтам исходного тела, не по пересобранному JSON."""
    raw_body = await request.body()
    if not cryptobot.verify_webhook_signature(raw_body, signature):
        logger.warning("CryptoBot webhook: неверная или отсутствующая подпись")
        raise HTTPException(status_code=403, detail="Неверная подпись вебхука")

    payload = await request.json()
    if payload.get("update_type") == "invoice_paid":
        invoice = payload.get("payload", {})
        # Раунд 8 (аудит, раздел 3, см. CHANGES_ROUND8.md, модуль 6):
        # блокирующий psycopg2-вызов уведён в threadpool.
        paid_user_id = await run_in_threadpool(repo.mark_payment_paid, "cryptobot", str(invoice.get("invoice_id")))
        if paid_user_id:
            # Раунд 8, модуль 2: подтверждение реферала при первой
            # успешной оплате приглашённого (best-effort внутри).
            await run_in_threadpool(referrals.maybe_confirm_referral, paid_user_id)
    return {"ok": True}


def _format_manual_payment(row: dict) -> dict:
    out = _format_payment(row)
    out["user"] = {
        "email": row.get("email"),
        "telegramId": row.get("telegram_id"),
        "firstName": row.get("first_name"),
        "lastName": row.get("last_name"),
    }
    return out


@router.get("/admin/manual-payments")
async def admin_pending_manual_payments(_admin: dict = Depends(get_current_admin)):
    """Список заявок на оплату картой/крипто-переводом вручную, ожидающих
    подтверждения (см. страницу оплаты — components/paymentPage.js — и
    repo.list_pending_manual_payments). Сверяется по `reference`
    (= external_id) в переводе/чеке, который прислал пользователь."""
    rows = await run_in_threadpool(repo.list_pending_manual_payments)
    return {"payments": [_format_manual_payment(r) for r in rows]}


@router.post("/admin/manual-payments/{payment_id}/confirm")
async def admin_confirm_manual_payment(payment_id: int, admin: dict = Depends(get_current_admin)):
    """Подтверждает вручную сверенный платёж — активирует тариф пользователю
    (см. repo.confirm_manual_payment: тот же расчёт expires_at, что и в
    mark_payment_paid для cryptobot-вебхука)."""
    paid_user_id = await run_in_threadpool(repo.confirm_manual_payment, payment_id)
    if not paid_user_id:
        raise HTTPException(status_code=404, detail="Заявка не найдена или уже обработана")
    await run_in_threadpool(referrals.maybe_confirm_referral, paid_user_id)
    logger.info("Admin %s подтвердил ручной платёж #%s (user %s)", admin["id"], payment_id, paid_user_id)
    return {"ok": True}
