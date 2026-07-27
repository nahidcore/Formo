/* ==========================================================================
   FormCraft — Admin Dashboard Logic
   ========================================================================== */

const AdminApp = (() => {
  const TOKEN_KEY = 'formcraft:admin-token';
  let submissions = [];
  let filtered = [];
  let editingTopicSlug = null;

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
    els.btnCreateTopic = document.getElementById('btn-create-topic');
    els.topicName = document.getElementById('topic-name');
    els.topicSlug = document.getElementById('topic-slug');
    els.topicFieldList = document.getElementById('topic-field-list');
    els.topicList = document.getElementById('topic-list');
    // Topic dashboard (new)
    els.topicDashSelect = document.getElementById('topic-dashboard-select');
    els.topicDashPanel = document.getElementById('topic-dash-panel');
    els.topicDashEmpty = document.getElementById('topic-dash-empty');
    els.topicDashUrl = document.getElementById('topic-dash-url');
    els.topicDashCopy = document.getElementById('topic-dash-copy');
    els.topicDashOpen = document.getElementById('topic-dash-open');
    els.topicDashFields = document.getElementById('topic-dash-fields');
    els.topicDashStatFields = document.getElementById('topic-dash-stat-fields');
    els.topicDashStatSubs = document.getElementById('topic-dash-stat-subs');
    els.topicDashStatPending = document.getElementById('topic-dash-stat-pending');
    els.topicDashApply = document.getElementById('topic-dash-apply');
    // Legacy (kept for compatibility)
    els.topicSelect = null;
    els.topicShareUrl = null;
    els.topicPreview = null;
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
        <td>${Utils.escapeHTML(formatDetailValue(getSubmissionFieldValue(s, 'full_name')))}</td>
        <td>${Utils.escapeHTML(formatDetailValue(getSubmissionFieldValue(s, 'email')))}</td>
        <td>${Utils.escapeHTML(formatDetailValue(getSubmissionFieldValue(s, 'phone')))}</td>
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

    const subKeys = Object.keys(s.values || {});
    
    // Auto-detect which topic this submission matches best
    const topics = Utils.getTopics();
    let bestMatch = null;
    let maxMatchCount = 0;
    topics.forEach(t => {
      if (!t.fieldIds) return;
      const matchCount = t.fieldIds.filter(fId => subKeys.includes(fId) && s.values[fId]).length;
      if (matchCount > maxMatchCount && matchCount > 0) {
        maxMatchCount = matchCount;
        bestMatch = t;
      }
    });

    const fullName = getSubmissionFieldValue(s, 'full_name') || getSubmissionFieldValue(s, 'name') || 'Anonymous';
    const email = getSubmissionFieldValue(s, 'email') || 'No email';
    const phone = getSubmissionFieldValue(s, 'phone') || 'No phone';

    let html = `
      <div class="flex items-center justify-between gap-4 border-b border-[var(--surface-border)] pb-4 mb-4">
        <div>
          <h3 class="font-display text-xl mb-1">${Utils.escapeHTML(fullName)}</h3>
          <p class="field-hint text-sm">${Utils.escapeHTML(email)} · ${Utils.escapeHTML(phone)}</p>
        </div>
        <div class="text-right flex flex-col items-end">
          <span class="badge ${s.status === 'Reviewed' ? 'badge-reviewed' : 'badge-new'} mb-1.5">${Utils.escapeHTML(s.status || 'New')}</span>
          <p class="text-[0.7rem] field-hint uppercase tracking-wider">${Utils.formatDate(s.timestamp)}</p>
        </div>
      </div>
    `;

    html += `
      <div class="grid grid-cols-2 gap-3 mb-6 bg-[var(--surface)] border border-[var(--surface-border)] rounded-[var(--radius-sm)] p-3 text-sm">
        <div>
          <p class="field-hint text-[0.65rem] uppercase tracking-wider font-semibold mb-1">Submission ID</p>
          <p class="font-mono text-xs text-[var(--foreground)]">${s.submissionId || '—'}</p>
        </div>
        <div>
          <p class="field-hint text-[0.65rem] uppercase tracking-wider font-semibold mb-1">Inferred Topic</p>
          <p class="font-medium flex items-center gap-1.5 text-xs">
            ${bestMatch ? `<span class="w-2 h-2 rounded-full bg-[var(--primary)] shadow-[0_0_8px_var(--primary)]"></span> ${Utils.escapeHTML(bestMatch.name)}` : '<span class="w-2 h-2 rounded-full bg-gray-400"></span> <i class="field-hint">General</i>'}
          </p>
        </div>
      </div>
    `;

    const steps = typeof FORM_SCHEMA !== 'undefined' ? FORM_SCHEMA.steps : [];
    const customFields = Utils.getCustomFields();
    
    const renderFieldGroup = (title, fields) => {
      let groupHtml = '';
      let hasData = false;
      fields.forEach(f => {
        const value = getSubmissionFieldValue(s, f.id);
        if (value === undefined || value === null || value === '') return;
        hasData = true;
        groupHtml += `
          <div class="py-2.5 border-b border-[var(--surface-border)] last:border-0">
            <span class="block text-[0.75rem] font-medium field-hint mb-0.5">${Utils.escapeHTML(f.label || f.id)}</span>
            <span class="block break-words text-sm font-medium text-[var(--foreground)]">${Utils.escapeHTML(formatDetailValue(value))}</span>
          </div>`;
      });
      if (!hasData) return '';
      return `
        <div class="mb-6 last:mb-0">
          <h4 class="font-semibold text-xs tracking-wide uppercase border-b-2 border-[var(--primary)]/30 inline-block pb-1 mb-3">${Utils.escapeHTML(title)}</h4>
          <div class="bg-black/5 dark:bg-white/5 rounded-xl p-4 border border-[var(--surface-border)] shadow-sm">
            ${groupHtml}
          </div>
        </div>`;
    };

    steps.forEach(step => { html += renderFieldGroup(step.title, step.fields); });
    if (customFields && customFields.length) { html += renderFieldGroup('Custom Fields', customFields); }

    const configuredIds = new Set([
      ...(steps.flatMap(step => step.fields.map(f => f.id))),
      ...(customFields.map(f => f.id)),
      'full_name', 'name', 'email', 'phone'
    ]);
    
    const extraFields = subKeys.filter(k => !configuredIds.has(k)).map(k => ({ id: k, label: k }));
    if (extraFields.length) { html += renderFieldGroup('Other Data', extraFields); }

    if (s.files && s.files.length) {
      html += `
        <div class="mt-6">
          <h4 class="font-semibold text-xs tracking-wide uppercase border-b-2 border-[var(--primary)]/30 inline-block pb-1 mb-3">Attachments</h4>
          <div class="flex flex-col gap-2">
            ${s.files.map(f => `
              <a href="${f.url}" target="_blank" rel="noopener" class="flex items-center gap-3 bg-[var(--surface)] border border-[var(--surface-border)] p-3 rounded-lg hover:border-[var(--primary)] transition-colors group">
                <div class="w-8 h-8 rounded bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                </div>
                <span class="text-sm font-medium truncate flex-1">${Utils.escapeHTML(f.name)}</span>
              </a>
            `).join('')}
          </div>
        </div>`;
    }

    els.modalBody.innerHTML = html;
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

  function getConfiguredFields() {
    const visibleIds = Utils.getVisibleFieldIds();
    const visibleSet = new Set(visibleIds || []);
    const fields = [];
    FORM_SCHEMA.steps.forEach(step => {
      step.fields.forEach(field => {
        if (visibleSet.size === 0 || visibleSet.has(field.id)) {
          fields.push({ ...field, stepTitle: step.title });
        }
      });
    });
    Utils.getCustomFields().forEach(field => {
      if (visibleSet.size === 0 || visibleSet.has(field.id)) {
        fields.push({ ...field, stepTitle: field.stepTitle || 'Custom' });
      }
    });
    return fields;
  }

  function getSubmissionFieldValue(submission, fieldId) {
    const values = submission?.values || {};
    if (submission?.[fieldId] !== undefined && submission?.[fieldId] !== null && submission?.[fieldId] !== '') return submission[fieldId];
    if (values[fieldId] !== undefined && values[fieldId] !== null && values[fieldId] !== '') return values[fieldId];
    const aliases = {
      full_name: ['full_name', 'name', 'Name'],
      email: ['email', 'Email'],
      phone: ['phone', 'Phone'],
    };
    for (const alias of aliases[fieldId] || []) {
      const value = values[alias] ?? submission?.[alias];
      if (value !== undefined && value !== null && value !== '') return value;
    }
    return '';
  }

  function formatDetailValue(value) {
    if (value === null || value === undefined || value === '') return '—';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  function getAllConfiguredFields() {
    const fields = [];
    FORM_SCHEMA.steps.forEach(step => {
      step.fields.forEach(field => fields.push({ ...field, stepTitle: step.title }));
    });
    Utils.getCustomFields().forEach(field => {
      fields.push({ ...field, stepTitle: field.stepTitle || 'Custom' });
    });
    return fields;
  }

  function renderFormFieldConfig() {
    if (!els.formFieldConfig) return;
    const visibleIds = Utils.getVisibleFieldIds();
    const checked = new Set(visibleIds || []);
    const grouped = {};
    getConfiguredFields().forEach(field => {
      const stepTitle = field.stepTitle || 'Custom';
      if (!grouped[stepTitle]) grouped[stepTitle] = [];
      grouped[stepTitle].push(field);
    });
    els.formFieldConfig.innerHTML = Object.entries(grouped).map(([stepTitle, fields]) => {
      const boxes = fields.map(field => {
        const isChecked = checked.size === 0 || checked.has(field.id);
        return `<label class="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] px-3 py-2 text-sm">
          <input type="checkbox" value="${Utils.escapeHTML(field.id)}" ${isChecked ? 'checked' : ''}>
          <span>${Utils.escapeHTML(field.label || field.id)}</span>
        </label>`;
      }).join('');
      return `<div class="space-y-2">
        <p class="font-semibold text-sm">${Utils.escapeHTML(stepTitle || 'Step')}</p>
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

  function syncTopicEditorUI() {
    if (!els.btnCreateTopic) return;
    els.btnCreateTopic.textContent = editingTopicSlug ? 'Save topic' : 'Create topic';
  }

  function renderTopicFieldList() {
    if (!els.topicFieldList) return;
    const fields = getAllConfiguredFields();
    const topics = Utils.getTopics();
    const topic = topics.find(item => item.slug === editingTopicSlug) || topics.find(item => item.slug === Utils.getActiveTopicSlug());
    const selectedIds = topic?.fieldIds || Utils.getVisibleFieldIds() || [];
    const checked = new Set(selectedIds || []);
    const grouped = {};
    fields.forEach(field => {
      const stepTitle = field.stepTitle || 'Custom';
      if (!grouped[stepTitle]) grouped[stepTitle] = [];
      grouped[stepTitle].push(field);
    });

    els.topicFieldList.innerHTML = Object.entries(grouped).map(([stepTitle, groupFields]) => {
      const boxes = groupFields.map(field => {
        const isChecked = checked.size === 0 || checked.has(field.id);
        return `<label class="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--surface-border)] px-3 py-2 text-sm">
          <input type="checkbox" value="${Utils.escapeHTML(field.id)}" ${isChecked ? 'checked' : ''}>
          <span>${Utils.escapeHTML(field.label || field.id)}</span>
        </label>`;
      }).join('');
      return `<div class="space-y-2">
        <p class="font-semibold text-sm">${Utils.escapeHTML(stepTitle || 'Step')}</p>
        <div class="grid gap-2 sm:grid-cols-2">${boxes}</div>
      </div>`;
    }).join('');
  }

  function renderTopicsList() {
    if (!els.topicList) return;
    const topics = Utils.getTopics();
    if (!topics.length) {
      els.topicList.innerHTML = '<div class="rounded-[var(--radius-sm)] border border-[var(--surface-border)] p-3 text-sm field-hint">No topics created yet.</div>';
      return;
    }
    els.topicList.innerHTML = topics.map(topic => `
      <div class="rounded-[var(--radius-sm)] border border-[var(--surface-border)] p-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="font-semibold text-sm">${Utils.escapeHTML(topic.name)}</p>
          <p class="field-hint text-xs">Slug: ${Utils.escapeHTML(topic.slug)} · Fields: ${topic.fieldIds?.length || 0}</p>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-ghost !p-2 !text-xs" data-apply-topic="${Utils.escapeHTML(topic.slug)}">Use</button>
          <button class="btn btn-ghost !p-2 !text-xs" data-edit-topic="${Utils.escapeHTML(topic.slug)}">Edit</button>
          <button class="btn btn-ghost !p-2 !text-xs" data-delete-topic="${Utils.escapeHTML(topic.slug)}">Delete</button>
        </div>
      </div>
    `).join('');
  }

  /* ── Topic Dashboard (new) ── */
  function buildPublicUrl(slug) {
    const base = window.location.origin + window.location.pathname.replace('admin.html', 'index.html');
    return `${base}?topic=${encodeURIComponent(slug)}`;
  }

  function copyToClipboard(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
      const orig = btn.innerHTML;
      btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg> Copied!`;
      btn.style.background = 'linear-gradient(135deg,var(--success),#16a34a)';
      setTimeout(() => { btn.innerHTML = orig; btn.style.background = ''; }, 2000);
    }).catch(() => Utils.toast('Copy failed — please copy manually.', 'error'));
  }

  function renderTopicDashboardSelector() {
    if (!els.topicDashSelect) return;
    const topics = Utils.getTopics();
    els.topicDashSelect.innerHTML = '<option value="">— Choose a topic —</option>' +
      topics.map(t => `<option value="${Utils.escapeHTML(t.slug)}">${Utils.escapeHTML(t.name)}  /${Utils.escapeHTML(t.slug)}</option>`).join('');
    // Restore previously selected if any
    const active = Utils.getActiveTopicSlug();
    if (active) els.topicDashSelect.value = active;
    renderTopicDashboard(els.topicDashSelect.value);
  }

  function renderTopicDashboard(slug) {
    const panel = els.topicDashPanel;
    const empty = els.topicDashEmpty;
    if (!panel) return;

    if (!slug) {
      panel.classList.add('hidden');
      if (empty) empty.style.display = '';
      return;
    }

    const topic = Utils.getTopics().find(t => t.slug === slug);
    if (!topic) {
      panel.classList.add('hidden');
      if (empty) empty.style.display = '';
      return;
    }

    if (empty) empty.style.display = 'none';
    panel.classList.remove('hidden');
    panel.classList.add('reveal-anim');
    setTimeout(() => panel.classList.remove('reveal-anim'), 400);

    // Share URL
    const url = buildPublicUrl(topic.slug);
    if (els.topicDashUrl) els.topicDashUrl.textContent = url;
    if (els.topicDashOpen) els.topicDashOpen.href = url;
    if (els.topicDashCopy) {
      els.topicDashCopy.onclick = () => copyToClipboard(url, els.topicDashCopy);
    }

    // Field tags
    const allFields = getAllConfiguredFields();
    const fieldIds = topic.fieldIds || [];
    if (els.topicDashStatFields) els.topicDashStatFields.textContent = fieldIds.length;
    if (els.topicDashFields) {
      if (!fieldIds.length) {
        els.topicDashFields.innerHTML = '<span class="field-hint text-xs">No fields selected for this topic.</span>';
      } else {
        els.topicDashFields.innerHTML = fieldIds.map(id => {
          const f = allFields.find(x => x.id === id);
          const label = f ? (f.label || id) : id;
          return `<span class="field-tag"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>${Utils.escapeHTML(label)}</span>`;
        }).join('');
      }
    }

    // Submission stats for this topic (topics share field IDs as the filter signal)
    const fieldSet = new Set(fieldIds);
    const topicSubs = fieldSet.size === 0 ? submissions : submissions.filter(s => {
      const keys = Object.keys(s.values || {});
      return keys.some(k => fieldSet.has(k));
    });
    const pending = topicSubs.filter(s => (s.status || 'New') !== 'Reviewed').length;
    if (els.topicDashStatSubs) els.topicDashStatSubs.textContent = topicSubs.length;
    if (els.topicDashStatPending) els.topicDashStatPending.textContent = pending;

    // Apply button
    if (els.topicDashApply) {
      els.topicDashApply.onclick = () => applyTopic(slug);
    }
  }

  function renderTopicSelector() {
    // Kept as a no-op — replaced by renderTopicDashboardSelector
  }

  function renderTopicPreview() {
    // Kept as a no-op — replaced by renderTopicDashboard
  }

  function startEditTopic(slug) {
    const topic = Utils.getTopics().find(item => item.slug === slug);
    if (!topic) return;
    editingTopicSlug = topic.slug;
    if (els.topicName) els.topicName.value = topic.name;
    if (els.topicSlug) els.topicSlug.value = topic.slug;
    renderTopicFieldList();
    syncTopicEditorUI();
    Utils.toast(`Editing topic "${topic.name}".`, 'info');
  }

  async function createTopic() {
    const name = (els.topicName?.value || '').trim();
    const typedSlug = (els.topicSlug?.value || '').trim();
    if (!name) {
      Utils.toast('Please enter a topic name.', 'error');
      return;
    }

    let slug = typedSlug || Utils.slugify(name);
    slug = Utils.slugify(slug);
    if (!slug) {
      Utils.toast('Please provide a valid topic slug.', 'error');
      return;
    }

    const topics = Utils.getTopics();
    const existingIndex = topics.findIndex(item => item.slug === editingTopicSlug);
    if (existingIndex >= 0 && editingTopicSlug && editingTopicSlug !== slug) {
      const renamed = topics.filter(item => item.slug !== editingTopicSlug);
      if (renamed.some(item => item.slug === slug)) {
        let suffix = 2;
        let candidate = `${slug}-${suffix}`;
        while (renamed.some(item => item.slug === candidate)) { suffix += 1; candidate = `${slug}-${suffix}`; }
        slug = candidate;
      }
    } else if (editingTopicSlug && existingIndex >= 0) {
      // keep same slug
    } else {
      const exists = topics.some(item => item.slug === slug);
      if (exists) {
        let suffix = 2;
        let candidate = `${slug}-${suffix}`;
        while (topics.some(item => item.slug === candidate)) { suffix += 1; candidate = `${slug}-${suffix}`; }
        slug = candidate;
      }
    }

    const selected = Array.from(els.topicFieldList?.querySelectorAll('input[type="checkbox"]:checked') || []).map(item => item.value);
    const nextTopics = existingIndex >= 0
      ? topics.map((item, i) => i === existingIndex ? { ...item, name, slug, fieldIds: selected } : item)
      : [...topics, { name, slug, fieldIds: selected, createdAt: new Date().toISOString() }];

    // Save to server first
    if (els.btnCreateTopic) { els.btnCreateTopic.disabled = true; els.btnCreateTopic.innerHTML = '<span class="spinner"></span> Saving…'; }
    try {
      await Utils.saveTopicsToServer(nextTopics, token());
      Utils.toast(existingIndex >= 0 ? `Topic "${name}" updated.` : `Topic "${name}" created.`, 'success');
    } catch (e) {
      Utils.toast('Topic was not saved to the live site: ' + (e.message || e), 'error');
      return;
    } finally {
      if (els.btnCreateTopic) { els.btnCreateTopic.disabled = false; syncTopicEditorUI(); }
    }

    Utils.setActiveTopicSlug(slug);
    Utils.setVisibleFieldIds(selected);
    editingTopicSlug = null;
    if (els.topicName) els.topicName.value = '';
    if (els.topicSlug) els.topicSlug.value = '';
    renderTopicFieldList();
    renderTopicsList();
    renderTopicDashboardSelector();
    renderFormFieldConfig();
    renderInsights();
    syncTopicEditorUI();
  }

  function applyTopic(slug) {
    const topic = Utils.getTopics().find(item => item.slug === slug);
    if (!topic) return;
    Utils.setActiveTopicSlug(topic.slug);
    Utils.setVisibleFieldIds(topic.fieldIds || []);
    renderTopicFieldList();
    renderFormFieldConfig();
    renderInsights();
    // Refresh dashboard selector to reflect new active topic
    if (els.topicDashSelect) els.topicDashSelect.value = slug;
    renderTopicDashboard(slug);
    Utils.toast(`Applied topic "${topic.name}".`, 'success');
  }

  async function deleteTopic(slug) {
    if (!confirm('Delete this topic?')) return;

    // Persist to server
    try {
      await Utils.deleteTopicFromServer(slug, token());
      if (editingTopicSlug === slug) editingTopicSlug = null;
      if (Utils.getActiveTopicSlug() === slug) {
        Utils.setActiveTopicSlug('');
        Utils.setVisibleFieldIds([]);
      }
      Utils.toast('Topic deleted.', 'success');
    } catch (e) {
      Utils.toast('Topic was not deleted from the live site: ' + (e.message || e), 'error');
      return;
    }

    renderTopicFieldList();
    renderTopicsList();
    renderTopicDashboardSelector();
    renderFormFieldConfig();
    renderInsights();
    syncTopicEditorUI();
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
    const topics = Utils.getTopics();
    const activeTopic = topics.find(item => item.slug === Utils.getActiveTopicSlug());
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
        <p class="field-hint text-xs uppercase tracking-wide">Topics</p>
        <p class="text-sm mt-1">Total: ${topics.length} · Active: ${activeTopic ? Utils.escapeHTML(activeTopic.name) : 'None'}</p>
      </div>`;
  }

  function bindEvents() {
    els.btnLogin.addEventListener('click', login);
    els.tokenInput.addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
    els.btnRefresh.addEventListener('click', refresh);
    els.search.addEventListener('input', Utils.debounce(applyFilter, 200));
    els.btnExportCsv.addEventListener('click', exportCSV);
    els.btnCreateTopic?.addEventListener('click', createTopic);
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

    els.topicList?.addEventListener('click', e => {
      const apply = e.target.closest('[data-apply-topic]');
      const edit = e.target.closest('[data-edit-topic]');
      const del = e.target.closest('[data-delete-topic]');
      if (apply) applyTopic(apply.dataset.applyTopic);
      if (edit) startEditTopic(edit.dataset.editTopic);
      if (del) deleteTopic(del.dataset.deleteTopic);
    });

    // Topic dashboard selector
    els.topicDashSelect?.addEventListener('change', e => {
      renderTopicDashboard(e.target.value);
    });

    // Slug auto-generate in topic editor
    els.topicName?.addEventListener('input', () => {
      if (!els.topicSlug) return;
      if (!editingTopicSlug) {
        els.topicSlug.value = Utils.slugify(els.topicName.value);
      }
    });
  }

  async function loadTopicsFromServer() {
    const serverTopics = await Utils.fetchTopicsFromServer();
    if (serverTopics !== null) {
      const activeTopic = serverTopics.find(t => t.slug === Utils.getActiveTopicSlug());
      if (activeTopic) Utils.setVisibleFieldIds(activeTopic.fieldIds || []);
      renderTopicFieldList();
      renderTopicsList();
      renderTopicDashboardSelector();
      renderFormFieldConfig();
      renderInsights();
    }
  }

  function init() {
    cacheEls();
    bindEvents();
    const activeTopic = Utils.getTopics().find(item => item.slug === Utils.getActiveTopicSlug());
    if (activeTopic) {
      Utils.setVisibleFieldIds(activeTopic.fieldIds || []);
    }
    syncTopicEditorUI();
    renderTopicFieldList();
    renderTopicsList();
    renderTopicDashboardSelector();
    renderFormFieldConfig();
    renderFeatureConfig();
    renderInsights();
    // Load topics from server (public GET, no token needed) on startup
    loadTopicsFromServer();
    // Probe backend; auto-login if token cached
    ping().then(ok => { if (ok && token()) login(); });
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', AdminApp.init);
