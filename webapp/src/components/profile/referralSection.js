// "РЕФЕРАЛЬНАЯ ПРОГРАММА" — использует РЕАЛЬНУЮ статистику с бэкенда
// (GET /api/referrals/me, см. app/web/api/referrals.py): confirmedCount
// засчитывается только после первой успешной оплаты приглашённого, так что
// это число нельзя накрутить регистрациями без оплаты. Ссылка строится по
// той же схеме, что и в components/partners.js (t.me/codenexa_bot?start=ref_<id>).
import { haptic, getTelegramUser } from '../../telegram.js';
import { t } from '../../i18n.js';
import { esc } from '../../utils/html.js';

export function referralSectionHTML(referralStats) {
  const tgUser = getTelegramUser();
  const code = (referralStats && referralStats.referralCode) || (tgUser && tgUser.id ? String(tgUser.id) : null);
  const confirmed = referralStats ? referralStats.confirmedCount : 0;
  const pending = referralStats ? referralStats.pendingCount : 0;

  if (!code) {
    return `
    <div class="hub-ref-card">
      <p class="hub-empty-note">${t('hub_ref_no_telegram')}</p>
    </div>`;
  }

  const link = `https://t.me/codenexa_bot?start=ref_${esc(code)}`;

  return `
  <div class="hub-ref-card">
    <div class="hub-ref-link-row">
      <input type="text" class="hub-ref-link-input" value="${link}" readonly />
      <button class="hub-ref-copy-btn" data-hub-ref-copy type="button">${t('pt_copy_btn')}</button>
    </div>
    <div class="hub-ref-stats">
      <div class="hub-ref-stat"><span class="num">${confirmed}</span><span class="label">${t('hub_ref_confirmed')}</span></div>
      <div class="hub-ref-stat"><span class="num">${pending}</span><span class="label">${t('hub_ref_pending')}</span></div>
    </div>
    <p class="hub-empty-note" style="margin-top:10px;">${t('hub_ref_note')}</p>
  </div>`;
}

export function bindReferralSection(root) {
  const copyBtn = root.querySelector('[data-hub-ref-copy]');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const input = root.querySelector('.hub-ref-link-input');
      input.select();
      try { document.execCommand('copy'); } catch { /* clipboard unavailable */ }
      haptic('light');
      copyBtn.textContent = t('pt_copied_btn');
      setTimeout(() => { copyBtn.textContent = t('pt_copy_btn'); }, 1500);
    });
  }
}
