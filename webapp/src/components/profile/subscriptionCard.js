// "МОЯ ПОДПИСКА" — единая CodeNexa Premium, а не "AI Sport PRO"/"AI Docs
// Premium" по отдельности (см. ТЗ). billing.subscription — честная проверка
// РЕАЛЬНОГО срока действия (см. app/web/repo.py::get_active_subscription):
// оплачена И (бессрочна ИЛИ ещё не истекла). Раньше здесь смотрели только на
// "платил хоть раз когда-либо" (billing.hasPaid) — это осталось в ответе API
// для обратной совместимости, но карточка теперь показывает настоящий статус.
import { t } from '../../i18n.js';
import { fmtDate } from '../../utils/format.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function subscriptionCardHTML(billing, plans) {
  const payments = (billing && billing.payments) || [];
  const sub = (billing && billing.subscription) || { active: false, plan: null, expiresAt: null };
  const isActive = !!sub.active;
  const paidPayments = payments.filter((p) => p.status === 'paid').sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const firstPaid = paidPayments[0];
  const planList = (plans && plans.plans) || [];
  const activePlan = planList.find((p) => p.code === lastPlanCodeMatch(sub.plan, planList));

  const planTitle = isActive ? (activePlan ? activePlan.title : t('hub_sub_paid_plan_fallback')) : t('hub_sub_free_plan');

  let badgeText = t('hub_sub_inactive');
  let badgeClass = 'inactive';
  if (isActive) {
    if (!sub.expiresAt) {
      badgeText = t('hub_sub_lifetime');
      badgeClass = 'active';
    } else {
      const daysLeft = Math.max(0, Math.ceil((new Date(sub.expiresAt).getTime() - Date.now()) / MS_PER_DAY));
      badgeText = `${t('hub_sub_expires_in')} ${daysLeft} ${t('hub_sub_days')}`;
      badgeClass = daysLeft <= 3 ? 'warning' : 'active';
    }
  } else if (paidPayments.length) {
    // Были оплаты, но срок вышел — отличаем от "вообще никогда не платил",
    // чтобы не выглядело так, будто человек ничего не покупал.
    badgeText = t('hub_sub_expired');
    badgeClass = 'expired';
  }

  return `
  <div class="hub-sub-card ${isActive ? 'is-premium' : ''}">
    <div class="hub-sub-top">
      <div class="hub-sub-plan">${planTitle}</div>
      <span class="hub-sub-badge ${badgeClass}">${badgeText}</span>
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
    ${!isActive ? `<p class="hub-empty-note" style="margin-top:10px;">${t('hub_sub_upsell')}</p>` : ''}
    <button class="hub-sub-manage-btn ${isActive ? '' : 'primary'}" data-hub-manage-sub type="button">
      ${isActive ? t('hub_sub_manage_btn') : t('hub_sub_view_plans_btn')}
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
