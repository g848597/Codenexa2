// Финальная premium-карточка профиля — "One Account. One Ecosystem.
// Unlimited AI." Чисто визуальный CTA, без цифр/заявлений, которые надо
// было бы подтверждать данными.
import { t } from '../../i18n.js';

export function ecosystemBannerHTML() {
  return `
  <div class="hub-banner">
    <svg class="hub-banner-net" viewBox="0 0 300 140" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g stroke="var(--ledger)" stroke-width="1" opacity="0.55">
        <line x1="150" y1="70" x2="40" y2="25"/>
        <line x1="150" y1="70" x2="260" y2="25"/>
        <line x1="150" y1="70" x2="40" y2="115"/>
        <line x1="150" y1="70" x2="260" y2="115"/>
        <line x1="150" y1="70" x2="150" y2="15"/>
      </g>
      <circle cx="150" cy="70" r="9" fill="var(--ledger)"/>
      <circle cx="40" cy="25" r="5" fill="var(--steel)"/>
      <circle cx="260" cy="25" r="5" fill="var(--violet)"/>
      <circle cx="40" cy="115" r="5" fill="var(--steel)"/>
      <circle cx="260" cy="115" r="5" fill="var(--violet)"/>
      <circle cx="150" cy="15" r="5" fill="var(--amber)"/>
    </svg>
    <div class="hub-banner-mark">CODE NEXA</div>
    <div class="hub-banner-line"><b>${t('hub_banner_line1')}</b> · ${t('hub_banner_line2')} · ${t('hub_banner_line3')}</div>
  </div>`;
}
