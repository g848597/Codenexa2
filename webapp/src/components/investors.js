// Раздел "Инвесторы" — публичная витрина. Данные приходят с бэкенда
// (/api/investors), никакого хардкода: пусто на сервере = честно пусто здесь
// (тот же принцип, что и в partners.js/trust.js — Правило №1, без выдуманных данных).
//
// Премиальный редизайн (стекло + бирюзово-фиолетовое свечение) использует
// только реальные поля модели инвестора: name, position, country, company,
// description, investmentAmount(+Value/currency), photoUrl, websiteUrl,
// status. Полей вроде соцсетей (кроме сайта), таймлайна знакомства,
// категорий финансирования или % прогресса в модели нет — значит, их здесь
// нет и не будет придумано. Что доступно — подано на уровне Apple/Stripe.
import { investorsApi } from '../api/investorsApi.js';
import { t, getLang } from '../i18n.js';
import { countryFlag } from '../utils/countryFlags.js';
import { esc, escAttr } from '../utils/html.js';
import { icon } from '../utils/icons.js';
import { haptic } from '../telegram.js';
import { PARTNER_APPLICATION_ENDPOINT } from '../config/partners.js';

const ACCENTS = ['teal', 'violet', 'amber', 'steel'];

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

function skeletonHTML(count = 3) {
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

function initials(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

function photoBlock(investor, sizeClass = 'inv-photo') {
  if (investor.photoUrl) {
    return `<img class="${sizeClass}" src="${escAttr(investor.photoUrl)}" alt="${escAttr(investor.name)}" loading="lazy">`;
  }
  return `<div class="${sizeClass} is-fallback" aria-hidden="true">${esc(initials(investor.name)) || icon('star')}</div>`;
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

function amountBlockHTML(investor) {
  if (investor.investmentAmount && investor.investmentAmount.trim()) {
    return `<div class="inv-amount"><span class="v">${esc(investor.investmentAmount)}</span><span class="l">${t('inv_amount_label')}</span></div>`;
  }
  return `<div class="inv-amount is-pending"><span class="v">${t('inv_amount_pending')}</span></div>`;
}

function websiteBtnHTML(investor) {
  if (!investor.websiteUrl) return '';
  return `<a class="inv-social-btn" href="${escAttr(investor.websiteUrl)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">
    ${icon('globe')}<span>${t('inv_visit_btn')}</span>${icon('externalLink', { size: '0.85em' })}
  </a>`;
}

function cardHTML(investor, idx, isTop = false) {
  const accent = ACCENTS[idx % ACCENTS.length];
  const metaParts = [];
  if (investor.country) {
    metaParts.push(`<span class="inv-meta-item">${icon('mapPin')}${esc(investor.country)}</span>`);
  }
  if (investor.company) {
    metaParts.push(`<span class="inv-meta-item">${icon('briefcase')}${esc(investor.company)}</span>`);
  }
  const meta = metaParts.length ? `<div class="inv-meta-row">${metaParts.join('')}</div>` : '';

  return `
  <article class="inv-card" data-id="${investor.id}" data-accent="${accent}" tabindex="0" role="button" aria-label="${escAttr(investor.name)}">
    <div class="inv-card-inner">
      ${isTop ? `<div class="inv-top-ribbon">${icon('sparkles', { size: '0.85em' })}${t('inv_top_investor_badge')}</div>` : ''}
      <div class="inv-card-top">
        ${photoBlock(investor)}
        <div class="inv-id">
          <div class="inv-name-row">
            <span class="inv-name">${esc(investor.name)}</span>
            <span class="inv-verified" title="${escAttr(t('inv_verified_badge'))}">${icon('checkCircle')}</span>
          </div>
          ${investor.position ? `<div class="inv-position">${esc(investor.position)}</div>` : ''}
        </div>
        <span class="inv-open-chevron">${icon('chevronRight')}</span>
      </div>
      ${meta}
      ${investor.description ? `<p class="inv-desc">${esc(investor.description)}</p>` : ''}
      <div class="inv-divider"></div>
      <div class="inv-card-bottom">
        ${amountBlockHTML(investor)}
        ${websiteBtnHTML(investor)}
      </div>
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

function noResultsHTML() {
  return `<div class="inv-empty"><span class="big">${icon('search')}</span>${t('inv_search_no_results')}<button class="inv-clear-search-btn" data-clear-search>${t('inv_search_clear')}</button></div>`;
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

// Плавно "наливает" бары графика инвестиций до целевой ширины при попадании
// в область видимости, вместо мгновенного появления — тот же принцип
// анимации счётчиков, что и в animateCount/animateHeroStat.
function revealChartBars(container) {
  const bars = container.querySelectorAll('.inv-amt-bar-fill');
  if (!bars.length) return;
  if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
    bars.forEach((el) => { el.style.width = `${el.dataset.fill}%`; });
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        requestAnimationFrame(() => { el.style.width = `${el.dataset.fill}%`; });
        observer.unobserve(el);
      });
    },
    { threshold: 0.3 }
  );
  bars.forEach((el, i) => {
    el.style.transitionDelay = `${Math.min(i, 6) * 70}ms`;
    observer.observe(el);
  });
}

// Находит инвестора с максимальной структурированной суммой (учитывается
// только внутри своей валюты — сравнивать суммы в разных валютах без курса
// нечестно, поэтому берём просто максимум по value безотносительно валюты
// только когда валюта одна и та же для топ-группы, иначе бейдж не показываем).
function topInvestorId(investors) {
  const withAmount = investors.filter((inv) => inv.investmentAmountValue != null && inv.currency);
  if (!withAmount.length) return null;
  const byCurrency = new Map();
  withAmount.forEach((inv) => {
    const list = byCurrency.get(inv.currency) || [];
    list.push(inv);
    byCurrency.set(inv.currency, list);
  });
  // Бейдж показываем только если есть единственная доминирующая валюта —
  // иначе "топ" в USD и "топ" в EUR несравнимы, и лучше промолчать (Правило №1).
  if (byCurrency.size !== 1) return null;
  const [list] = byCurrency.values();
  return list.reduce((a, b) => (Number(b.investmentAmountValue) > Number(a.investmentAmountValue) ? b : a)).id;
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

// Группирует по валюте — суммы в разных валютах НЕ складываются вместе без
// курса обмена, которого у нас нет (Правило №1: не выдумываем данные).
// Возвращает [] если ни у одного инвестора нет структурированной суммы+валюты.
function computeCurrencyTotals(investors) {
  const groups = new Map();
  investors.forEach((inv) => {
    if (inv.investmentAmountValue == null || !inv.currency) return;
    const list = groups.get(inv.currency) || [];
    list.push({ name: inv.name, value: Number(inv.investmentAmountValue) });
    groups.set(inv.currency, list);
  });
  return [...groups.entries()]
    .map(([currency, list]) => ({
      currency,
      total: list.reduce((s, x) => s + x.value, 0),
      list: list.sort((a, b) => b.value - a.value).slice(0, 6),
    }))
    .sort((a, b) => b.total - a.total);
}

// Большой "hero"-счётчик общего объёма инвестиций — показывает валюту с
// наибольшей суммой + честно намекает, что ниже есть разбивка по остальным
// валютам, вместо того чтобы врать единым числом без курса обмена.
function heroInvestedHTML(currencyTotals) {
  if (!currencyTotals.length) {
    return `
    <div class="inv-hero-stat is-pending">
      <span class="l">${t('inv_amount_hero_label')}</span>
      <span class="v">${t('inv_amount_pending')}</span>
    </div>`;
  }
  const top = currencyTotals[0];
  const rest = currencyTotals.length - 1;
  return `
  <div class="inv-hero-stat">
    <span class="l">${t('inv_amount_hero_label')}</span>
    <span class="v" data-currency-cents="${Math.round(top.total * 100)}" data-currency="${escAttr(top.currency)}">${formatAmount(0, top.currency)}</span>
    ${rest > 0 ? `<span class="more">${t('inv_amount_hero_more')(rest)}</span>` : ''}
  </div>`;
}

function investmentChartHTML(currencyTotals) {
  if (!currencyTotals.length) return '';
  const cards = currencyTotals
    .map(({ currency, total, list }) => {
      const max = list[0]?.value || 1;
      const bars = list
        .map(
          (item) => `
        <div class="inv-amt-bar-row">
          <span class="inv-amt-bar-name">${esc(item.name)}</span>
          <div class="inv-amt-bar-track"><div class="inv-amt-bar-fill" data-fill="${Math.max((item.value / max) * 100, 4).toFixed(1)}" style="width:0%"></div></div>
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

  return `
  <div class="inv-amt-chart">
    <div class="inv-geo-title">${t('inv_amount_chart_title')}</div>
    <div class="inv-amt-cards">${cards}</div>
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

function toolbarHTML(hasInvestors) {
  if (!hasInvestors) return '';
  return `
  <div class="inv-toolbar">
    <label class="inv-search">
      ${icon('search')}
      <input type="text" id="inv-search-input" placeholder="${escAttr(t('inv_search_placeholder'))}" autocomplete="off" aria-label="${escAttr(t('inv_search_placeholder'))}">
    </label>
    <div class="inv-sort-chips" role="tablist">
      <button class="inv-sort-chip active" data-sort="default" type="button">${t('inv_sort_all')}</button>
      <button class="inv-sort-chip" data-sort="amount" type="button">${icon('sliders', { size: '0.9em' })}${t('inv_sort_amount')}</button>
      <button class="inv-sort-chip" data-sort="alpha" type="button">${t('inv_sort_alpha')}</button>
    </div>
  </div>`;
}

function ctaHTML() {
  return `
  <div class="inv-cta">
    <div class="inv-cta-glow" aria-hidden="true"></div>
    <span class="inv-cta-eyebrow">${t('inv_cta_eyebrow')}</span>
    <h3>${t('inv_cta_title')}</h3>
    <p>${t('inv_cta_lead')}</p>
    <button class="inv-cta-btn" id="inv-cta-btn" type="button">${t('inv_cta_btn')}${icon('arrowRight')}</button>
  </div>`;
}

function metaItemHTML(iconName, label, value) {
  return `
  <div class="inv-sheet-meta-item">
    <span class="ic">${icon(iconName)}</span>
    <div>
      <span class="l">${esc(label)}</span>
      <span class="v">${esc(value)}</span>
    </div>
  </div>`;
}

function detailSheetHTML(investor, accent) {
  const metaItems = [
    investor.country ? metaItemHTML('mapPin', t('inv_field_country'), investor.country) : '',
    investor.company ? metaItemHTML('briefcase', t('inv_field_company'), investor.company) : '',
  ]
    .filter(Boolean)
    .join('');

  return `
  <div class="inv-sheet-backdrop" data-sheet-backdrop>
    <div class="inv-sheet" data-accent="${accent}" role="dialog" aria-modal="true" aria-label="${escAttr(investor.name)}">
      <div class="inv-sheet-handle"></div>
      <button class="inv-sheet-close" data-sheet-close aria-label="${escAttr(t('inv_detail_close'))}">${icon('close')}</button>
      <div class="inv-sheet-head">
        ${photoBlock(investor, 'inv-sheet-photo')}
        <div class="inv-name-row">
          <h2>${esc(investor.name)}</h2>
          <span class="inv-verified" title="${escAttr(t('inv_verified_badge'))}">${icon('checkCircle')}</span>
        </div>
        ${investor.position ? `<div class="inv-sheet-position">${esc(investor.position)}</div>` : ''}
      </div>
      <div class="inv-sheet-amount-card">
        ${amountBlockHTML(investor)}
        ${websiteBtnHTML(investor)}
      </div>
      ${metaItems ? `<div class="inv-sheet-meta-grid">${metaItems}</div>` : ''}
      ${investor.description ? `
      <div class="inv-sheet-history">
        <h3>${icon('sparkles', { size: '0.95em' })}${t('inv_detail_history_title')}</h3>
        <p>${esc(investor.description)}</p>
      </div>` : ''}
    </div>
  </div>`;
}

function openInvestorDetail(investor, accent) {
  const wrap = document.createElement('div');
  wrap.innerHTML = detailSheetHTML(investor, accent);
  const backdrop = wrap.firstElementChild;
  document.body.appendChild(backdrop);
  document.body.classList.add('inv-sheet-lock');
  haptic('light');

  requestAnimationFrame(() => {
    requestAnimationFrame(() => backdrop.classList.add('is-open'));
  });

  function close() {
    backdrop.classList.remove('is-open');
    document.body.classList.remove('inv-sheet-lock');
    haptic('light');
    setTimeout(() => backdrop.remove(), 320);
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
  }
  backdrop.querySelector('[data-sheet-close]').addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  document.addEventListener('keydown', onKey);
}

export async function renderInvestors(container) {
  container.innerHTML = `
    <div class="inv-hero">
      <div class="inv-hero-eyebrow">${t('inv_hero_eyebrow')}</div>
      <h1>${t('inv_hero_title_1')} <em>${t('inv_hero_title_em')}</em></h1>
      <p>${t('inv_hero_lead')}</p>
      <div id="inv-stats-mount"></div>
    </div>
    <div id="inv-toolbar-mount"></div>
    <div class="inv-grid" id="inv-grid">${skeletonHTML()}</div>
    <div id="inv-geo-amt-mount"></div>
  `;

  const gridEl = container.querySelector('#inv-grid');
  const statsMount = container.querySelector('#inv-stats-mount');
  const toolbarMount = container.querySelector('#inv-toolbar-mount');
  const geoAmtMount = container.querySelector('#inv-geo-amt-mount');

  const state = { all: [], sort: 'default', query: '' };

  function visibleList() {
    const q = state.query.trim().toLowerCase();
    let list = state.all;
    if (q) {
      list = list.filter((inv) =>
        [inv.name, inv.position, inv.company, inv.country]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }
    if (state.sort === 'amount') {
      list = [...list].sort(
        (a, b) => (b.investmentAmountValue ?? -1) - (a.investmentAmountValue ?? -1)
      );
    } else if (state.sort === 'alpha') {
      list = [...list].sort((a, b) =>
        a.name.localeCompare(b.name, getLang() === 'ru' ? 'ru' : 'en')
      );
    }
    return list;
  }

  function renderGrid() {
    const list = visibleList();
    if (!state.all.length) {
      gridEl.innerHTML = emptyStateHTML();
      return;
    }
    if (!list.length) {
      gridEl.innerHTML = noResultsHTML();
      const clearBtn = gridEl.querySelector('[data-clear-search]');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          state.query = '';
          const input = toolbarMount.querySelector('#inv-search-input');
          if (input) input.value = '';
          renderGrid();
        });
      }
      return;
    }
    const topId = topInvestorId(state.all);
    gridEl.innerHTML = list.map((inv, i) => cardHTML(inv, i, topId != null && inv.id === topId)).join('');
    attachCardTilt(gridEl);
    revealCards(gridEl);
    gridEl.querySelectorAll('.inv-card').forEach((card) => {
      const openDetail = () => {
        const investor = list.find((inv) => String(inv.id) === card.dataset.id);
        if (investor) openInvestorDetail(investor, card.dataset.accent);
      };
      card.addEventListener('click', openDetail);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openDetail();
        }
      });
    });
  }

  function wireToolbar() {
    const input = toolbarMount.querySelector('#inv-search-input');
    if (input) {
      input.addEventListener('input', () => {
        state.query = input.value;
        renderGrid();
      });
    }
    toolbarMount.querySelectorAll('.inv-sort-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        if (chip.classList.contains('active')) return;
        state.sort = chip.dataset.sort;
        toolbarMount
          .querySelectorAll('.inv-sort-chip')
          .forEach((c) => c.classList.toggle('active', c === chip));
        haptic('light');
        renderGrid();
      });
    });
  }

  function animateHeroStat() {
    const el = statsMount.querySelector('.inv-hero-stat .v[data-currency-cents]');
    if (!el) return;
    const cents = Number(el.dataset.currencyCents || 0);
    const currency = el.dataset.currency;
    const commit = () => {
      el.textContent = formatAmount(cents / 100, currency);
    };
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      commit();
      return;
    }
    const revealer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          let start = null;
          const duration = 1100;
          function tick(now) {
            if (start === null) start = now;
            const p = Math.min(Math.max((now - start) / duration, 0), 1);
            const eased = 1 - Math.pow(1 - p, 3);
            el.textContent = formatAmount((cents / 100) * eased, currency);
            if (p < 1) requestAnimationFrame(tick);
            else commit();
          }
          requestAnimationFrame(tick);
          revealer.unobserve(el);
        });
      },
      { threshold: 0.4 }
    );
    revealer.observe(el);
  }

  try {
    const { investors } = await investorsApi.listPublic();
    state.all = investors;

    const currencyTotals = computeCurrencyTotals(investors);
    statsMount.innerHTML = statsRow(investors) + heroInvestedHTML(currencyTotals);
    toolbarMount.innerHTML = toolbarHTML(investors.length > 0);
    geoAmtMount.innerHTML =
      geoBreakdownHTML(investors) + investmentChartHTML(currencyTotals) + ctaHTML();
    revealChartBars(geoAmtMount);

    const observer = getStatsObserver();
    statsMount.querySelectorAll('.inv-stat-chip .n').forEach((el) => {
      if (!observer) animateCount(el, Number(el.dataset.count || 0));
      else observer.observe(el);
    });
    animateHeroStat();

    wireToolbar();
    renderGrid();

    const ctaBtn = geoAmtMount.querySelector('#inv-cta-btn');
    if (ctaBtn) {
      ctaBtn.addEventListener('click', () => {
        haptic('medium');
        const subject = t('inv_cta_subject');
        const body = t('inv_cta_body');
        window.location.href = `mailto:${PARTNER_APPLICATION_ENDPOINT.target}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      });
    }
  } catch {
    gridEl.innerHTML = `<div class="inv-empty"><span class="big">${icon('alertTriangle')}</span>${t('inv_load_error')}</div>`;
  }
}
