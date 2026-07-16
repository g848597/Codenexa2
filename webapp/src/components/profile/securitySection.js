// "БЕЗОПАСНОСТЬ" — функционально это тот же блок, что раньше был единственным
// содержимым accountApp.js (пароль/2FA/сессии), просто вынесен в отдельный
// модуль под новой HUB-оболочкой. Логика запросов к authApi не менялась.
import { authApi } from '../../api/authApi.js';
import { haptic } from '../../telegram.js';
import { esc } from '../../utils/html.js';
import { icon } from '../../utils/icons.js';
import { fmtDate } from '../../utils/format.js';
import { t } from '../../i18n.js';

function methodBadge(active, label) {
  return `<span class="acc-badge ${active ? 'on' : 'off'}">${active ? icon('check') : '—'} ${esc(label)}</span>`;
}

export function securitySectionHTML(user, state) {
  const notice = state.notices.security
    ? `<div class="hub-notice ${state.notices.security.ok ? 'ok' : 'err'}">${esc(state.notices.security.text)}</div>`
    : '';

  const passwordForm = `
    <form class="acc-form" data-acc-password-form>
      ${
        user.hasPassword
          ? `<label class="acc-field"><span>${t('hub_sec_current_password')}</span><input type="password" name="currentPassword" autocomplete="current-password" /></label>`
          : ''
      }
      <label class="acc-field"><span>${t('hub_sec_new_password')}</span><input type="password" name="newPassword" minlength="8" required autocomplete="new-password" /></label>
      <button class="acc-btn acc-btn-small" ${state.busy.password ? 'disabled' : ''}>${user.hasPassword ? t('hub_sec_change_password_btn') : t('hub_sec_set_password_btn')}</button>
    </form>`;

  let totpBlock;
  if (user.twoFaEnabled) {
    totpBlock = `
    <p class="acc-muted">${t('hub_sec_2fa_enabled')}</p>
    <form class="acc-form" data-acc-2fa-disable-form>
      <label class="acc-field"><span>${t('hub_sec_2fa_code_disable')}</span><input type="text" name="code" inputmode="numeric" placeholder="123456" required /></label>
      <button class="acc-btn acc-btn-small acc-btn-danger" ${state.busy.twofa ? 'disabled' : ''}>${t('hub_sec_2fa_disable_btn')}</button>
    </form>`;
  } else if (state.totpFlow) {
    totpBlock = `
    <p class="acc-muted">${t('hub_sec_2fa_scan')}</p>
    <div class="acc-totp-secret">${esc(state.totpFlow.secret)}</div>
    <form class="acc-form" data-acc-2fa-confirm-form>
      <label class="acc-field"><span>${t('hub_sec_2fa_code_confirm')}</span><input type="text" name="code" inputmode="numeric" placeholder="123456" required /></label>
      <button class="acc-btn acc-btn-small" ${state.busy.twofa ? 'disabled' : ''}>${t('hub_sec_2fa_confirm_btn')}</button>
    </form>`;
  } else {
    totpBlock = `
    <p class="acc-muted">${t('hub_sec_2fa_pitch')}</p>
    <button class="acc-btn acc-btn-small" data-acc-2fa-start ${state.busy.twofa ? 'disabled' : ''}>${t('hub_sec_2fa_enable_btn')}</button>`;
  }

  const sessionsList =
    (state.sessions || [])
      .map(
        (s) => `
    <div class="acc-session ${s.revoked ? 'revoked' : ''}">
      <div>
        <div class="acc-session-ua">${esc(s.user_agent || t('hub_sec_unknown_device')).slice(0, 48)}</div>
        <div class="acc-session-meta">${esc(s.ip || '')} · ${fmtDate(s.created_at)}${s.revoked ? ` · ${t('hub_sec_revoked')}` : ''}</div>
      </div>
      ${!s.revoked ? `<button class="acc-link-btn" data-acc-revoke-session="${s.id}">${t('hub_sec_logout_session')}</button>` : ''}
    </div>`
      )
      .join('') || `<p class="acc-muted">${t('hub_sec_no_sessions')}</p>`;

  return `
  ${notice}
  <div class="acc-badges" style="margin-bottom:18px;">
    ${methodBadge(user.hasTelegram, 'Telegram')}
    ${methodBadge(user.hasGoogle, 'Google')}
    ${methodBadge(user.hasYandex, t('hub_sec_yandex'))}
    ${methodBadge(user.hasPassword, t('hub_sec_password'))}
  </div>
  <div class="acc-subblock">
    <div class="acc-subtitle">${user.hasPassword ? t('hub_sec_password') : t('hub_sec_set_password_title')}</div>
    ${passwordForm}
  </div>
  <div class="acc-subblock">
    <div class="acc-subtitle">${t('hub_sec_2fa_title')}</div>
    ${totpBlock}
  </div>
  <div class="acc-subblock">
    <div class="acc-subtitle">${t('hub_sec_sessions_title')}</div>
    ${sessionsList}
    ${(state.sessions || []).some((s) => !s.revoked) ? `<button class="acc-link-btn acc-link-danger" data-acc-revoke-all>${t('hub_sec_revoke_all_btn')}</button>` : ''}
  </div>`;
}

export function bindSecuritySection(root, { state, render, loadAll }) {
  const passForm = root.querySelector('[data-acc-password-form]');
  if (passForm)
    passForm.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      state.busy.password = true;
      render();
      try {
        await authApi.changePassword(fd.get('currentPassword') || undefined, fd.get('newPassword'));
        state.notices.security = { ok: true, text: t('hub_sec_password_updated') };
        haptic('medium');
        await loadAll();
      } catch (e) {
        state.notices.security = { ok: false, text: e.message };
      }
      state.busy.password = false;
      render();
    });

  const start2fa = root.querySelector('[data-acc-2fa-start]');
  if (start2fa)
    start2fa.addEventListener('click', async () => {
      state.busy.twofa = true;
      render();
      try {
        state.totpFlow = await authApi.setup2FA();
      } catch (e) {
        state.notices.security = { ok: false, text: e.message };
      }
      state.busy.twofa = false;
      render();
    });

  const confirm2fa = root.querySelector('[data-acc-2fa-confirm-form]');
  if (confirm2fa)
    confirm2fa.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const code = new FormData(ev.target).get('code');
      state.busy.twofa = true;
      render();
      try {
        await authApi.confirm2FA(code);
        state.totpFlow = null;
        state.notices.security = { ok: true, text: t('hub_sec_2fa_enabled_notice') };
        haptic('medium');
        await loadAll();
      } catch (e) {
        state.notices.security = { ok: false, text: e.message };
      }
      state.busy.twofa = false;
      render();
    });

  const disable2fa = root.querySelector('[data-acc-2fa-disable-form]');
  if (disable2fa)
    disable2fa.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const code = new FormData(ev.target).get('code');
      state.busy.twofa = true;
      render();
      try {
        await authApi.disable2FA(code);
        state.notices.security = { ok: true, text: t('hub_sec_2fa_disabled_notice') };
        await loadAll();
      } catch (e) {
        state.notices.security = { ok: false, text: e.message };
      }
      state.busy.twofa = false;
      render();
    });

  root.querySelectorAll('[data-acc-revoke-session]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await authApi.revokeSession(Number(btn.dataset.accRevokeSession));
      await loadAll();
    });
  });

  const revokeAll = root.querySelector('[data-acc-revoke-all]');
  if (revokeAll)
    revokeAll.addEventListener('click', async () => {
      await authApi.revokeAllSessions();
      await loadAll();
    });
}
