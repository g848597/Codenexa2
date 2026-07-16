// Модуль профиля: шапка HUB'а. Тир ("CodeNexa Member" / "Premium" / "Founder")
// вычисляется из РЕАЛЬНЫХ полей — user.isAdmin (см. app/web/api/auth.py,
// _public_user) и billing.hasPaid (см. app/web/api/billing.py, billing_status).
// Мы намеренно не рисуем "Business"/произвольные тиры, которых бэкенд не
// знает — правило №1 проекта (см. config/products.js, config/trust.js):
// честное состояние вместо красивой выдумки.
import { esc } from '../../utils/html.js';
import { icon } from '../../utils/icons.js';
import { t } from '../../i18n.js';

function initials(u) {
  const n = (u.firstName || u.email || 'U').trim();
  return n.slice(0, 1).toUpperCase();
}

export function resolveTier(user, hasPaid) {
  if (user.isAdmin) return { key: 'founder', label: t('hub_tier_founder'), icon: 'crown' };
  if (hasPaid) return { key: 'premium', label: t('hub_tier_premium'), icon: 'sparkles' };
  return { key: 'member', label: t('hub_tier_member'), icon: 'user' };
}

export function hubHeaderHTML(user, hasPaid) {
  const tier = resolveTier(user, hasPaid);
  const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || t('hub_no_name');
  const handle = user.email || (user.hasTelegram ? t('hub_via_telegram') : t('hub_no_email'));

  return `
  <div class="hub-header">
    <div class="hub-header-row">
      <div class="hub-avatar-ring">
        <div class="hub-avatar">${user.avatarUrl ? `<img src="${esc(user.avatarUrl)}" alt="" />` : initials(user)}</div>
      </div>
      <div class="hub-id">
        <div class="hub-name">${esc(fullName)}</div>
        <div class="hub-handle">${esc(handle)}</div>
        <div class="hub-tier tier-${tier.key}">${icon(tier.icon)} ${esc(tier.label)}</div>
      </div>
      <button class="hub-edit-btn" data-hub-edit-profile type="button">${t('hub_edit_profile_btn')}</button>
    </div>
  </div>`;
}
