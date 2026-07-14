import { REVIEWS, GROWTH_REPORTS, SUPPORT_INFO, COMMUNITY, OVERALL_STATUS, STATUS_INCIDENTS } from '../config/trust.js';
import { t, tl } from '../i18n.js';
import { esc } from '../utils/html.js';

const STATUS_CLS = { operational: 'ok', degraded: 'warn', outage: 'down' };

// Отзывы и описания инцидентов — единственные места в этом файле, где текст
// в итоге будет реальным контентом от третьих лиц (автор отзыва, оператор,
// описавший инцидент), а не текстом, который пишет сам владелец в конфиге.
// Пока REVIEWS/STATUS_INCIDENTS пусты, это не проявляется, но как только туда
// попадёт первая настоящая запись — без экранирования это была бы дыра для
// HTML/скриптов внутри текста отзыва. Остальные компоненты проекта (docsApp.js,
// sportApp.js) уже используют такой же esc() для пользовательского ввода.
function reviewsBlock() {
  const published = REVIEWS.filter(r => r.consent === true);

  if (!published.length) {
    return `
    <div class="pd-block">
      <h3>${t('reviews_title')}</h3>
      <div class="pd-empty">${t('reviews_empty')}</div>
    </div>`;
  }

  return `
  <div class="pd-block">
    <h3>${t('reviews_title')}</h3>
    ${published.map(r => `
      <div class="review-card">
        <div class="review-head">
          <span class="review-author">${esc(r.authorName || r.authorHandle || t('review_anon'))}</span>
          <span class="review-date">${esc(r.date)}</span>
        </div>
        <p class="review-text">${esc(r.text)}</p>
      </div>`).join('')}
  </div>`;
}

function growthReportBlock() {
  if (!GROWTH_REPORTS.length) {
    return `
    <div class="pd-block">
      <h3>${t('growth_report_title')}</h3>
      <div class="pd-empty">${t('growth_report_empty')}</div>
    </div>`;
  }

  const reports = [...GROWTH_REPORTS].sort((a, b) => b.publishedDate.localeCompare(a.publishedDate));

  return `
  <div class="pd-block">
    <h3>${t('growth_report_title')}</h3>
    ${reports.map(r => `
      <div class="report-card">
        <div class="report-head">
          <span class="report-period">${r.period}</span>
          <span class="report-date">${t('report_published', r.publishedDate)}</span>
        </div>
        ${reportListSection(t('report_worked'), r.whatWorked)}
        ${reportListSection(t('report_didnt'), r.whatDidnt)}
        ${reportListSection(t('report_next'), r.nextFocus)}
      </div>`).join('')}
  </div>`;
}

function reportListSection(title, items) {
  if (!items || !items.length) return '';
  return `
  <div class="report-section">
    <span class="report-section-title">${title}</span>
    <ul class="report-list">${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
  </div>`;
}

function supportBlock() {
  const slaKnown = SUPPORT_INFO.avgResponseTime && SUPPORT_INFO.measuredPeriod;

  return `
  <div class="pd-block">
    <h3>${t('support_title')}</h3>
    <div class="support-channels">
      ${SUPPORT_INFO.channels.map(c => c.url
        ? `<a class="support-channel" href="${c.url}" target="_blank" rel="noopener">${tl(c.label)} →</a>`
        : `<div class="support-channel disabled">${tl(c.label)} <span class="pt-pending">${t('support_channel_pending')}</span></div>`
      ).join('')}
    </div>
    <div class="sla-row">
      ${slaKnown
        ? `<div class="sla-value"><span class="sla-num">${SUPPORT_INFO.avgResponseTime}</span><span class="sla-label">${t('sla_label', SUPPORT_INFO.avgResponseTime, SUPPORT_INFO.measuredPeriod, SUPPORT_INFO.measuredSampleSize)}</span></div>`
        : `<div class="pd-empty">${t('sla_empty')}</div>`
      }
    </div>
  </div>`;
}

function communityBlock() {
  const hasLink = !!COMMUNITY.telegramUrl;
  return `
  <div class="pd-block">
    <h3>${t('community_title')}</h3>
    ${hasLink
      ? `<a class="community-link" href="${COMMUNITY.telegramUrl}" target="_blank" rel="noopener">${t('community_join')}</a>`
      : `<div class="pd-empty">${t('community_empty')}</div>`
    }
    ${COMMUNITY.memberCount !== null
      ? `<div class="community-count"><span class="cc-num">${COMMUNITY.memberCount}</span><span class="cc-label">${t('community_count_label', COMMUNITY.memberCountSource)}</span></div>`
      : (hasLink ? `<p class="ref-honesty-note">${t('community_counter_note')}</p>` : '')
    }
  </div>`;
}

function statusBlock() {
  const statusCls = STATUS_CLS[OVERALL_STATUS];
  const statusLabel = t('status_' + OVERALL_STATUS);
  const body = STATUS_INCIDENTS.length
    ? [...STATUS_INCIDENTS].sort((a, b) => b.date.localeCompare(a.date)).map(inc => `
      <div class="incident-row">
        <div class="incident-top">
          <span class="incident-title">${esc(inc.title)}</span>
          <span class="incident-status ${inc.status}">${t('incident_' + inc.status)}</span>
        </div>
        <div class="incident-date">${esc(inc.date)}</div>
        <p class="incident-desc">${esc(inc.description)}</p>
      </div>`).join('')
    : `<div class="pd-empty">${t('status_empty')}</div>`;

  return `
  <div class="pd-block">
    <h3>${t('status_title')}</h3>
    <div class="status-pill ${statusCls}"><span class="status-dot"></span>${statusLabel}</div>
    ${body}
  </div>`;
}

export function renderTrust(container) {
  container.innerHTML = `
    <div class="section-head" style="margin-top:6px;">
      <h2>${t('trust_header_title')}</h2>
      <span>${t('trust_header_tag')}</span>
    </div>
    <p class="muted-lead">${t('trust_lead')}</p>
    ${reviewsBlock()}
    ${growthReportBlock()}
    ${supportBlock()}
    ${communityBlock()}
    ${statusBlock()}
  `;
}
