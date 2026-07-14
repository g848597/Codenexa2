"""Реферальная программа (аудит, раздел 13, "Средний приоритет", раунд 8,
модуль 2): связка нового пользователя с пригласившим через deep-link
параметр Telegram (`t.me/<bot>?start=ref_<telegram_id>`, см. webapp/src/
components/partners.js) и подтверждение реферала при первой успешной
оплате приглашённого — не в момент регистрации, иначе рефералов можно было
бы накрутить фейковыми аккаунтами без единой реальной оплаты.

Код реферальной ссылки = telegram_id пригласившего. Это самая простая и
прозрачная схема: не нужна отдельная таблица "код -> пользователь", ссылка
читается напрямую. Компромисс — telegram_id виден в ссылке; для программы,
где реферер сам решает, с кем её делиться, это приемлемо (то же самое
делают многие боты).

Обе точки входа (link_referral_on_registration, maybe_confirm_referral)
best-effort: сбой здесь никогда не должен ронять регистрацию или
подтверждение оплаты — тот же принцип, что и в app/web/audit.py."""
import logging

from app.web import repo
from app.web.config import settings

logger = logging.getLogger("codenexa.referrals")

REFERRAL_PREFIX = "ref_"


def parse_referrer_telegram_id(start_param: str | None) -> int | None:
    if not start_param or not start_param.startswith(REFERRAL_PREFIX):
        return None
    raw = start_param[len(REFERRAL_PREFIX):]
    try:
        return int(raw)
    except ValueError:
        return None


def link_referral_on_registration(referred_user: dict, start_param: str | None) -> None:
    """Вызывать РОВНО один раз — сразу после repo.create_user() для нового
    telegram-пользователя (см. app/web/api/auth.py::telegram_auth). Не
    вызывать для уже существующих пользователей — referred_id уникален,
    повторный вызов для того же пользователя просто ничего не сделает
    (repo.create_referral возвращает None), но это скрыло бы реальную
    причину, если бы привязка не удалась by design (пользователь уже был
    приглашён кем-то другим раньше)."""
    referrer_tg_id = parse_referrer_telegram_id(start_param)
    if referrer_tg_id is None:
        return
    try:
        referrer = repo.get_user_by_telegram_id(referrer_tg_id)
        if not referrer:
            return
        if referrer["id"] == referred_user["id"]:
            # Самореферал — пригласительная ссылка на самого себя, не
            # начисляем (открытая дыра для накрутки счётчика "приглашено").
            logger.info("referral: самореферал отклонён, user_id=%s", referred_user["id"])
            return
        created = repo.create_referral(referrer["id"], referred_user["id"])
        if created is None:
            logger.info(
                "referral: user_id=%s уже был привязан к рефереру ранее, повторная привязка пропущена",
                referred_user["id"],
            )
    except Exception:  # noqa: BLE001 — best-effort, не должно ронять вход пользователя
        logger.exception("referral: не удалось привязать referred_id=%s", referred_user.get("id"))


def maybe_confirm_referral(user_id: int) -> None:
    """Вызывать после ЛЮБОГО подтверждения успешной оплаты (Stars и
    CryptoBot webhook) для user_id плательщика. Идемпотентно на уровне
    repo.confirm_referral — сработает только на первой оплате приглашённого,
    повторные вызовы (вторая подписка, продление) не создают задваивания.

    reward_amount берётся из settings.REFERRAL_REWARD_USD — если он не
    задан (владелец ещё не решил условия программы, см. REFERRAL_TERMS во
    фронтенде), referral всё равно переводится в 'confirmed' (честный факт
    "первая оплата была"), но БЕЗ выдуманной суммы вознаграждения."""
    try:
        reward_amount = settings.REFERRAL_REWARD_USD
        reward_currency = "USD" if reward_amount else None
        repo.confirm_referral(user_id, reward_amount=reward_amount, reward_currency=reward_currency)
    except Exception:  # noqa: BLE001 — best-effort, не должно ронять обработку вебхука оплаты
        logger.exception("referral: не удалось подтвердить referred_id=%s", user_id)
