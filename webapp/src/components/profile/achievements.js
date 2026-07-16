// "ДОСТИЖЕНИЯ" — про аккаунт, не про ставки/прогнозы (ТЗ). Каждое достижение
// вычисляется из реального булева/числового поля (hasPassword, twoFaEnabled,
// оплаты, число подключённых продуктов, isAdmin) — никаких "100 документов"
// или "первый прогноз", т.к. этих счётчиков не существует в бэкенде (см.
// activitySummary.js). Список специально расширяемый: чтобы добавить новое
// достижение позже (когда появится реальная метрика использования продукта),
// достаточно добавить объект в массив ниже.
import { PRODUCTS } from '../../config/products.js';
import { connectedCount } from '../../state.js';
import { t } from '../../i18n.js';
import { icon } from '../../utils/icons.js';

function buildAchievements(user, billing) {
  const paidCount = ((billing && billing.payments) || []).filter((p) => p.status === 'paid').length;
  const connected = connectedCount();

  return [
    { id: 'password', icon: 'lock', label: t('hub_ach_password'), unlocked: !!user.hasPassword },
    { id: '2fa', icon: 'shieldCheck', label: t('hub_ach_2fa'), unlocked: !!user.twoFaEnabled },
    { id: 'first_payment', icon: 'creditCard', label: t('hub_ach_first_payment'), unlocked: paidCount > 0 },
    { id: 'premium', icon: 'sparkles', label: t('hub_ach_premium'), unlocked: !!(billing && billing.hasPaid) },
    { id: 'explorer', icon: 'layers', label: t('hub_ach_explorer'), unlocked: connected >= 2 },
    { id: 'full_ecosystem', icon: 'globe', label: t('hub_ach_full_ecosystem'), unlocked: connected >= PRODUCTS.length && PRODUCTS.length > 0 },
    { id: 'founder', icon: 'crown', label: t('hub_ach_founder'), unlocked: !!user.isAdmin },
  ];
}

export function achievementsHTML(user, billing) {
  const items = buildAchievements(user, billing);
  return `
  <div class="hub-ach-grid">
    ${items.map((a) => `
      <div class="hub-ach ${a.unlocked ? 'unlocked' : ''}">
        <div class="hub-ach-icon">${icon(a.icon)}</div>
        <div class="hub-ach-label">${a.label}</div>
      </div>`).join('')}
  </div>`;
}
