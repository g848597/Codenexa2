// "AI CENTER" — реальный, посчитанный на клиенте инсайт (доля подключённых
// продуктов каталога + рекомендация следующего), а не имитация "нейросеть
// что-то придумала". Мы не пишем "ИИ анализирует использование экосистемы"
// текстом, который ничем не подкреплён — вместо этого честно называем это
// рекомендацией на основе каталога подключённых продуктов.
import { PRODUCTS } from '../../config/products.js';
import { isConnected } from '../../state.js';
import { t, tl } from '../../i18n.js';
import { icon } from '../../utils/icons.js';
import { haptic } from '../../telegram.js';

export function aiInsightsHTML() {
  const total = PRODUCTS.length;
  const connected = PRODUCTS.filter((p) => isConnected(p.id)).length;
  const pct = total ? Math.round((connected / total) * 100) : 0;
  const next = PRODUCTS.find((p) => !isConnected(p.id));

  const text = next
    ? t('hub_ai_suggest_text', next.name, tl(next.tagline))
    : t('hub_ai_all_connected_text');

  return `
  <div class="hub-ai-card">
    <div class="hub-ai-icon">${icon('sparkles')}</div>
    <div style="flex:1; min-width:0;">
      <div class="hub-ai-title">${t('hub_ai_title')}</div>
      <div class="hub-ai-text">${text}</div>
      <div class="hub-ai-bar-track"><div class="hub-ai-bar-fill" style="width:${pct}%"></div></div>
      <div class="hub-empty-note" style="margin-top:6px;">${t('hub_ai_pct_note', pct)}</div>
      ${next ? `<button class="hub-ai-cta" data-hub-ai-open="${next.id}" type="button">${t('hub_ai_cta', next.name)} ${icon('arrowRight')}</button>` : ''}
    </div>
  </div>`;
}

export function bindAiInsights(root, onOpenProduct) {
  const btn = root.querySelector('[data-hub-ai-open]');
  if (btn) {
    btn.addEventListener('click', () => {
      haptic('light');
      if (onOpenProduct) onOpenProduct(btn.dataset.hubAiOpen);
    });
  }
}
