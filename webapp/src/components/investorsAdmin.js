// Админ-панель раздела "Инвесторы". Монтируется в main.js ТОЛЬКО если
// /api/auth/me вернул isAdmin=true — но реальная защита всё равно на бэкенде
// (app/web/deps.get_current_admin), этот файл лишь не показывает лишний UI
// человеку, у которого всё равно нет прав. Модуль грузится динамическим
// import() (см. main.js) — обычные посетители его код вообще не скачивают.
import { investorsApi, InvestorsApiError } from '../api/investorsApi.js';
import { t } from '../i18n.js';
import { haptic } from '../telegram.js';
import { esc, escAttr } from '../utils/html.js';
import { icon } from '../utils/icons.js';

const STATUS_ORDER = ['published', 'draft', 'hidden'];

// Зеркало ALLOWED_CURRENCIES в app/web/api/investors.py — держать в синхроне
// вручную (два рантайма, общего source-of-truth файла между ними нет).
// Бэкенд — источник истины для валидации; это только список для <select>.
const CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'KZT',
  'RUB',
  'CNY',
  'JPY',
  'CHF',
  'AED',
  'SGD',
  'UZS',
  'TRY',
  'UAH',
  'GEL',
  'AMD',
  'PLN',
  'INR',
  'CAD',
  'AUD',
];

let toastTimer = null;
function showToast(root, message) {
  let toast = root.querySelector('.inv-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'inv-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

function initials(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

const AUDIT_ACTIONS = [
  'create',
  'update',
  'delete',
  'reorder',
  'photo_upload',
  'photo_delete',
  'role_change',
  'plan_price_change',
];

function auditActionLabel(action) {
  const key = 'inv_audit_action_' + action;
  const label = t(key);
  return label === key ? action : label;
}

function auditTargetLabel(entry) {
  if (entry.targetType === 'investor' && entry.details && entry.details.name) {
    return esc(entry.details.name);
  }
  if (entry.targetType === 'user' && entry.details && entry.details.targetEmail) {
    return esc(entry.details.targetEmail);
  }
  if (entry.targetType === 'plan' && entry.targetId) {
    return esc(String(entry.targetId));
  }
  return entry.targetId != null ? `#${esc(String(entry.targetId))}` : '—';
}

function formatAuditDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function mountInvestorsAdmin(container, { onChange } = {}) {
  const root = document.createElement('div');
  root.innerHTML = `
    <div class="inv-admin-toggle" id="inv-admin-toggle">
      <span class="label">${icon('tool')} ${t('inv_admin_toggle_label')}</span>
      <span class="chev">▾</span>
    </div>
    <div class="inv-admin-panel" id="inv-admin-panel">
      <button class="inv-admin-add-btn" id="inv-admin-add">+ ${t('inv_admin_add_btn')}</button>
      <div class="inv-admin-list" id="inv-admin-list"></div>
    </div>
    <div class="inv-admin-toggle" id="inv-audit-toggle">
      <span class="label">${icon('fileText')} ${t('inv_audit_toggle_label')}</span>
      <span class="chev">▾</span>
    </div>
    <div class="inv-admin-panel" id="inv-audit-panel">
      <div class="inv-audit-filters">
        <select id="inv-audit-action-filter">
          <option value="">${t('inv_audit_filter_all_actions')}</option>
          ${AUDIT_ACTIONS.map((a) => `<option value="${a}">${esc(auditActionLabel(a))}</option>`).join('')}
        </select>
      </div>
      <div class="inv-audit-list" id="inv-audit-list"></div>
      <div class="inv-audit-pager" id="inv-audit-pager"></div>
    </div>
  `;
  container.prepend(root);

  const toggle = root.querySelector('#inv-admin-toggle');
  const panel = root.querySelector('#inv-admin-panel');
  const listEl = root.querySelector('#inv-admin-list');
  let items = [];
  let loaded = false;

  toggle.addEventListener('click', async () => {
    const opening = !panel.classList.contains('open');
    toggle.classList.toggle('open', opening);
    panel.classList.toggle('open', opening);
    haptic('light');
    if (opening && !loaded) {
      await refresh();
      loaded = true;
    }
  });

  // ---------- Раунд 8, модуль 5: панель аудит-лога ----------
  const auditToggle = root.querySelector('#inv-audit-toggle');
  const auditPanel = root.querySelector('#inv-audit-panel');
  const auditListEl = root.querySelector('#inv-audit-list');
  const auditPagerEl = root.querySelector('#inv-audit-pager');
  const auditActionFilter = root.querySelector('#inv-audit-action-filter');
  const AUDIT_PAGE_SIZE = 20;
  let auditOffset = 0;
  let auditTotal = 0;
  let auditLoaded = false;

  auditToggle.addEventListener('click', async () => {
    const opening = !auditPanel.classList.contains('open');
    auditToggle.classList.toggle('open', opening);
    auditPanel.classList.toggle('open', opening);
    haptic('light');
    if (opening && !auditLoaded) {
      await refreshAuditLog();
      auditLoaded = true;
    }
  });

  auditActionFilter.addEventListener('change', () => {
    auditOffset = 0;
    refreshAuditLog();
  });

  async function refreshAuditLog() {
    auditListEl.innerHTML = `<div class="inv-admin-empty">${t('inv_audit_loading')}</div>`;
    auditPagerEl.innerHTML = '';
    try {
      const { entries, total } = await investorsApi.auditLog({
        limit: AUDIT_PAGE_SIZE,
        offset: auditOffset,
        action: auditActionFilter.value || null,
      });
      auditTotal = total;
      renderAuditLog(entries);
      renderAuditPager();
    } catch (err) {
      const forbidden = err instanceof InvestorsApiError && err.status === 403;
      auditListEl.innerHTML = `<div class="inv-admin-empty">${forbidden ? t('inv_audit_forbidden') : t('inv_load_error')}</div>`;
    }
  }

  function renderAuditLog(entries) {
    if (!entries.length) {
      auditListEl.innerHTML = `<div class="inv-admin-empty">${t('inv_audit_empty')}</div>`;
      return;
    }
    auditListEl.innerHTML = `
      <table class="inv-audit-table">
        <thead>
          <tr>
            <th>${t('inv_audit_col_date')}</th>
            <th>${t('inv_audit_col_admin')}</th>
            <th>${t('inv_audit_col_action')}</th>
            <th>${t('inv_audit_col_target')}</th>
          </tr>
        </thead>
        <tbody>
          ${entries
            .map(
              (entry) => `
            <tr>
              <td>${esc(formatAuditDate(entry.createdAt))}</td>
              <td>${esc(entry.adminEmail || entry.adminName || `#${entry.adminId}`)}</td>
              <td>${esc(auditActionLabel(entry.action))}</td>
              <td>${auditTargetLabel(entry)}</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>`;
  }

  function renderAuditPager() {
    if (auditTotal <= AUDIT_PAGE_SIZE) {
      auditPagerEl.innerHTML = '';
      return;
    }
    auditPagerEl.innerHTML = `
      <button class="inv-admin-icon-btn" id="inv-audit-prev" ${auditOffset === 0 ? 'disabled' : ''}>${t('inv_audit_prev_page')}</button>
      <span class="inv-audit-page-label">${t('inv_audit_page_of', auditOffset, AUDIT_PAGE_SIZE, auditTotal)}</span>
      <button class="inv-admin-icon-btn" id="inv-audit-next" ${auditOffset + AUDIT_PAGE_SIZE >= auditTotal ? 'disabled' : ''}>${t('inv_audit_next_page')}</button>
    `;
    const prevBtn = auditPagerEl.querySelector('#inv-audit-prev');
    const nextBtn = auditPagerEl.querySelector('#inv-audit-next');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        auditOffset = Math.max(0, auditOffset - AUDIT_PAGE_SIZE);
        refreshAuditLog();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        auditOffset += AUDIT_PAGE_SIZE;
        refreshAuditLog();
      });
    }
  }

  async function refresh() {
    listEl.innerHTML = `<div class="inv-admin-empty">${t('inv_admin_loading')}</div>`;
    try {
      const { investors } = await investorsApi.listAdmin();
      items = investors;
      renderList();
    } catch (err) {
      listEl.innerHTML = `<div class="inv-admin-empty">${err instanceof InvestorsApiError ? esc(err.message) : t('inv_load_error')}</div>`;
    }
  }

  function renderList() {
    if (!items.length) {
      listEl.innerHTML = `<div class="inv-admin-empty">${t('inv_admin_empty')}</div>`;
      return;
    }
    listEl.innerHTML = items
      .map(
        (inv) => `
      <div class="inv-admin-row" draggable="true" data-id="${inv.id}">
        <span class="handle" aria-hidden="true">⠿</span>
        ${
          inv.photoUrl
            ? `<img class="thumb" src="${escAttr(inv.photoUrl)}" alt="">`
            : `<div class="thumb-fallback">${esc(initials(inv.name)) || icon('star')}</div>`
        }
        <div class="info">
          <div class="name">${esc(inv.name)}</div>
          <div class="sub">${esc(inv.company || inv.position || '—')}</div>
        </div>
        <span class="status-dot ${inv.status}" title="${esc(t('inv_status_' + inv.status))}"></span>
        <div class="row-actions">
          <button class="inv-admin-icon-btn" data-edit="${inv.id}" title="${t('inv_admin_edit')}">${icon('fileEdit')}</button>
          <button class="inv-admin-icon-btn danger" data-delete="${inv.id}" title="${t('inv_admin_delete')}">${icon('close')}</button>
        </div>
      </div>`
      )
      .join('');
    wireRowActions();
    wireDragReorder();
  }

  function wireRowActions() {
    listEl.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const inv = items.find((i) => i.id === Number(btn.dataset.edit));
        if (inv) openModal(inv);
      });
    });
    listEl.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.delete);
        const inv = items.find((i) => i.id === id);
        if (!inv) return;
        if (!window.confirm(t('inv_admin_delete_confirm', inv.name))) return;
        try {
          await investorsApi.remove(id);
          items = items.filter((i) => i.id !== id);
          renderList();
          showToast(root, t('inv_admin_deleted_toast'));
          onChange && onChange();
        } catch (err) {
          showToast(root, err instanceof InvestorsApiError ? err.message : t('inv_generic_error'));
        }
      });
    });
  }

  // Порядок карточек — нативный HTML5 drag & drop, без сторонних библиотек.
  function wireDragReorder() {
    let dragEl = null;
    listEl.querySelectorAll('.inv-admin-row').forEach((row) => {
      row.addEventListener('dragstart', () => {
        dragEl = row;
        row.classList.add('dragging');
      });
      row.addEventListener('dragend', async () => {
        row.classList.remove('dragging');
        listEl.querySelectorAll('.inv-admin-row').forEach((r) => r.classList.remove('drag-over'));
        dragEl = null;
        const newOrderIds = Array.from(listEl.querySelectorAll('.inv-admin-row')).map((r) =>
          Number(r.dataset.id)
        );
        const order = newOrderIds.map((id, idx) => ({ id, sortOrder: idx }));
        try {
          await investorsApi.reorder(order);
          items = order.map(({ id }) => items.find((i) => i.id === id));
          onChange && onChange();
        } catch {
          showToast(root, t('inv_generic_error'));
          renderList();
        }
      });
      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!dragEl || dragEl === row) return;
        row.classList.add('drag-over');
        const rows = Array.from(listEl.children);
        const dragIdx = rows.indexOf(dragEl);
        const overIdx = rows.indexOf(row);
        if (dragIdx < overIdx) row.after(dragEl);
        else row.before(dragEl);
      });
      row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
    });
  }

  root.querySelector('#inv-admin-add').addEventListener('click', () => openModal(null));

  // ---------- модалка добавления/редактирования ----------

  function openModal(investor) {
    const isEdit = !!investor;
    const draft = investor
      ? { ...investor }
      : {
          name: '',
          position: '',
          country: '',
          company: '',
          description: '',
          investmentAmount: '',
          investmentAmountValue: null,
          currency: null,
          status: 'draft',
          websiteUrl: '',
          photoUrl: null,
        };

    const backdrop = document.createElement('div');
    backdrop.className = 'inv-modal-backdrop';
    backdrop.innerHTML = `
      <div class="inv-modal" role="dialog" aria-modal="true">
        <div class="inv-modal-head">
          <h3>${isEdit ? t('inv_admin_edit_title') : t('inv_admin_add_title')}</h3>
          <button class="inv-modal-close" aria-label="${t('inv_admin_close')}">${icon('close')}</button>
        </div>

        <div class="inv-form-photo">
          ${draft.photoUrl ? `<img class="preview" src="${escAttr(draft.photoUrl)}" alt="">` : `<div class="preview-fallback">${icon('user')}</div>`}
          <div class="photo-actions">
            <label class="inv-form-photo-btn" style="text-align:center;">
              ${t('inv_admin_photo_upload')}
              <input type="file" accept="image/png,image/jpeg,image/webp" id="inv-photo-input" style="display:none;" ${isEdit ? '' : 'disabled'}>
            </label>
            <button class="inv-form-photo-btn danger" id="inv-photo-remove" ${draft.photoUrl ? '' : 'disabled'}>${t('inv_admin_photo_remove')}</button>
            ${!isEdit ? `<span style="font-size:10.5px;color:var(--text-faint);max-width:140px;">${t('inv_admin_photo_after_save')}</span>` : ''}
          </div>
        </div>

        <div class="inv-form-grid">
          <div class="inv-form-field full"><label>${t('inv_field_name')}</label><input id="f-name" value="${escAttr(draft.name)}" maxlength="200"></div>
          <div class="inv-form-field"><label>${t('inv_field_position')}</label><input id="f-position" value="${escAttr(draft.position)}" maxlength="200"></div>
          <div class="inv-form-field"><label>${t('inv_field_country')}</label><input id="f-country" value="${escAttr(draft.country)}" maxlength="200"></div>
          <div class="inv-form-field"><label>${t('inv_field_company')}</label><input id="f-company" value="${escAttr(draft.company)}" maxlength="200"></div>
          <div class="inv-form-field full">
            <label>${t('inv_field_amount')}</label>
            <input id="f-amount" value="${escAttr(draft.investmentAmount || '')}" maxlength="100" placeholder="$50,000">
            <div class="inv-form-hint">${t('inv_field_amount_hint')}</div>
          </div>
          <div class="inv-form-field">
            <label>${t('inv_field_amount_value')}</label>
            <input id="f-amount-value" type="number" min="0" step="0.01" inputmode="decimal" value="${draft.investmentAmountValue ?? ''}">
          </div>
          <div class="inv-form-field">
            <label>${t('inv_field_currency')}</label>
            <select id="f-currency">
              <option value="">${t('inv_currency_none')}</option>
              ${CURRENCIES.map((c) => `<option value="${c}" ${draft.currency === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
          <div class="inv-form-field full"><label>${t('inv_field_website')}</label><input id="f-website" value="${escAttr(draft.websiteUrl || '')}" maxlength="500" placeholder="https://"></div>
          <div class="inv-form-field full"><label>${t('inv_field_description')}</label><textarea id="f-desc" maxlength="2000">${esc(draft.description)}</textarea></div>
        </div>

        <div class="inv-status-toggle" id="f-status-toggle">
          ${STATUS_ORDER.map((s) => `<div class="inv-status-opt ${draft.status === s ? 'selected' : ''}" data-status="${s}">${t('inv_status_' + s)}</div>`).join('')}
        </div>

        <div class="inv-form-error" id="f-error"></div>

        <div class="inv-modal-actions">
          <button class="inv-cancel-btn" id="f-cancel">${t('inv_admin_cancel')}</button>
          <button class="inv-save-btn" id="f-save">${t('inv_admin_save')}</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);

    let selectedStatus = draft.status;
    let currentId = investor ? investor.id : null;

    backdrop.querySelectorAll('.inv-status-opt').forEach((opt) => {
      opt.addEventListener('click', () => {
        selectedStatus = opt.dataset.status;
        backdrop
          .querySelectorAll('.inv-status-opt')
          .forEach((o) => o.classList.toggle('selected', o === opt));
      });
    });

    function close() {
      backdrop.remove();
    }
    backdrop.querySelector('.inv-modal-close').addEventListener('click', close);
    backdrop.querySelector('#f-cancel').addEventListener('click', close);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close();
    });

    const errorEl = backdrop.querySelector('#f-error');
    function showError(msg) {
      errorEl.textContent = msg;
      errorEl.classList.add('show');
    }

    const photoInput = backdrop.querySelector('#inv-photo-input');
    photoInput.addEventListener('change', async () => {
      const file = photoInput.files[0];
      if (!file || !currentId) return;
      try {
        const { investor: updated } = await investorsApi.uploadPhoto(currentId, file);
        draft.photoUrl = updated.photoUrl;
        const preview = backdrop.querySelector('.preview, .preview-fallback');
        preview.outerHTML = `<img class="preview" src="${escAttr(updated.photoUrl)}" alt="">`;
        backdrop.querySelector('#inv-photo-remove').disabled = false;
        applyLocalUpdate(updated);
        showToast(root, t('inv_admin_photo_updated_toast'));
      } catch (err) {
        showError(err instanceof InvestorsApiError ? err.message : t('inv_generic_error'));
      }
    });

    backdrop.querySelector('#inv-photo-remove').addEventListener('click', async () => {
      if (!currentId) return;
      try {
        const { investor: updated } = await investorsApi.removePhoto(currentId);
        draft.photoUrl = null;
        const preview = backdrop.querySelector('.preview, .preview-fallback');
        preview.outerHTML = `<div class="preview-fallback">${icon('user')}</div>`;
        backdrop.querySelector('#inv-photo-remove').disabled = true;
        applyLocalUpdate(updated);
      } catch (err) {
        showError(err instanceof InvestorsApiError ? err.message : t('inv_generic_error'));
      }
    });

    function applyLocalUpdate(updated) {
      const idx = items.findIndex((i) => i.id === updated.id);
      if (idx >= 0) items[idx] = updated;
      else items.unshift(updated);
      renderList();
      onChange && onChange();
    }

    backdrop.querySelector('#f-save').addEventListener('click', async () => {
      errorEl.classList.remove('show');
      const amountValueRaw = backdrop.querySelector('#f-amount-value').value.trim();
      const currencyRaw = backdrop.querySelector('#f-currency').value;
      const payload = {
        name: backdrop.querySelector('#f-name').value.trim(),
        position: backdrop.querySelector('#f-position').value.trim(),
        country: backdrop.querySelector('#f-country').value.trim(),
        company: backdrop.querySelector('#f-company').value.trim(),
        description: backdrop.querySelector('#f-desc').value.trim(),
        investment_amount: backdrop.querySelector('#f-amount').value.trim() || null,
        investment_amount_value: amountValueRaw === '' ? null : Number(amountValueRaw),
        currency: currencyRaw || null,
        website_url: backdrop.querySelector('#f-website').value.trim() || null,
        status: selectedStatus,
      };
      if (!payload.name) {
        showError(t('inv_error_name_required'));
        return;
      }
      if (payload.website_url && !/^https?:\/\//.test(payload.website_url)) {
        showError(t('inv_error_website_format'));
        return;
      }
      // Зеркалим серверную проверку "оба или ничего" на клиенте — честная
      // обратная связь до сетевого запроса, а не только после 422 с бэкенда.
      if ((payload.investment_amount_value === null) !== (payload.currency === null)) {
        showError(t('inv_error_amount_pair'));
        return;
      }
      if (
        payload.investment_amount_value !== null &&
        Number.isNaN(payload.investment_amount_value)
      ) {
        showError(t('inv_error_amount_pair'));
        return;
      }
      const saveBtn = backdrop.querySelector('#f-save');
      saveBtn.disabled = true;
      saveBtn.textContent = t('inv_admin_saving');
      try {
        if (isEdit) {
          const { investor: updated } = await investorsApi.update(currentId, payload);
          applyLocalUpdate(updated);
        } else {
          const { investor: created } = await investorsApi.create(payload);
          items.unshift(created);
          currentId = created.id;
          renderList();
          onChange && onChange();
          // Даём загрузить фото сразу после создания, не закрывая модалку.
          photoInput.disabled = false;
          backdrop.querySelector('.inv-modal-head h3').textContent = t('inv_admin_edit_title');
          backdrop.querySelector('#f-save').textContent = t('inv_admin_saved_continue');
          saveBtn.disabled = false;
          haptic('medium');
          showToast(root, t('inv_admin_created_toast'));
          return;
        }
        haptic('medium');
        showToast(root, t('inv_admin_saved_toast'));
        close();
      } catch (err) {
        showError(err instanceof InvestorsApiError ? err.message : t('inv_generic_error'));
        saveBtn.disabled = false;
        saveBtn.textContent = t('inv_admin_save');
      }
    });
  }
}
