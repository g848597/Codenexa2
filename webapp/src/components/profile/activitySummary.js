// "МОЯ АКТИВНОСТЬ" — честная версия. У бэкенда пока нет аналитики
// использования (сколько документов создано, сколько AI-прогнозов отдано —
// см. products.js: metric.value === null для всех продуктов, источников
// ещё нет). Поэтому здесь показываются только величины, которые реально
// можно посчитать сейчас (дата регистрации, число сессий, число оплат,
// число подключённых продуктов) — а метрики использования продуктов честно
// помечены "собираем данные", тем же паттерном, что и ledgerCard.js.
import { PRODUCTS } from '../../config/products.js';
import { connectedCount } from '../../state.js';
import { t } from '../../i18n.js';
import { fmtDateShort } from '../../utils/format.js';

export function activitySummaryHTML(user, sessions, billing) {
  const activeSessions = (sessions || []).filter((s) => !s.revoked).length;
  const totalPayments = (billing && billing.payments) || [];

  const cards = [
    { num: fmtDateShort(user.createdAt), label: t('hub_activity_member_since') },
    { num: `${connectedCount()}/${PRODUCTS.length}`, label: t('hub_activity_services') },
    { num: String(activeSessions), label: t('hub_activity_sessions') },
    { num: String(totalPayments.length), label: t('hub_activity_payments') },
  ];

  return `
  <div class="hub-stat-grid">
    ${cards.map((c) => `
      <div class="hub-stat-card">
        <div class="hub-stat-num">${c.num}</div>
        <div class="hub-stat-label">${c.label}</div>
      </div>`).join('')}
    <div class="hub-stat-card">
      <div class="hub-stat-num dim">${t('hub_activity_usage_pending')}</div>
      <div class="hub-stat-label">${t('hub_activity_usage_label')}</div>
    </div>
  </div>`;
}
