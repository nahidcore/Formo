/* ==========================================================================
   FormCraft — Admin Dashboard Logic
   ========================================================================== */

const AdminApp = (() => {
  const TOKEN_KEY = 'formcraft:admin-token';
  let submissions = [];
  let filtered = [];

  const els = {};

  function cacheEls() {
    els.loginGate = document.getElementById('login-gate');
    els.dashboard = document.getElementById('dashboard');
    els.tokenInput = document.getElementById('token-input');
    els.btnLogin = document.getElementById('btn-login');
    els.btnRefresh = document.getElementById('btn-refresh');
    els.btnApplyFormConfig = document.getElementById('btn-apply-form-config');
    els.btnApplyFeatureConfig = document.getElementById('btn-apply-feature-config');
    els.btnAddCustomField = document.getElementById('btn-add-custom-field');
    els.formFieldConfig = document.getElementById('form-field-config');
    els.featureConfig = document.getElementById('feature-config');
    els.insightPanel = document.getElementById('insight-panel');
    els.newFieldLabel = document.getElementById('new-field-label');
    els.newFieldId = document.getElementById('new-field-id');
    els.newFieldType = document.getElementById('new-field-type');
    els.newFieldStep = document.getElementById('new-field-step');
    els.search = document.getElementById('search-input');
    els.tableBody = document.getElementById('table-body');
    els.statTotal = document.getElementById('stat-total');
    els.statToday = document.getElementById('stat-today');
    els.statWeek = document.getElementById('stat-week');
    els.statPending = document.getElementById('stat-pending');
    els.btnExportCsv = document.getElementById('btn-export-csv');
    els.btnExportXls = document.getElementById('btn-export-xls');
    els.btnPrint = document.getElementById('btn-print');
    els.modal = document.getElementById('detail-modal');
    els.modalBody = document.getElementById('modal-body');
    els.btnCloseModal = document.getElementById('btn-close-modal');
  }

  function token() { return sessionStorage.getItem(TOKEN_KEY) || ''; }

  async function apiGet(action, extraParams = {}) {
    const params = new URLSearchParams({ action, token: token(), ...extraParams });
    const res = await fetch(`${FORM_SCHEMA.endpoint}?${params.toString()}`);
    return res.json();
  }

  async function ping() {
    try {
      const result = await apiGet('health');
      if (result && result.status === 'ok') return true;
      Utils.toast('Backend responded with error.', 'error');
      return false;
    } catch (e) {
      console.error('Backend ping failed', e);
      Utils.toast('Cannot reach backend: ' + (e.message || e), 'error');
      return false;
    }
  }

  async function apiPost(action, data = {}) {
    const res = await fetch(FORM_SCHEMA.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, token: token(), ...data }),
    });
    return res.json();
  }

  async function login() {
    const t = token() || (els.tokenInput && els.tokenInput.value.trim());
    if (!t) { Utils.toast('Enter your admin token.', 'error'); return; }
    sessionStorage.setItem(TOKEN_KEY, t);
    els.btnLogin.disabled = true;
    els.btnLogin.innerHTML = `<span class="spinner"></span> Verifying…`;
    try {
      const result = await apiGet('list');
      if (result.status === 'error') throw new Error(result.message || 'Invalid token.');
      submissions = result.submissions || [];
      els.loginGate.classList.add('hidden');
      els.dashboard.classList.remove('hidden');
      renderAll();
    } catch (e) {
      Utils.toast(e.message || 'Login failed. Check your token.', 'error');
      sessionStorage.removeItem(TOKEN_KEY);
    } finally {
      els.btnLogin.disabled = false;
      els.btnLogin.innerHTML = 'Unlock dashboard';
    }
  }

  async function refresh() {
    try {
      const result = await apiGet('list');
      if (result.status === 'error') throw new Error(result.message);
      submissions = result.submissions || [];
      renderAll();
      Utils.toast('Submissions refreshed.', 'success');
    } catch (e) {
      Utils.toast(e.message || 'Could not refresh.', 'error');
    }
  }

  function renderAll() {
    computeStats();
    applyFilter();
  }

  function computeStats() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday); startOfWeek.setDate(startOfWeek.getDate() - 7);

    els.statTotal.textContent = submissions.length;
    els.statToday.textContent = submissions.filter(s => new Date(s.timestamp) >= startOfToday).length;
    els.statWeek.textContent = submissions.filter(s => new Date(s.timestamp) >= startOfWeek).length;
    els.statPending.textContent = submissions.filter(s => (s.status || 'New') !== 'Reviewed').length;
  }

  function applyFilter() {
    const q = (els.search.value || '').toLowerCase().trim();
    filtered = !q ? submissions.slice() : submissions.filter(s =>
      JSON.stringify(s).toLowerCase().includes(q));
    renderTable();
  }

  function renderTable() {
    if (!filtered.length) {
      els.tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-8 field-hint">No submissions found.</td></tr>`;
      return;
    }
    els.tableBody.innerHTML = filtered
      .slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .map(s => `
      <tr>
        <td class="font-mono text-xs">${Utils.escapeHTML((s.submissionId || '').slice(0, 8))}</td>
        <td>${Utils.escapeHTML(Utils.formatDate(s.timestamp))}</td>
        <td>${Utils.escapeHTML(s.full_name || s.values?.full_name || '—')}</td>
        <td>${Utils.escapeHTML(s.email || s.values?.email || '—')}</td>
        <td>${Utils.escapeHTML(s.phone || s.values?.phone || '—')}</td>
        <td><span class="badge ${(s.status === 'Reviewed') ? 'badge-reviewed' : 'badge-new'}">${Utils.escapeHTML(s.status || 'New')}</span></td>
        <td class="no-print">
          <div class="flex gap-1">
            <button class="btn btn-ghost !p-1.5 !text-xs" data-view="${s.submissionId}" title="View">👁</button>
            <button class="btn btn-ghost !p-1.5 !text-xs" data-review="${s.submissionId}" title="Mark reviewed">✓</button>
            <button class="btn btn-ghost !p-1.5 !text-xs" data-delete="${s.submissionId}" title="Delete">🗑</button>
          </div>
        </td>
      </tr>`).join('');
  }

  function openDetail(id) {
    const s = submissions.find(x => x.submissionId === id);
    if (!s) return;
    const rows = Object.entries(s.values || s).filter(([k]) => !['values', 'files'].includes(k));
    els.modalBody.innerHTML = rows.map(([k, v]) => `
      <div class="flex justify-between gap-4 py-1.5 border-b border-[var(--surface-border)]">
        <span class="field-hint">${Utils.escapeHTML(k)}</span>
        <span class="text-right break-all">${Utils.escapeHTML(Array.isArray(v) ? v.join(', ') : String(v ?? '—'))}</span>
      </div>`).join('');
    if (s.files && s.files.length) {
      els.modalBody.innerHTML += `<div class="pt-2"><p class="field-hint mb-1">Files</p>${
        s.files.map(f => `<a href="${f.url}" target="_blank" rel="noopener" class="block text-[var(--primary)] underline text-sm">${Utils.escapeHTML(f.name)}</a>`).join('')
      }</div>`;
    }
    els.modal.classList.remove('hidden');
  }

  async function markReviewed(id) {
    try {
      const result = await apiPost('markReviewed', { submissionId: id });
      if (result.status === 'error') throw new Error(result.message);
      const s = submissions.find(x => x.submissionId === id);
      if (s) s.status = 'Reviewed';
      renderAll();
      Utils.toast('Marked as reviewed.', 'success');
    } catch (e) { Utils.toast(e.message || 'Action failed.', 'error'); }
  }

  async function deleteEntry(id) {
    if (!confirm('Delete this submission permanently?')) return;
    try {
      const result = await apiPost('delete', { submissionId: id });
      if (result.status === 'error') throw new Error(result.message);
      submissions = submissions.filter(x => x.submissionId !== id);
      renderAll();
      Utils.toast('Submission deleted.', 'success');
    } catch (e) { Utils.toast(e.message || 'Action failed.', 'error'); }
  }

  function toCSV() {
    if (!filtered.length) return '';
    const keys = Array.from(new Set(filtered.flatMap(s => Object.keys(s.values || s))));
    const header = ['submissionId', 'timestamp', 'status', ...keys];
    const lines = [header.join(',')];
    filtered.forEach(s => {
      const row = header.map(k => {
        const v = k in s ? s[k] : (s.values ? s.values[k] : '');
        const str = Array.isArray(v) ? v.join('; ') : (v ?? '');
        return `"${String(str).replace(/"/g, '""')}"`;
      });
      lines.push(row.join(','));
    });
    return lines.join('\n');
  }

  function downloadBlob(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  function exportCSV() {
    const csv = toCSV();
    if (!csv) return Utils.toast('Nothing to export.', 'error');
    downloadBlob(csv, `formcraft-submissions-${Date.now()}.csv`, 'text/csv;charset=utf-8;');
    Utils.toast('CSV exported.', 'success');
  }

  function exportExcel() {
    if (!filtered.length) return Utils.toast('Nothing to export.', 'error');
    const table = document.getElementById('submissions-table').cloneNode(true);
    table.querySelectorAll('.no-print').forEach(el => el.remove());
    const html = `<html><head><meta charset="UTF-8"></head><body>${table.outerHTML}</body></html>`;
    downloadBlob(html, `formcraft-submissions-${Date.now()}.xls`, 'application/vnd.ms-excel');
    Utils.toast('Excel file exported.', 'success');
  }

  function renderFormFieldConfig() {
    if (!els.formFieldConfig) return;
    const visibleIds = Utils.getVisibleFieldIds();
    const checked = new Set(visibleIds || []);
    els.formFieldConfig.innerHTML = FORM_SCHEMA.steps.map(step => {
      const boxes = step.fields.map(field => {
        const isChecked = checked.size === 0 || checked.has(field.id);
        return `<label class="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] px-3 py-2 text-sm">
          <input type="checkbox" value="${Utils.escapeHTML(field.id)}" ${isChecked ? 'checked' : ''}>
          <span>${Utils.escapeHTML(field.label || field.id)}</span>
        </label>`;
      }).join('');
      return `<div class="space-y-2">
        <p class="font-semibold text-sm">${Utils.escapeHTML(step.title || 'Step')}</p>
        <div class="grid gap-2 sm:grid-cols-2">${boxes}</div>
      </div>`;
    }).join('');
  }

  function applyFormFieldConfig() {
    const selected = Array.from(els.formFieldConfig.querySelectorAll('input[type="checkbox"]:checked')).map(item => item.value);
    Utils.setVisibleFieldIds(selected);
    renderFormFieldConfig();
    Utils.toast('Form field visibility updated.', 'success');
  }

  function renderFeatureConfig() {
    if (!els.featureConfig) return;
    const flags = Utils.getFeatureFlags();
    const options = [
      { key: 'drafts', label: 'Enable draft restore and autosave' },
      { key: 'reset', label: 'Show reset button' },
      { key: 'progress', label: 'Show progress bar' },
      { key: 'submitLabel', label: 'Show custom submit label' },
      { key: 'intro', label: 'Show intro section' },
    ];
    els.featureConfig.innerHTML = options.map(option => `
      <label class="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--surface-border)] px-3 py-2 text-sm">
        <span>${Utils.escapeHTML(option.label)}</span>
        <input type="checkbox" data-feature="${Utils.escapeHTML(option.key)}" ${flags[option.key] ? 'checked' : ''}>
      </label>
    `).join('');
  }

  function applyFeatureConfig() {
    const flags = {
      drafts: els.featureConfig?.querySelector('[data-feature="drafts"]')?.checked || false,
      reset: els.featureConfig?.querySelector('[data-feature="reset"]')?.checked || false,
      progress: els.featureConfig?.querySelector('[data-feature="progress"]')?.checked || false,
      submitLabel: els.featureConfig?.querySelector('[data-feature="submitLabel"]')?.checked || false,
      intro: els.featureConfig?.querySelector('[data-feature="intro"]')?.checked || false,
    };
    Utils.setFeatureFlags(flags);
    renderFeatureConfig();
    Utils.toast('Feature options updated.', 'success');
  }

  function addCustomField() {
    const label = (els.newFieldLabel?.value || '').trim();
    const id = (els.newFieldId?.value || '').trim().toLowerCase().replace(/\s+/g, '_');
    const type = els.newFieldType?.value || 'text';
    const stepTitle = els.newFieldStep?.value || 'About you';
    if (!label || !id) {
      Utils.toast('Please provide a field label and id.', 'error');
      return;
    }
    const existing = Utils.getCustomFields();
    const next = [...existing, { id, type, label, stepTitle, required: false }];
    Utils.setCustomFields(next);
    els.newFieldLabel.value = '';
    els.newFieldId.value = '';
    Utils.toast('Field added. Refresh the form to see it.', 'success');
  }

  function renderInsights() {
    if (!els.insightPanel) return;
    const totalFields = FORM_SCHEMA.steps.reduce((sum, step) => sum + step.fields.length, 0) + Utils.getCustomFields().length;
    const visibleIds = Utils.getVisibleFieldIds();
    const visibleCount = visibleIds && visibleIds.length ? visibleIds.length : totalFields;
    const customCount = Utils.getCustomFields().length;
    const flags = Utils.getFeatureFlags();
    els.insightPanel.innerHTML = `
      <div class="rounded-[var(--radius-sm)] border border-[var(--surface-border)] p-3">
        <p class="field-hint text-xs uppercase tracking-wide">Visible fields</p>
        <p class="font-display text-xl mt-1">${visibleCount}/${totalFields}</p>
      </div>
      <div class="rounded-[var(--radius-sm)] border border-[var(--surface-border)] p-3">
        <p class="field-hint text-xs uppercase tracking-wide">Custom fields</p>
        <p class="font-display text-xl mt-1">${customCount}</p>
      </div>
      <div class="rounded-[var(--radius-sm)] border border-[var(--surface-border)] p-3">
        <p class="field-hint text-xs uppercase tracking-wide">Enabled features</p>
        <p class="text-sm mt-1">Drafts: ${flags.drafts ? 'On' : 'Off'} · Reset: ${flags.reset ? 'On' : 'Off'} · Progress: ${flags.progress ? 'On' : 'Off'} · Intro: ${flags.intro ? 'On' : 'Off'}</p>
      </div>`;
  }

  function bindEvents() {
    els.btnLogin.addEventListener('click', login);
    els.tokenInput.addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
    els.btnRefresh.addEventListener('click', refresh);
    els.search.addEventListener('input', Utils.debounce(applyFilter, 200));
    els.btnExportCsv.addEventListener('click', exportCSV);
    els.btnApplyFormConfig?.addEventListener('click', applyFormFieldConfig);
    els.btnApplyFeatureConfig?.addEventListener('click', applyFeatureConfig);
    els.btnAddCustomField?.addEventListener('click', addCustomField);
    els.btnExportXls.addEventListener('click', exportExcel);
    els.btnPrint.addEventListener('click', () => window.print());
    els.btnCloseModal.addEventListener('click', () => els.modal.classList.add('hidden'));
    els.tableBody.addEventListener('click', e => {
      const view = e.target.closest('[data-view]');
      const review = e.target.closest('[data-review]');
      const del = e.target.closest('[data-delete]');
      if (view) openDetail(view.dataset.view);
      if (review) markReviewed(review.dataset.review);
      if (del) deleteEntry(del.dataset.delete);
    });
  }

  function init() {
    cacheEls();
    bindEvents();
    renderFormFieldConfig();
    renderFeatureConfig();
    renderInsights();
    // Probe backend early so we can show helpful errors for network/CORS/deployment issues.
    ping().then(ok => { if (ok && token()) login(); });
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', AdminApp.init);
