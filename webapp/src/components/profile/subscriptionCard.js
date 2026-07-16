// "МОЯ ПОДПИСКА" — единая CodeNexa Premium, а не "AI Sport PRO"/"AI Docs
// Premium" по отдельности (см. ТЗ). Бэкенд (app/web/api/billing.py) хранит
// только лог платежей — нет полей "дата окончания"/"автопродление"/"промокод"
// (см. app/web/repo.py — таблица plans/payments, без expires_at). Поэтому мы
// показываем честно то, что реально можно посчитать: подтверждён ли хоть
// один платёж (hasPaid) и с какой даты — а не выдумываем срок действия.
import { t } from '../../i18n.js';
import { fmtDate } from '../../utils/format.js';

export function subscriptionCardHTML(billing, plans) {
  const payments = (billing && billing.payments) || [];
  const hasPaid = !!(billing && billing.hasPaid);
  const paidPayments = payments.filter((p) => p.status === 'paid').sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const firstPaid = paidPayments[0];
  const lastPaidPlanCode = paidPayments.length ? paidPayments[paidPayments.length - 1].plan : null;
  const planList = (plans && plans.plans) || [];
  const lastPlan = planList.find((p) => p.code === lastPlanCodeMatch(lastPaidPlanCode, planList));

  const planTitle = hasPaid ? (lastPlan ? lastPlan.title : t('hub_sub_paid_plan_fallback')) : t('hub_sub_free_plan');

  return `
  <div class="hub-sub-card ${hasPaid ? 'is-premium' : ''}">
    <div class="hub-sub-top">
      <div class="hub-sub-plan">${planTitle}</div>
      <span class="hub-sub-badge ${hasPaid ? 'active' : 'inactive'}">${hasPaid ? t('hub_sub_active') : t('hub_sub_inactive')}</span>
    </div>
    <div class="hub-sub-meta">
      <div class="hub-sub-meta-item">
        <span class="num">${firstPaid ? fmtDate(firstPaid.created_at) : '—'}</span>
        <span class="label">${t('hub_sub_since')}</span>
      </div>
      <div class="hub-sub-meta-item">
        <span class="num">${paidPayments.length}</span>
        <span class="label">${t('hub_sub_payments_count')}</span>
      </div>
    </div>
    ${!hasPaid ? `<p class="hub-empty-note" style="margin-top:10px;">${t('hub_sub_upsell')}</p>` : ''}
    <button class="hub-sub-manage-btn ${hasPaid ? '' : 'primary'}" data-hub-manage-sub type="button">
      ${hasPaid ? t('hub_sub_manage_btn') : t('hub_sub_view_plans_btn')}
    </button>
  </div>`;
}

// В логе платежей код тарифа может не совпасть с активным (тариф могли
// изменить/отключить с тех пор) — в этом случае честно откатываемся на
// фолбэк-название, а не показываем название чужого/устаревшего тарифа.
function lastPlanCodeMatch(code, planList) {
  return planList.some((p) => p.code === code) ? code : null;
}

export function bindSubscriptionCard(root, scrollTargetId) {
  const btn = root.querySelector('[data-hub-manage-sub]');
  if (btn) {
    btn.addEventListener('click', () => {
      const target = document.getElementById(scrollTargetId);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
}
