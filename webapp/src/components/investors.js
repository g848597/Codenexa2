// Раздел "Инвесторы" — публичная витрина. Данные приходят с бэкенда
// (/api/investors), никакого хардкода: пусто на сервере = честно пусто здесь
// (тот же принцип, что и в partners.js/trust.js — Правило №1, без выдуманных данных).
import { investorsApi } from '../api/investorsApi.js';
import { t, getLang } from '../i18n.js';
import { countryFlag } from '../utils/countryFlags.js';
import { esc, escAttr } from '../utils/html.js';
import { icon } from '../utils/icons.js';

// Тот же паттерн экранирования свободного текста, что и в partners.js/trust.js —
// имя, компания, страна, описание приходят из админ-панели, где их вводит
// человек, поэтому это единственная граница, где нужен XSS-safe рендер.

let revealObserver = null;

function getRevealObserver() {
  if (revealObserver) return revealObserver;
  if (!('IntersectionObserver' in window)) return null;
  revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );
  return revealObserver;
}

function skeletonHTML(count = 4) {
  return Array.from(
    { length: count },
    () => `
    <div class="inv-skel">
      <div class="inv-skel-row">
        <div class="inv-skel-avatar"></div>
        <div class="inv-skel-lines">
          <div class="inv-skel-line"></div>
          <div class="inv-skel-line short"></div>
        </div>
      </div>
      <div class="inv-skel-block"></div>
      <div class="inv-skel-block w2"></div>
    </div>`
  ).join('');
}

function amountBlock(investor) {
  if (investor.investmentAmount && investor.investmentAmount.trim()) {
    return `<div class="inv-amount"><span class="v">${esc(investor.investmentAmount)}</span><span class="l">${t('inv_amount_label')}</span></div>`;
  }
  return `<div class="inv-amount is-pending"><span class="v">${t('inv_amount_pending')}</span></div>`;
}

function initials(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

function photoBlock(investor) {
  if (investor.photoUrl) {
    return `<img class="inv-photo" src="${escAttr(investor.photoUrl)}" alt="${escAttr(investor.name)}" loading="lazy" width="64" height="64">`;
  }
  return `<div class="inv-photo-fallback" aria-hidden="true">${esc(initials(investor.name)) || icon('star')}</div>`;
}

function cardHTML(investor) {
  const metaParts = [];
  if (investor.country) metaParts.push(esc(investor.country));
  const meta = metaParts.length
    ? `<div class="inv-meta-row"><span class="inv-country-flag" aria-hidden="true">${icon('mapPin')}</span>${metaParts.join(' · ')}</div>`
    : '';

  return `
  <article class="inv-card" data-id="${investor.id}">
    <div class="inv-card-inner">
      <span class="inv-status-pill">${t('inv_verified_badge')}</span>
      <div class="inv-card-top">
        ${photoBlock(investor)}
        <div class="inv-id">
          <div class="inv-name">${esc(investor.name)}</div>
          ${investor.position ? `<div class="inv-position">${esc(investor.position)}</div>` : ''}
          ${meta}
        </div>
      </div>
      ${investor.description ? `<p class="inv-desc">${esc(investor.description)}</p>` : ''}
      <div class="inv-divider"></div>
      <div class="inv-card-bottom">
        ${amountBlock(investor)}
        ${investor.company ? `<span class="inv-company-chip" title="${escAttr(investor.company)}">${esc(investor.company)}</span>` : ''}
      </div>
      ${investor.websiteUrl ? `<div style="padding:0 20px 20px;"><a class="inv-visit-btn" href="${escAttr(investor.websiteUrl)}" target="_blank" rel="noopener noreferrer">${t('inv_visit_btn')} →</a></div>` : ''}
    </div>
  </article>`;
}

function attachCardTilt(container) {
  container.querySelectorAll('.inv-card').forEach((card) => {
    if (card.dataset.tiltWired) return;
    card.dataset.tiltWired = '1';
    card.addEventListener('pointermove', (e) => {
      const rect = card.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * 100;
      const my = ((e.clientY - rect.top) / rect.height) * 100;
      card.querySelector('.inv-card-inner').style.setProperty('--mx', `${mx}%`);
      card.querySelector('.inv-card-inner').style.setProperty('--my', `${my}%`);
    });
  });
}

function revealCards(container) {
  const observer = getRevealObserver();
  const cards = container.querySelectorAll('.inv-card');
  if (!observer) {
    cards.forEach((c) => c.classList.add('in-view'));
    return;
  }
  cards.forEach((card, i) => {
    card.style.transitionDelay = `${Math.min(i, 6) * 60}ms`;
    observer.observe(card);
  });
}

function emptyStateHTML() {
  return `<div class="inv-empty"><span class="big">${icon('users')}</span>${t('inv_empty_state')}</div>`;
}

async function loadAndRenderGrid(gridEl, investors) {
  if (!investors.length) {
    gridEl.innerHTML = emptyStateHTML();
    return;
  }
  gridEl.innerHTML = investors.map(cardHTML).join('');
  attachCardTilt(gridEl);
  revealCards(gridEl);
}

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    'matchMedia' in window &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

// Считает от 0 до target с ease-out кубикой. При prefers-reduced-motion или
// target=0 просто выставляет конечное значение без анимации кадров.
export function animateCount(el, target, duration = 900) {
  const safeTarget = Number.isFinite(target) ? Math.max(0, Math.round(target)) : 0;
  if (!el) return;
  if (prefersReducedMotion() || safeTarget === 0 || typeof requestAnimationFrame !== 'function') {
    el.textContent = String(safeTarget);
    return;
  }
  // start захватывается из первого полученного таймстампа rAF, а не из
  // отдельного источника времени — так анимация не зависит от того, какие
  // именно часы использует конкретная реализация requestAnimationFrame
  // (важно и в реальном браузере, и в тестовом окружении с фейковым rAF).
  let start = null;
  function tick(now) {
    if (start === null) start = now;
    const elapsed = now - start;
    const p = Math.min(Math.max(elapsed / duration, 0), 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = String(Math.round(safeTarget * eased));
    if (p < 1) requestAnimationFrame(tick);
    else el.textContent = String(safeTarget);
  }
  requestAnimationFrame(tick);
}

let statsObserver = null;
function getStatsObserver() {
  if (statsObserver) return statsObserver;
  if (typeof IntersectionObserver === 'undefined') return null;
  statsObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = Number(el.dataset.count || 0);
        animateCount(el, target);
        statsObserver.unobserve(el);
      });
    },
    { threshold: 0.4 }
  );
  return statsObserver;
}

// Топ-N стран по числу инвесторов + агрегированный "остальные" сегмент.
// Возвращает [] если ни у одного инвестора страна не указана — честно,
// без выдуманных данных (Правило №1).
function countryCounts(investors, topN = 5) {
  const counts = new Map();
  investors.forEach((inv) => {
    const country = String(inv.country || '').trim();
    if (!country) return;
    counts.set(country, (counts.get(country) || 0) + 1);
  });
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (sorted.length <= topN) {
    return { rows: sorted, otherCount: 0 };
  }
  const top = sorted.slice(0, topN);
  const otherCount = sorted.slice(topN).reduce((sum, [, n]) => sum + n, 0);
  return { rows: top, otherCount };
}

export function formatAmount(value, currency) {
  try {
    return new Intl.NumberFormat(getLang() === 'ru' ? 'ru-RU' : 'en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: value % 1 === 0 ? 0 : 2,
    }).format(value);
  } catch {
    // Intl.NumberFormat бросает RangeError на неизвестном/некорректном коде
    // валюты — не должно случиться благодаря backend allowlist, но честный
    // фолбэк на случай рассинхрона фронта и бэкенда лучше, чем упавшая страница.
    return `${value} ${currency}`;
  }
}

// Группирует по валюте — суммы в разных валютах НЕ складываются вместе без
// курса обмена, которого у нас нет (Правило №1: не выдумываем данные).
// Возвращает '' если ни у одного инвестора нет структурированной суммы+валюты.
function investmentChartHTML(investors) {
  const groups = new Map();
  investors.forEach((inv) => {
    if (inv.investmentAmountValue == null || !inv.currency) return;
    const list = groups.get(inv.currency) || [];
    list.push({ name: inv.name, value: Number(inv.investmentAmountValue) });
    groups.set(inv.currency, list);
  });
  if (groups.size === 0) return '';

  const currencyTotals = [...groups.entries()]
    .map(([currency, list]) => ({
      currency,
      total: list.reduce((s, x) => s + x.value, 0),
      list: list.sort((a, b) => b.value - a.value).slice(0, 6),
    }))
    .sort((a, b) => b.total - a.total);

  const cards = currencyTotals
    .map(({ currency, total, list }) => {
      const max = list[0]?.value || 1;
      const bars = list
        .map(
          (item) => `
        <div class="inv-amt-bar-row">
          <span class="inv-amt-bar-name">${esc(item.name)}</span>
          <div class="inv-amt-bar-track"><div class="inv-amt-bar-fill" style="width:${Math.max((item.value / max) * 100, 4).toFixed(1)}%"></div></div>
          <span class="inv-amt-bar-value">${formatAmount(item.value, currency)}</span>
        </div>`
        )
        .join('');
      return `
      <div class="inv-amt-card">
        <div class="inv-amt-card-head">
          <span class="inv-amt-currency">${esc(currency)}</span>
          <span class="inv-amt-total">${formatAmount(total, currency)}</span>
        </div>
        ${bars}
      </div>`;
    })
    .join('');

  const note =
    currencyTotals.length > 1
      ? `<div class="inv-amt-note">${t('inv_amount_chart_note')}</div>`
      : '';

  return `
  <div class="inv-amt-chart">
    <div class="inv-geo-title">${t('inv_amount_chart_title')}</div>
    <div class="inv-amt-cards">${cards}</div>
    ${note}
  </div>`;
}

function statsRow(investors) {
  const total = investors.length;
  const countries = new Set(investors.map((i) => i.country).filter(Boolean)).size;
  return `
  <div class="inv-stats-row">
    <div class="inv-stat-chip"><span class="n" data-count="${total}">0</span><span class="l">${t('inv_stat_investors')}</span></div>
    <div class="inv-stat-chip"><span class="n" data-count="${countries}">0</span><span class="l">${t('inv_stat_countries')}</span></div>
  </div>`;
}

function geoBreakdownHTML(investors) {
  const { rows, otherCount } = countryCounts(investors);
  if (!rows.length) return '';
  const total = rows.reduce((s, [, n]) => s + n, 0) + otherCount;
  const segments = [
    ...rows.map(([country, n]) => ({ label: country, n, known: true })),
    ...(otherCount > 0 ? [{ label: t('inv_stat_other'), n: otherCount, known: false }] : []),
  ];

  const bar = segments
    .map((seg, i) => {
      const pct = total > 0 ? (seg.n / total) * 100 : 0;
      return `<span class="inv-geo-seg" style="width:${pct.toFixed(2)}%" data-idx="${i % 6}" title="${escAttr(seg.label)} — ${seg.n}"></span>`;
    })
    .join('');

  const legend = segments
    .map(
      (seg, i) => `
    <li class="inv-geo-legend-item">
      <span class="inv-geo-dot" data-idx="${i % 6}"></span>
      <span class="inv-geo-flag">${seg.known ? countryFlag(seg.label) : icon('globe')}</span>
      <span class="inv-geo-name">${esc(seg.label)}</span>
      <span class="inv-geo-count">${seg.n}</span>
    </li>`
    )
    .join('');

  return `
  <div class="inv-geo">
    <div class="inv-geo-title">${t('inv_geo_title')}</div>
    <div class="inv-geo-bar" role="img" aria-label="${escAttr(t('inv_geo_title'))}">${bar}</div>
    <ul class="inv-geo-legend">${legend}</ul>
  </div>`;
}

export async function renderInvestors(container) {
  container.innerHTML = `
    <div class="inv-hero">
      <div class="inv-hero-eyebrow">${t('inv_hero_eyebrow')}</div>
      <h1>${t('inv_hero_title_1')} <em>${t('inv_hero_title_em')}</em></h1>
      <p>${t('inv_hero_lead')}</p>
      <div id="inv-stats-mount"></div>
    </div>
    <div class="inv-grid" id="inv-grid">${skeletonHTML()}</div>
  `;

  const gridEl = container.querySelector('#inv-grid');
  const statsMount = container.querySelector('#inv-stats-mount');

  try {
    const { investors } = await investorsApi.listPublic();
    statsMount.innerHTML =
      statsRow(investors) + geoBreakdownHTML(investors) + investmentChartHTML(investors);
    const observer = getStatsObserver();
    statsMount.querySelectorAll('.inv-stat-chip .n').forEach((el) => {
      if (!observer) {
        animateCount(el, Number(el.dataset.count || 0));
      } else {
        observer.observe(el);
      }
    });
    await loadAndRenderGrid(gridEl, investors);
  } catch {
    gridEl.innerHTML = `<div class="inv-empty"><span class="big">${icon('alertTriangle')}</span>${t('inv_load_error')}</div>`;
  }
}
