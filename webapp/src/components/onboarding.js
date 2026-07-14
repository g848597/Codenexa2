import { ONBOARDING_STEPS, INTEREST_OPTIONS } from '../config/onboarding.js';
import { setOnboardingComplete } from '../state.js';
import { haptic } from '../telegram.js';
import { t } from '../i18n.js';

let currentStep = 0;
let selectedInterest = null;

function progressDots() {
  return ONBOARDING_STEPS.map((_, i) => `<span class="${i <= currentStep ? 'done' : ''}"></span>`).join('');
}

function diagramBlock() {
  return `
  <div class="ob-flow-diagram">
    <div class="ob-node">Sport</div><div class="ob-arrow">→</div>
    <div class="ob-node">Docs</div><div class="ob-arrow">→</div>
    <div class="ob-node">Premium</div>
  </div>`;
}

function interestsBlock() {
  return `
  <div class="ob-interests">
    ${INTEREST_OPTIONS.map(o => `
      <div class="ob-chip ${selectedInterest === o.id ? 'selected' : ''}" data-interest="${o.id}">${t(o.i18nKey)}</div>
    `).join('')}
  </div>`;
}

function render(root, onDone) {
  const step = ONBOARDING_STEPS[currentStep];
  const isLast = currentStep === ONBOARDING_STEPS.length - 1;

  root.innerHTML = `
  <div class="ob-overlay">
    <div class="ob-progress">${progressDots()}</div>
    <div class="ob-body">
      <div class="ob-eyebrow">${t('ob_' + step.i18nKey + '_eyebrow')}</div>
      <div class="ob-title">${t('ob_' + step.i18nKey + '_title')}</div>
      <div class="ob-desc">${t('ob_' + step.i18nKey + '_desc')}</div>
      ${step.diagram ? diagramBlock() : ''}
      ${step.interests ? interestsBlock() : ''}
    </div>
    <div class="ob-footer">
      ${currentStep > 0 ? `<button class="ob-btn ghost" data-ob-back>${t('ob_back')}</button>` : ''}
      <button class="ob-btn primary" data-ob-next>${isLast ? t('ob_start') : t('ob_next')}</button>
    </div>
  </div>`;

  root.querySelectorAll('[data-interest]').forEach((chip) => {
    chip.addEventListener('click', () => {
      selectedInterest = chip.dataset.interest;
      haptic('light');
      render(root, onDone);
    });
  });

  const backBtn = root.querySelector('[data-ob-back]');
  if (backBtn) backBtn.addEventListener('click', () => { currentStep -= 1; render(root, onDone); });

  root.querySelector('[data-ob-next]').addEventListener('click', () => {
    if (isLast) {
      setOnboardingComplete(selectedInterest);
      haptic('medium');
      root.innerHTML = '';
      onDone();
    } else {
      currentStep += 1;
      render(root, onDone);
    }
  });
}

export function mountOnboarding(root, onDone) {
  currentStep = 0;
  selectedInterest = null;
  render(root, onDone);
}
