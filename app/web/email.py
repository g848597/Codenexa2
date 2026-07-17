"""Отправка email через SMTP (задача 3, CODENEXA_TASKLIST.md).

Единственная точка в проекте, которая реально шлёт письма — подтверждение
email и сброс пароля (см. app/web/api/auth.py) используют только функции
отсюда. Если провайдера когда-нибудь сменят на транзакционный (SendGrid/
Postmark/Resend) — переписывается только этот файл, эндпоинты не меняются.

Отправка синхронная (smtplib блокирует поток на время SMTP-диалога), но
вызывается через FastAPI BackgroundTasks в auth.py — HTTP-ответ пользователю
не ждёт реального ухода письма. Ошибки отправки не должны ронять запрос:
send_email() ловит исключения сама и возвращает False вместо raise.
"""
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.web.config import settings

logger = logging.getLogger("codenexa.email")


def send_email(to: str, subject: str, html_body: str, text_body: str) -> bool:
    """Отправляет письмо. Возвращает True, если SMTP принял письмо, False —
    если SMTP не настроен или отправка упала (подробности в логах, не в
    ответе пользователю — см. auth.py про защиту от enumeration email)."""
    if not settings.smtp_configured:
        logger.warning(
            "SMTP не настроен (нет SMTP_HOST/SMTP_USER/SMTP_PASSWORD) — "
            "письмо на %s не отправлено (тема: %r)", to, subject,
        )
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to
    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM, [to], msg.as_string())
        return True
    except Exception as exc:  # noqa: BLE001 — проблема с почтой не должна ронять запрос
        logger.error("Не удалось отправить письмо на %s: %s", to, exc)
        return False


def _otp_email_html(code: str, heading: str, lead: str, footnote: str) -> str:
    """Общий HTML-каркас для писем с OTP-кодом — оформление в стиле продукта
    (тёмная тема, акцент #00d9a0, см. webapp/src/styles/tokens.css), крупный
    код с межбуквенным интервалом, чтобы цифры не путались друг с другом."""
    spaced_code = " ".join(code)
    return f"""\
<!DOCTYPE html>
<html lang="ru">
  <body style="margin:0;padding:0;background:#0b0d10;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0d10;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:420px;background:linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0)), #121418;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">
            <tr>
              <td style="padding:28px 28px 0 28px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="width:32px;height:32px;border-radius:9px;background:linear-gradient(135deg,#00d9a0,#00a87c);text-align:center;vertical-align:middle;font-weight:700;color:#04140f;font-size:14px;">CN</td>
                    <td style="padding-left:10px;font-size:16px;font-weight:600;color:#f2f3f5;">CodeNexa</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px 4px 28px;font-size:19px;font-weight:600;color:#f2f3f5;">{heading}</td>
            </tr>
            <tr>
              <td style="padding:0 28px 22px 28px;font-size:13.5px;line-height:1.6;color:#9aa0aa;">{lead}</td>
            </tr>
            <tr>
              <td style="padding:0 28px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#181b20;border:1px solid rgba(0,217,160,0.25);border-radius:14px;">
                  <tr>
                    <td style="padding:20px;text-align:center;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:#00d9a0;">
                      {spaced_code}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px 28px 28px;font-size:12px;line-height:1.6;color:#5f6570;">{footnote}</td>
            </tr>
          </table>
          <div style="max-width:420px;padding:16px 12px 0;font-size:11px;color:#3f434b;text-align:center;">
            CodeNexa · это письмо отправлено автоматически, отвечать на него не нужно
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>"""


def build_verify_email_message(code: str) -> tuple[str, str, str]:
    """Возвращает (subject, html, text) для письма подтверждения email."""
    ttl_min = settings.OTP_TTL_SECONDS // 60
    subject = f"{code} — код подтверждения email CodeNexa"
    html = _otp_email_html(
        code,
        heading="Подтвердите email",
        lead="Введите этот код в CodeNexa, чтобы подтвердить, что этот адрес принадлежит вам.",
        footnote=(
            f"Код действителен {ttl_min} минут. Если вы не запрашивали подтверждение "
            "email в CodeNexa — просто проигнорируйте это письмо, аккаунт останется "
            "без изменений."
        ),
    )
    text = (
        f"Код подтверждения email CodeNexa: {code}\n\n"
        f"Введите его в приложении, чтобы подтвердить адрес. Код действителен {ttl_min} минут.\n"
        "Если вы не запрашивали подтверждение — проигнорируйте это письмо."
    )
    return subject, html, text


def build_password_reset_message(code: str) -> tuple[str, str, str]:
    """Возвращает (subject, html, text) для письма сброса пароля."""
    ttl_min = settings.OTP_TTL_SECONDS // 60
    subject = f"{code} — код для сброса пароля CodeNexa"
    html = _otp_email_html(
        code,
        heading="Сброс пароля",
        lead="Кто-то (надеемся, что вы) запросил сброс пароля для аккаунта CodeNexa с этим email. Введите код ниже, чтобы задать новый пароль.",
        footnote=(
            f"Код действителен {ttl_min} минут. Если это были не вы — просто "
            "проигнорируйте это письмо: пароль не изменится, пока кто-то не введёт "
            "этот код."
        ),
    )
    text = (
        f"Код для сброса пароля CodeNexa: {code}\n\n"
        f"Введите его в приложении, чтобы задать новый пароль. Код действителен {ttl_min} минут.\n"
        "Если это были не вы — проигнорируйте это письмо."
    )
    return subject, html, text
