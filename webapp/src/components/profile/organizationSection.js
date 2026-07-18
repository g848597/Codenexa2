// "ОРГАНИЗАЦИЯ" — общий аккаунт компании поверх app/web/api/organizations.py.
// Один business_yearly-платёж = одна организация, внутри неё — сотрудники
// (owner + member), общие приватные шаблоны документов (см. app/web/api/docs.py,
// document_templates.owner_org_id). Здесь только сама организация: кто её
// купил, кто в ней состоит, приглашения и выход/удаление участников.
//
// Важно: "общий аккаунт для всех проектов" сейчас честно означает раздел
// "Документы" (шаблоны) — AI Sport/Investors пока не читают org_id вообще
// (см. аудит по этому поводу в README_BACKEND.md/CHANGES). Расширять общий
// доступ на реальные деньги/прогнозы — отдельная задача с продуктовым
// решением о правах доступа внутри команды, не делаем это неявно здесь.
import { t } from '../../i18n.js';
import { esc } from '../../utils/html.js';
import { authApi } from '../../api/authApi.js';
import { haptic, showAlert } from '../../telegram.js';

const BUSINESS_PLAN_CODES = new Set(['business_yearly']);

function hasBusinessPlan(billing) {
  const payments = (billing && billing.payments) || [];
  return payments.some((p) => p.status === 'paid' && BUSINESS_PLAN_CODES.has(p.plan));
}

// state.org shape: { loading, error, data: {organization, members} | null }
// state.orgUi shape: { busy: {}, notice: null, inviteLink: null, createOpen: false }

export function organizationSectionHTML(state, currentUserId, billing) {
  const org = state.org;
  const ui = state.orgUi;

  if (!org || org.loading) {
    return `<div class="hub-org-card"><p class="hub-empty-note">${t('hub_loading_generic')}</p></div>`;
  }
  if (org.error) {
    return `<div class="hub-org-card"><p class="hub-notice err">${esc(org.error)}</p></div>`;
  }

  const data = org.data;
  if (!data || !data.organization) {
    const eligible = hasBusinessPlan(billing);
    if (!eligible) {
      return `
      <div class="hub-org-card">
        <div class="hub-org-name">${t('org_none_locked_title')}</div>
        <p class="hub-empty-note" style="margin-top:8px;">${t('org_none_locked_desc')}</p>
        <button class="hub-sub-manage-btn" data-org-view-plans type="button">${t('org_none_locked_cta')}</button>
      </div>`;
    }
    return `
    <div class="hub-org-card">
      <div class="hub-org-name">${t('org_none_eligible_title')}</div>
      <p class="hub-empty-note" style="margin-top:8px;">${t('org_none_eligible_desc')}</p>
      <form class="hub-org-create-form" data-org-create-form>
        <input class="hub-org-create-input" type="text" maxlength="80"
          placeholder="${t('org_create_name_placeholder')}" data-org-name-input required />
        <button class="hub-org-create-submit" type="submit" ${ui.busy.create ? 'disabled' : ''}>${t('org_create_submit')}</button>
      </form>
      ${ui.notice ? `<div class="hub-notice ${ui.notice.ok ? 'ok' : 'err'}">${esc(ui.notice.text)}</div>` : ''}
    </div>`;
  }

  const orgInfo = data.organization;
  const members = data.members || [];
  const isOwner = orgInfo.myRole === 'owner';
  const owner = members.find((m) => m.role === 'owner');
  const ownerLabel = owner
    ? (owner.userId === currentUserId ? t('org_purchased_by_you') : (fullName(owner) || owner.email || '—'))
    : '—';

  return `
  <div class="hub-org-card">
    <div class="hub-org-top">
      <div class="hub-org-name">${esc(orgInfo.name)}</div>
      <span class="hub-org-role-badge ${isOwner ? 'owner' : 'member'}">${isOwner ? t('org_your_role_owner') : t('org_your_role_member')}</span>
    </div>
    <div class="hub-org-owner-line">${t('org_purchased_by')}: <b>${esc(ownerLabel)}</b></div>

    <div class="hub-menu-hint" style="margin:16px 0 0 0;">${t('org_members_title')} · ${members.length}</div>
    <div class="hub-org-members">
      ${members.map((m) => memberRowHTML(m, currentUserId, isOwner)).join('')}
    </div>

    ${isOwner ? `
      <button class="hub-org-invite-btn" data-org-invite type="button" ${ui.busy.invite ? 'disabled' : ''}>${t('org_invite_btn')}</button>
      ${ui.inviteLink ? `
        <p class="hub-empty-note" style="margin-top:10px;">${t('org_invite_link_ready')}</p>
        <div class="hub-ref-link-row">
          <input type="text" class="hub-ref-link-input" value="${esc(ui.inviteLink)}" readonly data-org-invite-link />
          <button class="hub-ref-copy-btn" data-org-invite-copy type="button">${t('org_invite_copy')}</button>
        </div>` : ''}
    ` : `
      <button class="hub-org-leave-btn" data-org-leave type="button" ${ui.busy.leave ? 'disabled' : ''}>${t('org_leave_btn')}</button>
    `}

    ${ui.notice ? `<div class="hub-notice ${ui.notice.ok ? 'ok' : 'err'}">${esc(ui.notice.text)}</div>` : ''}
  </div>`;
}

function fullName(m) {
  return [m.firstName, m.lastName].filter(Boolean).join(' ').trim();
}

function memberRowHTML(m, currentUserId, isOwner) {
  const name = fullName(m) || m.email || t('hub_no_name');
  const isYou = m.userId === currentUserId;
  return `
  <div class="hub-org-member-row">
    <span class="hub-org-member-name">${esc(name)}${isYou ? `<span class="hub-org-member-you">· ${t('org_you_badge')}</span>` : ''}</span>
    <span class="hub-org-member-role">${m.role === 'owner' ? t('org_your_role_owner') : t('org_your_role_member')}</span>
    ${isOwner && !isYou ? `<button class="hub-org-remove-btn" data-org-remove="${m.userId}" type="button">${t('org_remove_member')}</button>` : ''}
  </div>`;
}

export function bindOrganizationSection(root, ctx) {
  const { state, render, showViewPlans } = ctx;
  const ui = state.orgUi;

  const viewPlansBtn = root.querySelector('[data-org-view-plans]');
  if (viewPlansBtn) viewPlansBtn.addEventListener('click', () => { haptic('light'); if (showViewPlans) showViewPlans(); });

  const createForm = root.querySelector('[data-org-create-form]');
  if (createForm) {
    createForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = root.querySelector('[data-org-name-input]');
      const name = (input.value || '').trim();
      if (!name) return;
      ui.busy.create = true; ui.notice = null; render();
      try {
        await authApi.createOrganization(name);
        await ctx.reloadOrg();
      } catch (err) {
        ui.notice = { ok: false, text: err.message || 'Не удалось создать организацию' };
      }
      ui.busy.create = false; render();
    });
  }

  const inviteBtn = root.querySelector('[data-org-invite]');
  if (inviteBtn) {
    inviteBtn.addEventListener('click', async () => {
      ui.busy.invite = true; ui.notice = null; render();
      try {
        const res = await authApi.inviteOrgMember();
        ui.inviteLink = `https://t.me/codenexa_bot?startapp=org_invite_${encodeURIComponent(res.token)}`;
      } catch (err) {
        ui.notice = { ok: false, text: err.message || 'Не удалось создать приглашение' };
      }
      ui.busy.invite = false; render();
    });
  }

  const copyBtn = root.querySelector('[data-org-invite-copy]');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const input = root.querySelector('[data-org-invite-link]');
      input.select();
      try { document.execCommand('copy'); } catch { /* clipboard unavailable */ }
      haptic('light');
      copyBtn.textContent = t('org_invite_copied');
      setTimeout(() => { copyBtn.textContent = t('org_invite_copy'); }, 1500);
    });
  }

  const leaveBtn = root.querySelector('[data-org-leave]');
  if (leaveBtn) {
    leaveBtn.addEventListener('click', async () => {
      const ok = await showConfirm(t('org_leave_confirm'));
      if (!ok) return;
      ui.busy.leave = true; render();
      try {
        await authApi.leaveOrganization();
        await ctx.reloadOrg();
      } catch (err) {
        ui.notice = { ok: false, text: err.message || 'Не удалось покинуть организацию' };
      }
      ui.busy.leave = false; render();
    });
  }

  root.querySelectorAll('[data-org-remove]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const userId = Number(btn.dataset.orgRemove);
      const ok = await showConfirm(t('org_remove_confirm'));
      if (!ok) return;
      try {
        await authApi.removeOrgMember(userId);
        await ctx.reloadOrg();
      } catch (err) {
        ui.notice = { ok: false, text: err.message || 'Не удалось удалить сотрудника' };
        render();
      }
    });
  });
}

// window.confirm недоступен/непредсказуем внутри Telegram WebView на части
// клиентов — showAlert из telegram.js гарантированно работает там, поэтому
// для деструктивных действий используем обычный window.confirm как базу,
// но оборачиваем в try, чтобы не уронить обработчик на редких платформах.
async function showConfirm(message) {
  try {
    return window.confirm(message);
  } catch {
    showAlert(message);
    return false;
  }
}
