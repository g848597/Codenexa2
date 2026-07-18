// Точка входа фронтенда. Восстановлена (файл отсутствовал в архиве) на основе
// контрактов, которые ожидают существующие компоненты — см. комментарии
// "см. main.js" в tabs.js, authCard.js, investorsAdmin.js.
//
// Порядок: телеметрия/Telegram SDK -> проверка сессии (или карточка входа) ->
// онбординг (если ещё не пройден) -> сборка дашборда из уже готовых секций.

import { initTelegram, isInsideTelegram, getStartParam, showAlert } from './telegram.js';
import { initMonitoring, captureException } from './monitoring.js';
import { getLang, toggleLang, t } from './i18n.js';

import { authApi, getToken, setToken } from './api/authApi.js';
import { mountAuthCard } from './components/authCard.js';

import { initTabs } from './components/tabs.js';
import { mountOnboarding } from './components/onboarding.js';
import { isOnboardingComplete } from './state.js';

import { renderHero } from './components/hero.js';
import { renderLedgerList } from './components/ledgerCard.js';
import { PRODUCTS } from './config/products.js';
import { renderFlywheel } from './components/flywheelDiagram.js';
import { renderTimeline } from './components/timeline.js';
import { ROADMAP } from './config/roadmap.js';
import { renderPartners } from './components/partners.js';
import { renderTrust } from './components/trust.js';
import { renderInvestors } from './components/investors.js';

import { openProductView, rerenderOpenProductView } from './components/productDetail.js';
import { openAccountApp, rerenderOpenAccountApp } from './components/accountApp.js';
import { openLegalView, rerenderOpenLegalView } from './components/legal.js';

initMonitoring();
initTelegram();
document.documentElement.lang = getLang();

const authRoot = document.getElementById('auth-root');
const appShell = document.getElementById('app');

function renderDashboardSections() {
  renderHero(document.getElementById('hero-root'), refreshHeroAndLedger);
  renderLedgerList(document.getElementById('ledger-root'), PRODUCTS, refreshHeroAndLedger, openProductView);
  renderFlywheel(document.getElementById('flywheel-root'));
  renderTimeline(document.getElementById('timeline-root'), ROADMAP);
  renderPartners(document.getElementById('partners-root'));
  renderTrust(document.getElementById('trust-root'));
  renderInvestors(document.getElementById('investors-root'));
}

// Более лёгкий пере-рендер только той части, что реально меняется при
// подключении продукта — остальные секции (партнёры, доверие, инвесторы) не
// зависят от locally-connected состояния и не нуждаются в пере-рендере.
function refreshHeroAndLedger() {
  renderHero(document.getElementById('hero-root'), refreshHeroAndLedger);
  renderLedgerList(document.getElementById('ledger-root'), PRODUCTS, refreshHeroAndLedger, openProductView);
}

// Статичные подписи шапки/секций (не завязаны на данные компонента, поэтому
// не входят ни в один render*() — просто текст, который меняется по toggleLang).
function applyStaticLabels() {
  const map = {
    'data-badge': t('data_badge'),
    'products-title': t('products_title'),
    'flywheel-title': t('nav_flywheel'),
    'roadmap-title': t('nav_roadmap'),
    'partners-title': t('nav_partners'),
    'trust-title': t('nav_trust'),
  };
  Object.entries(map).forEach(([id, text]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  });
}

function wireChrome() {
  applyStaticLabels();
  initTabs();

  const accountTab = document.querySelector('.tab[data-view="account"]');
  if (accountTab) {
    accountTab.addEventListener('click', () => openAccountApp(handleLoggedOut));
  }

  const legalLink = document.getElementById('legal-link');
  if (legalLink) legalLink.addEventListener('click', openLegalView);

  const langToggle = document.getElementById('lang-toggle');
  if (langToggle) {
    langToggle.textContent = getLang().toUpperCase();
    langToggle.addEventListener('click', () => {
      const lang = toggleLang();
      langToggle.textContent = lang.toUpperCase();
      applyStaticLabels();
      // Пере-рендер того, что реально видно сейчас, в новом языке —
      // остальные full-screen разделы (docs/sport) сами читают t()/tl() при
      // следующем открытии, поэтому их трогать не нужно.
      renderDashboardSections();
      rerenderOpenProductView();
      rerenderOpenLegalView();
      rerenderOpenAccountApp();
    });
  }
}

function startApp() {
  appShell.hidden = false;
  wireChrome();

  if (isOnboardingComplete()) {
    renderDashboardSections();
  } else {
    mountOnboarding(document.getElementById('onboarding-root'), renderDashboardSections);
  }

  handleOrgInviteDeepLink();
}

// Ссылка-приглашение в организацию (см. profile/organizationSection.js —
// формат "startapp=org_invite_<token>"): принимаем приглашение сразу после
// входа и открываем HUB на экране "Организация", чтобы сотрудник увидел
// результат, а не потерялся на дашборде.
async function handleOrgInviteDeepLink() {
  const startParam = getStartParam();
  if (!startParam || !startParam.startsWith('org_invite_')) return;
  const token = startParam.slice('org_invite_'.length);
  if (!token) return;

  // Telegram отдаёт start_param на весь сеанс, а не только на первый запуск
  // по ссылке — без этой защиты повторное открытие мини-аппа снова и снова
  // дёргало бы /accept и показывало алерт "приглашение уже использовано".
  const handledKey = `codenexa_org_invite_handled:${token}`;
  try {
    if (sessionStorage.getItem(handledKey)) return;
    sessionStorage.setItem(handledKey, '1');
  } catch { /* sessionStorage недоступен — в худшем случае одна лишняя попытка */ }

  try {
    await authApi.acceptOrgInvite(token);
    openAccountApp(handleLoggedOut, { initialScreen: 'organization' });
    showAlert('Вы присоединились к организации!');
  } catch (e) {
    showAlert(e.message || 'Приглашение недействительно или уже использовано');
  }
}

function handleLoggedOut() {
  appShell.hidden = true;
  document.getElementById('view-account').innerHTML = '';
  mountAuthCard(authRoot, onAuthed);
}

function onAuthed() {
  authRoot.innerHTML = '';
  startApp();
}

async function ensureAuthenticated() {
  const token = getToken();
  if (token) {
    try {
      await authApi.me();
      onAuthed();
      return;
    } catch {
      setToken(null); // токен истёк/недействителен — просим войти заново
    }
  }

  // Внутри Telegram initData уже подписана клиентом — тихий вход без формы.
  if (isInsideTelegram()) {
    try {
      const result = await authApi.loginWithTelegram();
      setToken(result.token);
      onAuthed();
      return;
    } catch (e) {
      captureException(e, { stage: 'telegram-silent-login' });
      // падаем в форму входа ниже — снаружи Telegram или SDK не подтвердил initData
    }
  }

  mountAuthCard(authRoot, onAuthed);
}

ensureAuthenticated();
