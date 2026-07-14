import { haptic } from '../telegram.js';

export function initTabs() {
  document.querySelectorAll('.tab').forEach((tab) => {
    if (tab.dataset.view === 'account') return; // аккаунт открывается через openAccountApp (main.js) — там своя логика
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('view-' + tab.dataset.view).classList.add('active');
      haptic('light');
    });
  });
}
