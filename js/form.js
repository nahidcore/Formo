/* ==========================================================================
   FormCraft — Form Engine
   Drives multi-step navigation, live validation, conditional logic,
   autosave drafts, and submission to the Google Apps Script backend.
   ========================================================================== */

class FormEngine {
  constructor(schema, root) {
    this.schema = Utils.buildVisibleSchema(schema);
    this.root = root;
    this.steps = this.schema.steps;
    this.current = 0;
    this.values = {};
    this.files = {};      // fieldId -> File[]
    this.signatures = {}; // fieldId -> dataURL
    this.draftKey = `formcraft:draft:${schema.formId}`;
    this.rateKey = `formcraft:lastSubmit:${schema.formId}`;
    this.submitting = false;

    this.featureFlags = Utils.getFeatureFlags();

    this.els = {
      stepNav: root.querySelector('#step-nav'),
      stepBody: root.querySelector('#step-body'),
      progressFill: root.querySelector('#progress-fill'),
      progressLabel: root.querySelector('#progress-label'),
      btnBack: root.querySelector('#btn-back'),
      btnNext: root.querySelector('#btn-next'),
      btnSubmit: root.querySelector('#btn-submit'),
      btnReset: root.querySelector('#btn-reset'),
      formIntro: root.querySelector('#form-intro'),
      formShell: root.querySelector('#form-shell'),
      successShell: root.querySelector('#success-shell'),
      errorBanner: root.querySelector('#error-banner'),
      draftBanner: root.querySelector('#draft-banner'),
      honeypot: root.querySelector('#hp_field'),
    };

    this._bindGlobalButtons();
    this._restoreDraft();
    this.renderStepNav();
    this.renderStep();
  }

  /* ---------------- Rendering ---------------- */

  renderStepNav() {
    if (!this.steps.length) {
      this.els.stepNav.innerHTML = '';
      return;
    }
    this.els.stepNav.innerHTML = this.steps.map((s, i) => `
      <div class="flex items-center gap-2 ${i < this.steps.length - 1 ? 'flex-1' : ''}">
        <div class="ink-ring" data-ring="${i}" style="--pct:0"><span>${i + 1}</span></div>
        ${i < this.steps.length - 1 ? `<div class="h-px flex-1 bg-[var(--line)]"></div>` : ''}
      </div>`).join('');
  }

  updateStepNav() {
    if (!this.steps.length) {
      this.els.progressFill.style.width = '0%';
      this.els.progressLabel.textContent = 'No enabled fields';
      return;
    }
    this.steps.forEach((_, i) => {
      const ring = this.els.stepNav.querySelector(`[data-ring="${i}"]`);
      if (!ring) return;
      const pct = i < this.current ? 100 : (i === this.current ? 50 : 0);
      ring.style.setProperty('--pct', pct);
      ring.querySelector('span').textContent = i < this.current ? '✓' : (i + 1);
      if (i < this.current) ring.classList.add('stamp-pop'); else ring.classList.remove('stamp-pop');
    });
    const total = this.steps.length;
    const pct = Math.round(((this.current) / (total - 1)) * 100) || (this.current === 0 ? 0 : 100);
    this.els.progressFill.style.width = `${Math.min(100, ((this.current) / (total - 1)) * 100)}%`;
    this.els.progressLabel.textContent = `Step ${this.current + 1} of ${total} — ${this.steps[this.current].title}`;
  }

  renderStep(direction = 'forward') {
    if (!this.steps.length) {
      this.els.stepBody.innerHTML = '<div class="glass card p-8 text-center">No form fields are enabled right now.</div>';
      this.els.progressFill.style.width = '0%';
      this.els.progressLabel.textContent = 'No enabled fields';
      this._updateNavButtons();
      return;
    }
    const step = this.steps[this.current];
    const wrapper = document.createElement('div');
    wrapper.className = 'step-enter';
    wrapper.innerHTML = `
      <h2 class="font-display text-2xl md:text-3xl mb-1">${Utils.escapeHTML(step.title)}</h2>
      <p class="field-hint mb-6">${Utils.escapeHTML(step.description || '')}</p>
      <div class="fields-container"></div>`;
    const container = wrapper.querySelector('.fields-container');
    step.fields.forEach(f => { container.insertAdjacentHTML('beforeend', FieldRenderer.render(f)); });

    this.els.stepBody.innerHTML = '';
    this.els.stepBody.appendChild(wrapper);
    this._applyFeatureFlags();
    if (this.els.formIntro) {
      this.els.formIntro.classList.toggle('hidden', !Utils.isFeatureEnabled('intro'));
      this.els.formIntro.innerHTML = `<h1 class="font-display text-3xl md:text-4xl font-medium tracking-tight mb-2">${Utils.escapeHTML(this.schema.title || 'Form')}</h1><p class="field-hint">${Utils.escapeHTML(this.schema.subtitle || '')}</p>`;
    }

    // Restore any saved values into inputs
    step.fields.forEach(f => this._hydrateField(f));
    // Attach interactivity
    step.fields.forEach(f => FieldRenderer.attachBehavior(this.els.stepBody, f, this));
    // Apply conditional visibility
    this.applyConditionals();
    this.updateStepNav();
    this._updateNavButtons();
  }

  _applyFeatureFlags() {
    const resetEnabled = Utils.isFeatureEnabled('reset');
    this.els.btnReset.classList.toggle('hidden', !resetEnabled);
    if (Utils.isFeatureEnabled('progress')) {
      this.els.progressFill.parentElement.classList.remove('hidden');
    } else {
      this.els.progressFill.parentElement.classList.add('hidden');
    }
    if (!Utils.isFeatureEnabled('drafts')) {
      this.els.draftBanner.classList.add('hidden');
    }
  }

  _hydrateField(field) {
    const val = this.values[field.id];
    if (val === undefined) return;
    const input = this.els.stepBody.querySelector(`#f_${field.id}`);
    if (!input) return;
    if (field.type === 'checkbox') {
      this.els.stepBody.querySelectorAll(`input[name="${field.id}"]`).forEach(cb => { cb.checked = (val || []).includes(cb.value); });
    } else if (field.type === 'radio') {
      this.els.stepBody.querySelectorAll(`input[name="${field.id}"]`).forEach(rb => { rb.checked = rb.value === val; });
    } else if (field.type === 'multiselect') {
      input.value = JSON.stringify(val);
      this.els.stepBody.querySelectorAll(`[data-multiselect="${field.id}"] .chip`).forEach(chip => {
        if ((val || []).includes(chip.dataset.chipValue)) chip.classList.add('bg-[var(--primary)]', 'text-white');
      });
    } else if (field.type === 'rating') {
      input.value = val;
      this.els.stepBody.querySelectorAll(`[data-rating="${field.id}"] .star`).forEach(s => s.classList.toggle('filled', +s.dataset.star <= val));
    } else if (field.type === 'toggle') {
      const box = this.els.stepBody.querySelector(`[data-toggle="${field.id}"]`);
      if (val === true || val === 'true') box.click();
    } else {
      input.value = val;
    }
  }

  /* ---------------- Conditional logic ---------------- */

  applyConditionals() {
    const step = this.steps[this.current];
    step.fields.forEach(f => {
      if (!f.conditional) return;
      const group = this.els.stepBody.querySelector(`[data-field-id="${f.id}"]`);
      if (!group) return;
      const show = this._evalCondition(f.conditional);
      group.style.display = show ? '' : 'none';
      if (!show) this.clearError(f.id);
    });
  }

  _evalCondition(cond) {
    const val = this.values[cond.field];
    switch (cond.operator) {
      case 'equals': return val === cond.value;
      case 'notEquals': return val !== cond.value;
      case 'includes': return Array.isArray(val) && val.includes(cond.value);
      case 'exists': return val !== undefined && val !== '' && val !== null;
      default: return true;
    }
  }

  /* ---------------- Value collection ---------------- */

  getFieldValue(field) {
    const scope = this.els.stepBody;
    switch (field.type) {
      case 'checkbox':
        return Array.from(scope.querySelectorAll(`input[name="${field.id}"]:checked`)).map(i => i.value);
      case 'radio':
        return scope.querySelector(`input[name="${field.id}"]:checked`)?.value || '';
      case 'multiselect': {
        const raw = scope.querySelector(`#f_${field.id}`)?.value;
        return raw ? JSON.parse(raw) : [];
      }
      case 'toggle':
        return scope.querySelector(`#f_${field.id}`)?.value === 'true';
      case 'rating':
        return Number(scope.querySelector(`#f_${field.id}`)?.value || 0);
      case 'signature':
        return this.signatures[field.id] || null;
      case 'image': case 'pdf': case 'files':
        return (this.files[field.id] || []).map(f => f.name);
      default:
        return scope.querySelector(`#f_${field.id}`)?.value ?? '';
    }
  }

  onFieldChange() {
    const step = this.steps[this.current];
    step.fields.forEach(f => { this.values[f.id] = this.getFieldValue(f); });
    this.applyConditionals();
    this._saveDraft();
  }

  setFiles(fieldId, fileList) { this.files[fieldId] = fileList; }
  setSignature(fieldId, dataUrl) { this.signatures[fieldId] = dataUrl; this.values[fieldId] = dataUrl ? 'signed' : ''; }

  /* ---------------- Validation ---------------- */

  validateField(field, showError = false) {
    if (field.conditional && !this._evalCondition(field.conditional)) return true;
    const v = this.getFieldValue(field);
    const group = this.els.stepBody.querySelector(`[data-field-id="${field.id}"]`);
    const errSlot = group?.querySelector('.error-slot');
    const input = group?.querySelector('.field-input');
    let error = '';

    if (field.required && !Utils.validators.required(v)) error = `${field.label} is required.`;
    else if (field.type === 'email' && !Utils.validators.email(v)) error = 'Enter a valid email address.';
    else if (field.type === 'url' && v && !Utils.validators.url(v)) error = 'Enter a valid URL starting with http(s)://';
    else if (field.type === 'phone' && v && !Utils.validators.phone(v)) error = 'Enter a valid Bangladesh phone number.';
    else if (field.type === 'number' && v !== '' && !Utils.validators.number(v)) error = 'Enter a valid number.';
    else if (field.minLength && v && !Utils.validators.minLength(v, field.minLength)) error = `Minimum ${field.minLength} characters.`;
    else if (field.min !== undefined && v !== '' && !Utils.validators.min(v, field.min)) error = `Minimum value is ${field.min}.`;
    else if (field.max !== undefined && v !== '' && !Utils.validators.max(v, field.max)) error = `Maximum value is ${field.max}.`;
    else if (field.type === 'signature' && field.required && !this.signatures[field.id]) error = 'Please provide a signature.';

    if (errSlot) errSlot.innerHTML = (showError && error) ? `<span>⚠ ${Utils.escapeHTML(error)}</span>` : '';
    if (input) { input.classList.toggle('invalid', showError && !!error); input.classList.toggle('valid', showError && !error && !!v); }
    return !error;
  }

  clearError(fieldId) {
    const group = this.els.stepBody.querySelector(`[data-field-id="${fieldId}"]`);
    if (!group) return;
    group.querySelector('.error-slot').innerHTML = '';
  }

  validateCurrentStep() {
    const step = this.steps[this.current];
    let valid = true;
    step.fields.forEach(f => {
      this.values[f.id] = this.getFieldValue(f);
      const ok = this.validateField(f, true);
      if (!ok) valid = false;
    });
    if (!valid) {
      Utils.toast('Please fix the highlighted fields.', 'error');
      const firstInvalid = this.els.stepBody.querySelector('.invalid');
      firstInvalid?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return valid;
  }

  /* ---------------- Navigation ---------------- */

  _bindGlobalButtons() {
    this.els.btnNext.addEventListener('click', () => this.next());
    this.els.btnBack.addEventListener('click', () => this.prev());
    this.els.btnSubmit.addEventListener('click', () => this.submit());
    this.els.btnReset.addEventListener('click', () => this.resetForm());
  }

  _updateNavButtons() {
    const isLast = this.current === this.steps.length - 1;
    this.els.btnBack.classList.toggle('invisible', this.current === 0);
    this.els.btnNext.classList.toggle('hidden', isLast);
    this.els.btnSubmit.classList.toggle('hidden', !isLast);
  }

  next() {
    if (!this.validateCurrentStep()) return;
    if (this.current < this.steps.length - 1) { this.current++; this.renderStep(); this._saveDraft(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  }

  prev() {
    if (this.current > 0) { this.current--; this.renderStep(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  }

  resetForm() {
    if (!Utils.isFeatureEnabled('reset')) {
      Utils.toast('Reset is disabled by admin settings.', 'info');
      return;
    }
    if (!confirm('Reset the form? All entered data will be cleared.')) return;
    this.values = {}; this.files = {}; this.signatures = {}; this.current = 0;
    localStorage.removeItem(this.draftKey);
    this.renderStep();
    Utils.toast('Form has been reset.', 'info');
  }

  /* ---------------- Draft autosave ---------------- */

  _saveDraft() {
    if (!Utils.isFeatureEnabled('drafts')) return;
    Utils.debounce(() => {
      try {
        localStorage.setItem(this.draftKey, JSON.stringify({ values: this.values, current: this.current, savedAt: Date.now() }));
      } catch (e) { /* storage full or unavailable — ignore silently */ }
    }, 300)();
  }

  _restoreDraft() {
    if (!Utils.isFeatureEnabled('drafts')) return;
    const raw = localStorage.getItem(this.draftKey);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw);
      if (!draft.values || Object.keys(draft.values).length === 0) return;
      this.els.draftBanner.classList.remove('hidden');
      this.els.draftBanner.querySelector('[data-draft-time]').textContent = Utils.formatDate(new Date(draft.savedAt).toISOString());
      this.els.draftBanner.querySelector('[data-restore]').addEventListener('click', () => {
        this.values = draft.values; this.current = draft.current || 0;
        this.renderStep();
        this.els.draftBanner.classList.add('hidden');
        Utils.toast('Draft restored.', 'success');
      });
      this.els.draftBanner.querySelector('[data-discard]').addEventListener('click', () => {
        localStorage.removeItem(this.draftKey);
        this.els.draftBanner.classList.add('hidden');
      });
    } catch (e) { localStorage.removeItem(this.draftKey); }
  }

  /* ---------------- Submission ---------------- */

  async submit() {
    if (this.submitting) return;
    if (!this.validateCurrentStep()) return;

    // Honeypot check — if filled, silently "succeed" without hitting the network
    if (this.els.honeypot && this.els.honeypot.value.trim() !== '') {
      this._showSuccess('SPAM-IGNORED');
      return;
    }

    // Client-side soft rate limit (server enforces the real limit)
    const last = Number(localStorage.getItem(this.rateKey) || 0);
    if (Date.now() - last < 15000) {
      Utils.toast('Please wait a few seconds before submitting again.', 'error');
      return;
    }

    this.submitting = true;
    this._setLoading(true);

    try {
      const submissionId = Utils.uuid();
      const payload = {
        formId: this.schema.formId,
        submissionId,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        honeypot: this.els.honeypot?.value || '',
        values: this._sanitizedValues(),
        files: await this._collectFilesPayload(),
        signatures: this.signatures,
      };

      const res = await fetch(this.schema.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // avoids CORS preflight for Apps Script
        body: JSON.stringify(payload),
      });

      let result;
      try { result = await res.json(); } catch { result = { status: 'ok' }; }

      if (result.status === 'error') throw new Error(result.message || 'Submission failed.');

      localStorage.setItem(this.rateKey, String(Date.now()));
      localStorage.removeItem(this.draftKey);
      this._showSuccess(result.submissionId || submissionId);
    } catch (err) {
      console.error(err);
      this._showError(err.message || 'Something went wrong. Please try again.');
    } finally {
      this.submitting = false;
      this._setLoading(false);
    }
  }

  _sanitizedValues() {
    const out = {};
    this.steps.forEach(s => s.fields.forEach(f => {
      if (['image', 'pdf', 'files', 'signature'].includes(f.type)) return;
      const v = this.values[f.id];
      out[f.id] = Array.isArray(v) ? v.map(Utils.sanitizeInput) : Utils.sanitizeInput(String(v ?? ''));
    }));
    return out;
  }

  async _collectFilesPayload() {
    const payload = [];
    for (const [fieldId, list] of Object.entries(this.files)) {
      for (const file of (list || [])) {
        const base64 = await Utils.fileToBase64(file);
        payload.push({ fieldId, name: file.name, mimeType: file.type || 'application/octet-stream', size: file.size, base64 });
      }
    }
    return payload;
  }

  _setLoading(isLoading) {
    this.els.btnSubmit.disabled = isLoading;
    this.els.btnSubmit.innerHTML = isLoading
      ? `<span class="spinner"></span> Submitting…`
      : (Utils.isFeatureEnabled('submitLabel') ? (this.schema.submitLabel || 'Submit application') : 'Submit');
  }

  _showSuccess(submissionId) {
    this.els.formShell.classList.add('hidden');
    this.els.successShell.classList.remove('hidden');
    this.els.successShell.querySelector('[data-submission-id]').textContent = submissionId;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  _showError(message) {
    this.els.errorBanner.classList.remove('hidden');
    this.els.errorBanner.querySelector('[data-error-message]').textContent = message;
    setTimeout(() => this.els.errorBanner.classList.add('hidden'), 6000);
    Utils.toast(message, 'error');
  }

  /** Rebuild the visible form after the shared topic list has loaded. */
  refreshSchema() {
    const savedValues = { ...this.values };
    const savedFiles = { ...this.files };
    const savedSignatures = { ...this.signatures };

    this.schema = Utils.buildVisibleSchema(FORM_SCHEMA);
    this.steps = this.schema.steps;
    this.current = Math.max(0, Math.min(this.current, this.steps.length - 1));
    this.values = savedValues;
    this.files = savedFiles;
    this.signatures = savedSignatures;
    this.renderStepNav();
    this.renderStep();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('form-root');
  if (root) window.formEngine = new FormEngine(FORM_SCHEMA, root);
});
