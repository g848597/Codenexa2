import { REFERRAL_TERMS, PARTNER_TIERS, PARTNER_APPLICATION_ENDPOINT, PARTNERS_SHOWCASE, API_PARTNER_INFO } from '../config/partners.js';
import { getReferralCode, getInvitedCount } from '../state.js';
import { getTelegramUser } from '../telegram.js';
import { haptic } from '../telegram.js';
import { t, tl } from '../i18n.js';
import { esc } from '../utils/html.js';

// Единственное место в этом файле, куда попадает свободный текст, введённый
// вручную владельцем в PARTNERS_SHOWCASE (название партнёра) — экранируем на
// всякий случай, тем же паттерном, что и в trust.js/docsApp.js/sportApp.js.
let selectedTier = PARTNER_TIERS[0].id;

function termsLabel(rewardValue, rewardUnit, description) {
  if (rewardValue === null || rewardUnit === null) {
    return `<span class="pt-pending">${t('pt_pending')}</span>`;
  }
  return `<span class="pt-value">${rewardValue}${rewardUnit}</span>${description ? ` <span class="pt-desc">${tl(description)}</span>` : ''}`;
}

function referralBlock() {
  const tgUser = getTelegramUser();
  const code = getReferralCode(tgUser && tgUser.id ? tgUser.id : null);
  const link = `https://t.me/codenexa_bot?start=ref_${code}`;
  const invited = getInvitedCount();

  return `
  <div class="pd-block">
    <h3>${t('pt_referral_title')}</h3>
    <div class="ref-link-row">
      <input type="text" class="ref-link-input" value="${link}" readonly>
      <button class="ref-copy-btn" data-copy-link>${t('pt_copy_btn')}</button>
    </div>
    <div class="ref-stats-row">
      <div class="ref-stat">
        <span class="ref-stat-num">${invited}</span>
        <span class="ref-stat-label">${t('pt_invited_label')}</span>
      </div>
      <div class="ref-stat">
        ${termsLabel(REFERRAL_TERMS.rewardValue, REFERRAL_TERMS.rewardUnit, REFERRAL_TERMS.description)}
        <span class="ref-stat-label">${t('pt_reward_label')}</span>
      </div>
    </div>
    <p class="ref-honesty-note">${t('pt_referral_note')}</p>
  </div>`;
}

function tierChipsBlock() {
  return `
  <div class="pt-chips">
    ${PARTNER_TIERS.map(tier => `<div class="pt-chip ${selectedTier === tier.id ? 'selected' : ''}" data-tier="${tier.id}">${tl(tier.label)}</div>`).join('')}
  </div>
  <div class="pt-terms-list">
    ${PARTNER_TIERS.map(tier => `
      <div class="pt-terms-row" data-tier-terms="${tier.id}" style="display:${selectedTier === tier.id ? 'flex' : 'none'}">
        <span>${tl(tier.label)}</span>
        ${termsLabel(tier.rewardValue, tier.rewardUnit)}
      </div>`).join('')}
  </div>`;
}

function applicationFormBlock() {
  return `
  <div class="pd-block">
    <h3>${t('pt_become_partner_title')}</h3>
    ${tierChipsBlock()}
    <div class="pt-form">
      <input type="text" class="pt-input" id="pt-name" placeholder="${t('pt_name_placeholder')}">
      <input type="text" class="pt-input" id="pt-contact" placeholder="${t('pt_contact_placeholder')}">
      <textarea class="pt-input pt-textarea" id="pt-message" placeholder="${t('pt_message_placeholder')}"></textarea>
      <button class="pt-submit" data-submit-application>${t('pt_submit_btn')}</button>
    </div>
    <p class="ref-honesty-note">${t('pt_form_note')}</p>
  </div>`;
}

function apiPartnerBlock() {
  const statusKey = { not_available: 'pt_api_status_not_available', waitlist: 'pt_api_status_waitlist', available: 'pt_api_status_available' }[API_PARTNER_INFO.status];
  return `
  <div class="pd-block">
    <h3>${t('pt_api_title')}</h3>
    <span class="api-status-pill">${t(statusKey)}</span>
    <p class="pt-api-desc">${tl(API_PARTNER_INFO.description)}</p>
    <button class="pt-submit ghost" data-submit-application data-api="1">${t('pt_api_waitlist_btn')}</button>
  </div>`;
}

function showcaseBlock() {
  if (!PARTNERS_SHOWCASE.length) {
    return `
    <div class="pd-block">
      <h3>${t('pt_partners_title')}</h3>
      <div class="pd-empty">${t('pt_partners_empty')}</div>
    </div>`;
  }
  return `
  <div class="pd-block">
    <h3>${t('pt_partners_title')}</h3>
    <div class="partner-grid">
      ${PARTNERS_SHOWCASE.map(p => `<div class="partner-logo">${esc(p.name)}</div>`).join('')}
    </div>
  </div>`;
}

export function renderPartners(container) {
  container.innerHTML = `
    <div class="section-head" style="margin-top:6px;">
      <h2>${t('partners_header_title')}</h2>
      <span>${t('partners_header_tag')}</span>
    </div>
    <p class="muted-lead">${t('partners_lead')}</p>
    ${referralBlock()}
    ${applicationFormBlock()}
    ${apiPartnerBlock()}
    ${showcaseBlock()}
  `;

  const copyBtn = container.querySelector('[data-copy-link]');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const input = container.querySelector('.ref-link-input');
      input.select();
      try { document.execCommand('copy'); } catch { /* clipboard unavailable in this context */ }
      haptic('light');
      copyBtn.textContent = t('pt_copied_btn');
      setTimeout(() => { copyBtn.textContent = t('pt_copy_btn'); }, 1500);
    });
  }

  container.querySelectorAll('[data-tier]').forEach((chip) => {
    chip.addEventListener('click', () => {
      selectedTier = chip.dataset.tier;
      haptic('light');
      renderPartners(container);
    });
  });

  container.querySelectorAll('[data-submit-application]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const isApi = btn.dataset.api === '1';
      const name = container.querySelector('#pt-name');
      const contact = container.querySelector('#pt-contact');
      const message = container.querySelector('#pt-message');
      const tierLabel = tl(PARTNER_TIERS.find(tier => tier.id === selectedTier).label);

      const subject = isApi
        ? t('pt_subject_api')
        : t('pt_subject_partner', tierLabel);

      const bodyLines = isApi
        ? [t('pt_body_api')]
        : [
            t('pt_body_type', tierLabel),
            t('pt_body_name', name ? name.value : ''),
            t('pt_body_contact', contact ? contact.value : ''),
            t('pt_body_message', message ? message.value : ''),
          ];

      const mailto = `mailto:${PARTNER_APPLICATION_ENDPOINT.target}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join('\n'))}`;
      window.location.href = mailto;
      haptic('medium');
    });
  });
}
