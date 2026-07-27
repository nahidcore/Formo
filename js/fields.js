/* ==========================================================================
   FormCraft — Field Renderer
   Renders every supported field type from a schema definition and wires
   up any custom interactive behavior (signature pad, rating, toggle, etc).
   ========================================================================== */

const FieldRenderer = (() => {

  function wrap(field, innerHTML, extra = '') {
    const req = field.required ? '<span class="text-[var(--danger)] ml-0.5">*</span>' : '';
    const hint = field.hint ? `<p class="field-hint mt-1">${Utils.escapeHTML(field.hint)}</p>` : '';
    return `
      <div class="field-group mb-5" data-field-id="${field.id}" data-field-type="${field.type}">
        <label class="field-label block mb-2" for="f_${field.id}">${Utils.escapeHTML(field.label)}${req}</label>
        ${innerHTML}
        ${hint}
        ${extra}
        <div class="error-slot" role="alert" aria-live="polite"></div>
      </div>`;
  }

  const renderers = {
    text: f => wrap(f, `<input class="field-input" id="f_${f.id}" name="${f.id}" type="text"
        placeholder="${Utils.escapeHTML(f.placeholder || '')}" maxlength="${f.maxLength || 500}"
        autocomplete="${f.autocomplete || 'off'}" aria-required="${!!f.required}">`,
        f.maxLength ? `<div class="flex justify-end"><span class="char-counter" data-counter-for="${f.id}">0/${f.maxLength}</span></div>` : ''),

    email: f => wrap(f, `<input class="field-input" id="f_${f.id}" name="${f.id}" type="email"
        placeholder="${Utils.escapeHTML(f.placeholder || 'name@example.com')}" autocomplete="email" aria-required="${!!f.required}">`),

    phone: f => wrap(f, `<input class="field-input" id="f_${f.id}" name="${f.id}" type="tel" inputmode="numeric"
        placeholder="${Utils.escapeHTML(f.placeholder || '+880 1712-345678')}" aria-required="${!!f.required}">`),

    url: f => wrap(f, `<input class="field-input" id="f_${f.id}" name="${f.id}" type="url"
        placeholder="${Utils.escapeHTML(f.placeholder || 'https://example.com')}" aria-required="${!!f.required}">`),

    password: f => wrap(f, `
      <div class="relative">
        <input class="field-input pr-11" id="f_${f.id}" name="${f.id}" type="password"
          minlength="${f.minLength || 6}" aria-required="${!!f.required}">
        <button type="button" class="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]" data-toggle-pw="${f.id}" aria-label="Show password">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </div>`),

    number: f => wrap(f, `<input class="field-input" id="f_${f.id}" name="${f.id}" type="number"
        min="${f.min ?? ''}" max="${f.max ?? ''}" placeholder="${Utils.escapeHTML(f.placeholder || '')}" aria-required="${!!f.required}">`),

    textarea: f => wrap(f, `<textarea class="field-input" id="f_${f.id}" name="${f.id}" rows="5"
        maxlength="${f.maxLength || 2000}" placeholder="${Utils.escapeHTML(f.placeholder || '')}" aria-required="${!!f.required}"></textarea>`,
        `<div class="flex justify-end"><span class="char-counter" data-counter-for="${f.id}">0/${f.maxLength || 2000}</span></div>`),

    date: f => wrap(f, `<input class="field-input" id="f_${f.id}" name="${f.id}" type="date" aria-required="${!!f.required}">`),

    time: f => wrap(f, `<input class="field-input" id="f_${f.id}" name="${f.id}" type="time" aria-required="${!!f.required}">`),

    dropdown: f => wrap(f, `
      <select class="field-input" id="f_${f.id}" name="${f.id}" aria-required="${!!f.required}">
        <option value="" disabled selected>Choose an option…</option>
        ${f.options.map(o => `<option value="${Utils.escapeHTML(o)}">${Utils.escapeHTML(o)}</option>`).join('')}
      </select>`),

    radio: f => wrap(f, `
      <div class="grid gap-2" role="radiogroup" aria-required="${!!f.required}">
        ${f.options.map((o, i) => `
          <label class="flex items-center gap-3 p-3 rounded-[var(--radius-sm)] border border-[var(--surface-border)] cursor-pointer hover:bg-[var(--surface)] transition">
            <input type="radio" name="${f.id}" value="${Utils.escapeHTML(o)}" id="f_${f.id}_${i}" class="accent-[var(--primary)] w-4 h-4">
            <span class="text-sm">${Utils.escapeHTML(o)}</span>
          </label>`).join('')}
      </div>`),

    checkbox: f => wrap(f, `
      <div class="grid gap-2" role="group" aria-required="${!!f.required}">
        ${f.options.map((o, i) => `
          <label class="flex items-center gap-3 p-3 rounded-[var(--radius-sm)] border border-[var(--surface-border)] cursor-pointer hover:bg-[var(--surface)] transition">
            <input type="checkbox" name="${f.id}" value="${Utils.escapeHTML(o)}" id="f_${f.id}_${i}" class="accent-[var(--primary)] w-4 h-4">
            <span class="text-sm">${Utils.escapeHTML(o)}</span>
          </label>`).join('')}
      </div>`),

    multiselect: f => wrap(f, `
      <div class="flex flex-wrap gap-2" data-multiselect="${f.id}" role="group" aria-required="${!!f.required}">
        ${f.options.map(o => `
          <button type="button" class="chip px-3 py-1.5 rounded-full text-sm border border-[var(--surface-border)] transition"
            data-chip-value="${Utils.escapeHTML(o)}">${Utils.escapeHTML(o)}</button>`).join('')}
      </div>
      <input type="hidden" id="f_${f.id}" name="${f.id}">`),

    color: f => wrap(f, `
      <div class="flex items-center gap-3">
        <input class="w-14 h-11 rounded-[var(--radius-sm)] border border-[var(--surface-border)] cursor-pointer bg-transparent"
          id="f_${f.id}" name="${f.id}" type="color" value="${f.default || '#0F766E'}">
        <span class="font-mono text-sm" data-color-value="${f.id}">${f.default || '#0F766E'}</span>
      </div>`),

    range: f => wrap(f, `
      <div>
        <input class="w-full" id="f_${f.id}" name="${f.id}" type="range" min="${f.min}" max="${f.max}" step="${f.step || 1}" value="${f.default ?? f.min}">
        <div class="flex justify-between text-xs font-mono text-[var(--ink-soft)] mt-1">
          <span>${f.min}</span><span data-range-value="${f.id}" class="font-semibold text-[var(--primary)]">${f.default ?? f.min}</span><span>${f.max}</span>
        </div>
      </div>`),

    rating: f => wrap(f, `
      <div class="flex gap-1" data-rating="${f.id}" role="radiogroup">
        ${Array.from({ length: f.max || 5 }, (_, i) => `<span class="star" data-star="${i + 1}" role="radio" aria-checked="false" tabindex="0">★</span>`).join('')}
      </div>
      <input type="hidden" id="f_${f.id}" name="${f.id}">`),

    toggle: f => wrap(f, `
      <div class="flex items-center gap-3">
        <div class="toggle" data-toggle="${f.id}" role="switch" aria-checked="false" tabindex="0"><div class="knob"></div></div>
        <span class="text-sm text-[var(--ink-soft)]" data-toggle-label="${f.id}">Off</span>
      </div>
      <input type="hidden" id="f_${f.id}" name="${f.id}" value="false">`),

    image: f => renderDropzone(f, 'image/*', false, '🖼️'),
    pdf: f => renderDropzone(f, 'application/pdf', false, '📄'),
    files: f => renderDropzone(f, f.accept || '*', true, '📎'),

    signature: f => wrap(f, `
      <canvas class="sig-pad" id="f_${f.id}" width="600" height="180"></canvas>
      <div class="flex justify-end mt-2">
        <button type="button" class="btn btn-ghost text-xs !py-1.5 !px-3" data-clear-sig="${f.id}">Clear signature</button>
      </div>`),
  };

  function renderDropzone(f, accept, multiple, icon) {
    return wrap(f, `
      <div class="dropzone" data-dropzone="${f.id}" tabindex="0" role="button" aria-label="Upload ${Utils.escapeHTML(f.label)}">
        <input type="file" class="hidden" id="f_${f.id}" accept="${accept}" ${multiple ? 'multiple' : ''}>
        <div class="text-2xl mb-1">${icon}</div>
        <p class="text-sm font-medium">Drop file${multiple ? 's' : ''} here or <span class="text-[var(--primary)] underline">browse</span></p>
        <p class="text-xs text-[var(--ink-soft)] mt-1">Max ${f.maxSizeMB || 10}MB ${multiple ? 'per file' : ''}</p>
      </div>
      <div class="flex flex-wrap gap-2 mt-2" data-file-list="${f.id}"></div>`);
  }

  function render(field) {
    const fn = renderers[field.type];
    if (!fn) return wrap(field, `<p class="text-sm text-[var(--danger)]">Unsupported field type: ${field.type}</p>`);
    return fn(field);
  }

  /** Wire up custom widget interactivity after the field is in the DOM */
  function attachBehavior(root, field, engine) {
    const el = root.querySelector(`[data-field-id="${field.id}"]`);
    if (!el) return;

    // Character counters
    const input = el.querySelector('input, textarea');
    const counter = el.querySelector(`[data-counter-for="${field.id}"]`);
    if (counter && input) {
      const update = () => { counter.textContent = `${input.value.length}/${field.maxLength}`; };
      input.addEventListener('input', update);
      update();
    }

    // Phone mask
    if (field.type === 'phone' && input) {
      input.addEventListener('input', () => { input.value = Utils.maskPhone(input.value); });
    }

    // Password show/hide
    const pwToggle = el.querySelector(`[data-toggle-pw="${field.id}"]`);
    if (pwToggle) {
      pwToggle.addEventListener('click', () => {
        input.type = input.type === 'password' ? 'text' : 'password';
      });
    }

    // Color swatch live label
    if (field.type === 'color') {
      const swatch = el.querySelector(`[data-color-value="${field.id}"]`);
      input.addEventListener('input', () => { swatch.textContent = input.value; });
    }

    // Range live label
    if (field.type === 'range') {
      const label = el.querySelector(`[data-range-value="${field.id}"]`);
      input.addEventListener('input', () => { label.textContent = input.value; });
    }

    // Rating stars
    if (field.type === 'rating') {
      const stars = el.querySelectorAll('.star');
      const hidden = el.querySelector(`#f_${field.id}`);
      const paint = n => stars.forEach(s => s.classList.toggle('filled', +s.dataset.star <= n));
      stars.forEach(s => {
        s.addEventListener('click', () => { hidden.value = s.dataset.star; paint(+s.dataset.star); engine.clearError(field.id); engine.onFieldChange(); });
        s.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); s.click(); } });
      });
    }

    // Toggle switch
    if (field.type === 'toggle') {
      const box = el.querySelector(`[data-toggle="${field.id}"]`);
      const hidden = el.querySelector(`#f_${field.id}`);
      const label = el.querySelector(`[data-toggle-label="${field.id}"]`);
      const set = on => {
        box.classList.toggle('on', on);
        box.setAttribute('aria-checked', on);
        hidden.value = on;
        label.textContent = on ? 'On' : 'Off';
      };
      box.addEventListener('click', () => { set(!box.classList.contains('on')); engine.onFieldChange(); });
      box.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); box.click(); } });
    }

    // Multiselect chips
    if (field.type === 'multiselect') {
      const container = el.querySelector(`[data-multiselect="${field.id}"]`);
      const hidden = el.querySelector(`#f_${field.id}`);
      const initial = hidden && hidden.value ? JSON.parse(hidden.value) : [];
      const selected = new Set(initial);
      container.querySelectorAll('.chip').forEach(chip => {
        const v = chip.dataset.chipValue;
        if (selected.has(v)) chip.classList.add('bg-[var(--primary)]', 'text-white');
        chip.addEventListener('click', () => {
          if (selected.has(v)) { selected.delete(v); chip.classList.remove('bg-[var(--primary)]', 'text-white'); }
          else { selected.add(v); chip.classList.add('bg-[var(--primary)]', 'text-white'); }
          hidden.value = JSON.stringify([...selected]);
          engine.clearError(field.id);
          engine.onFieldChange();
        });
      });
    }

    // File dropzones
    if (['image', 'pdf', 'files'].includes(field.type)) {
      const zone = el.querySelector(`[data-dropzone="${field.id}"]`);
      const fileInput = el.querySelector(`#f_${field.id}`);
      const list = el.querySelector(`[data-file-list="${field.id}"]`);

      const handleFiles = (fl) => {
        const files = Array.from(fl);
        const maxBytes = (field.maxSizeMB || 10) * 1024 * 1024;
        const accepted = files.filter(fobj => {
          if (fobj.size > maxBytes) { Utils.toast(`"${fobj.name}" exceeds ${field.maxSizeMB || 10}MB limit`, 'error'); return false; }
          return true;
        });
        engine.setFiles(field.id, field.multiple ? accepted : accepted.slice(0, 1));
        list.innerHTML = accepted.map(fobj => `
          <span class="file-chip"><span>📎</span>${Utils.escapeHTML(fobj.name)} <span class="text-[var(--ink-soft)]">(${Utils.formatBytes(fobj.size)})</span></span>`).join('');
        engine.clearError(field.id);
        engine.onFieldChange();
      };

      zone.addEventListener('click', () => fileInput.click());
      zone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
      fileInput.addEventListener('change', () => handleFiles(fileInput.files));
      ['dragover', 'dragenter'].forEach(evt => zone.addEventListener(evt, e => { e.preventDefault(); zone.classList.add('drag'); }));
      ['dragleave', 'drop'].forEach(evt => zone.addEventListener(evt, e => { e.preventDefault(); zone.classList.remove('drag'); }));
      zone.addEventListener('drop', e => { if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); });
    }

    // Signature pad
    if (field.type === 'signature') {
      const canvas = el.querySelector(`#f_${field.id}`);
      const ctx = canvas.getContext('2d');
      const ratio = window.devicePixelRatio || 1;
      const resize = () => {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * ratio;
        canvas.height = rect.height * ratio;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--ink');
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
      };
      resize();
      let drawing = false, hasDrawn = false;
      const pos = e => {
        const rect = canvas.getBoundingClientRect();
        const t = e.touches ? e.touches[0] : e;
        return { x: t.clientX - rect.left, y: t.clientY - rect.top };
      };
      const start = e => { drawing = true; hasDrawn = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
      const move = e => { if (!drawing) return; e.preventDefault(); const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); };
      const end = () => { if (drawing) { drawing = false; engine.setSignature(field.id, canvas.toDataURL('image/png')); engine.clearError(field.id); engine.onFieldChange(); } };
      canvas.addEventListener('mousedown', start);
      canvas.addEventListener('mousemove', move);
      window.addEventListener('mouseup', end);
      canvas.addEventListener('touchstart', start, { passive: true });
      canvas.addEventListener('touchmove', move, { passive: false });
      canvas.addEventListener('touchend', end);

      const clearBtn = el.querySelector(`[data-clear-sig="${field.id}"]`);
      clearBtn.addEventListener('click', () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        hasDrawn = false;
        engine.setSignature(field.id, null);
      });
    }

    // Generic change listener for standard inputs (drives conditional logic + autosave)
    if (input && !['image', 'pdf', 'files', 'signature'].includes(field.type)) {
      input.addEventListener('input', () => engine.onFieldChange());
      input.addEventListener('blur', () => engine.validateField(field, true));
    }
    if (field.type === 'radio' || field.type === 'checkbox') {
      el.querySelectorAll('input').forEach(i => i.addEventListener('change', () => { engine.onFieldChange(); engine.validateField(field, true); }));
    }
  }

  return { render, attachBehavior };
})();
