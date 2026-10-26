/* ==========================================================================
   FormCraft — Shared Utilities
   Pure helper functions used across index/admin pages.
   ========================================================================== */

const Utils = (() => {

  function getStorage() {
    try { return typeof window !== 'undefined' ? window.localStorage : null; }
    catch { return null; }
  }

  function storageGet(key) {
    try { return getStorage()?.getItem(key) ?? null; } catch { return null; }
  }

  function storageSet(key, value) {
    try { getStorage()?.setItem(key, value); return true; } catch { return false; }
  }

  function storageRemove(key) {
    try { getStorage()?.removeItem(key); } catch { /* Storage can be disabled by the browser. */ }
  }

  /** Escape HTML to prevent XSS when injecting user text into the DOM */
  function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Strip anything that looks like a script/tag injection from plain input */
  function sanitizeInput(str) {
    if (typeof str !== 'string') return str;
    return str
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .trim();
  }

  function debounce(fn, wait = 400) {
    let t;
    const debounced = (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
    debounced.cancel = () => { clearTimeout(t); t = undefined; };
    return debounced;
  }

  function getVisibleFieldIds(storage = getStorage()) {
    try {
      const raw = storage?.getItem('formcraft:visibleFields');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  function setVisibleFieldIds(fieldIds, storage = getStorage()) {
    try {
      if (fieldIds === null || fieldIds === undefined) storage?.removeItem('formcraft:visibleFields');
      else storage?.setItem('formcraft:visibleFields', JSON.stringify(fieldIds));
    } catch {}
  }

  function getFeatureFlags(storage = getStorage()) {
    const defaults = { drafts: true, reset: true, progress: true, submitLabel: true, intro: true };
    try {
      const raw = storage?.getItem('formcraft:featureFlags');
      if (!raw) return defaults;
      const parsed = JSON.parse(raw);
      return { ...defaults, ...(parsed || {}) };
    } catch {
      return defaults;
    }
  }

  function setFeatureFlags(flags, storage = getStorage()) {
    try {
      storage?.setItem('formcraft:featureFlags', JSON.stringify(flags || {}));
    } catch {}
  }

  function getCustomFields(storage = getStorage()) {
    try {
      const raw = storage?.getItem('formcraft:customFields');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? normalizeCustomFields(parsed) : [];
    } catch {
      return [];
    }
  }

  function normalizeCustomFields(fields) {
    const allowedTypes = new Set(['text', 'email', 'phone', 'textarea', 'number', 'dropdown']);
    return fields.filter(field => field && typeof field === 'object'
      && /^[a-z][a-z0-9_]{0,63}$/.test(String(field.id || ''))
      && allowedTypes.has(field.type)
      && String(field.label || '').trim()
      && (field.type !== 'dropdown' || (Array.isArray(field.options) && field.options.length > 0)))
      .map(field => ({
        ...field,
        id: String(field.id),
        label: String(field.label).trim().slice(0, 100),
        stepTitle: String(field.stepTitle || 'About you').slice(0, 100),
        options: field.type === 'dropdown'
          ? field.options.map(option => String(option).trim().slice(0, 100)).filter(Boolean).slice(0, 30)
          : undefined,
        required: !!field.required,
      }))
      .filter(field => field.type !== 'dropdown' || field.options.length > 0);
  }

  function setCustomFields(fields, storage = getStorage()) {
    try {
      storage?.setItem('formcraft:customFields', JSON.stringify(normalizeCustomFields(Array.isArray(fields) ? fields : [])));
    } catch {}
  }

  function slugify(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  function getTopics(storage = getStorage()) {
    try {
      const raw = storage?.getItem('formcraft:topics');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function getTopicBySlug(slug, storage = getStorage()) {
    if (!slug) return null;
    return getTopics(storage).find(item => item.slug === slug) || null;
  }

  function setTopics(topics, storage = getStorage()) {
    try {
      storage?.setItem('formcraft:topics', JSON.stringify(topics || []));
    } catch {}
  }

  function getActiveTopicSlug(storage = getStorage()) {
    try {
      return storage?.getItem('formcraft:activeTopicSlug') || '';
    } catch {
      return '';
    }
  }

  function setActiveTopicSlug(slug, storage = getStorage()) {
    try {
      storage?.setItem('formcraft:activeTopicSlug', slug || '');
    } catch {}
  }

  /* ── Server-backed topic API helpers ──
   * These functions talk to the Apps Script endpoint.
   * FORM_SCHEMA.endpoint must be defined (loaded from schema.js).
   * localStorage is used only as a local cache for speed; the server is the source of truth.
   */

  function _endpoint() {
    return (typeof FORM_SCHEMA !== 'undefined' && FORM_SCHEMA.endpoint) || '';
  }

  async function fetchTopicsFromServer() {
    const ep = _endpoint();
    if (!ep) return null;
    try {
      const res = await fetch(`${ep}?action=getTopics`);
      if (!res.ok) return null;
      const data = await res.json();
      if (data.status === 'ok' && Array.isArray(data.topics)) {
        // update local cache
        setTopics(data.topics);
        return data.topics;
      }
      return null;
    } catch {
      return null;
    }
  }

  async function saveTopicsToServer(topics, adminToken) {
    const ep = _endpoint();
    if (!ep) throw new Error('No endpoint configured.');
    const res = await fetch(ep, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'setTopics', token: adminToken, topics }),
    });
    if (!res.ok) throw new Error(`Server request failed (${res.status}).`);
    const data = await res.json();
    if (data.status !== 'ok') throw new Error(data.message || 'Server error saving topics.');
    setTopics(data.topics || topics);
    return data.topics || topics;
  }

  async function deleteTopicFromServer(slug, adminToken) {
    const ep = _endpoint();
    if (!ep) throw new Error('No endpoint configured.');
    const res = await fetch(ep, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'deleteTopic', token: adminToken, slug }),
    });
    if (!res.ok) throw new Error(`Server request failed (${res.status}).`);
    const data = await res.json();
    if (data.status !== 'ok') throw new Error(data.message || 'Server error deleting topic.');
    const next = data.topics || getTopics().filter(t => t.slug !== slug);
    setTopics(next);
    return next;
  }

  function getSharedConfig(storage = getStorage()) {
    return {
      visibleFieldIds: getVisibleFieldIds(storage),
      customFields: getCustomFields(storage),
      featureFlags: getFeatureFlags(storage),
      activeTopicSlug: getActiveTopicSlug(storage),
    };
  }

  function applySharedConfig(config, storage = getStorage()) {
    if (!config || typeof config !== 'object') return;
    setVisibleFieldIds(Array.isArray(config.visibleFieldIds) ? config.visibleFieldIds : null, storage);
    setCustomFields(Array.isArray(config.customFields) ? config.customFields : [], storage);
    setFeatureFlags(config.featureFlags && typeof config.featureFlags === 'object' ? config.featureFlags : {}, storage);
    setActiveTopicSlug(config.activeTopicSlug || '', storage);
  }

  async function fetchConfigFromServer() {
    const ep = _endpoint();
    if (!ep) return null;
    try {
      const res = await fetch(`${ep}?action=getConfig`);
      if (!res.ok) return null;
      const data = await res.json();
      if (data.status !== 'ok' || !data.config) return null;
      if (data.config.configured !== false) applySharedConfig(data.config);
      return data.config;
    } catch { return null; }
  }

  async function saveConfigToServer(config, adminToken) {
    const ep = _endpoint();
    if (!ep) throw new Error('No endpoint configured.');
    const res = await fetch(ep, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'setConfig', token: adminToken, config }),
    });
    if (!res.ok) throw new Error(`Server request failed (${res.status}).`);
    const data = await res.json();
    if (data.status !== 'ok' || !data.config) throw new Error(data.message || 'Server error saving settings.');
    applySharedConfig(data.config);
    return data.config;
  }

  function buildVisibleSchema(schema, storage = getStorage()) {
    const visibleIds = getVisibleFieldIds(storage);
    const visibleSet = new Set(visibleIds || []);
    const isVisible = field => visibleIds === null || visibleIds === undefined || visibleSet.has(field.id);
    const customFields = getCustomFields(storage);
    const steps = (schema.steps || []).map(step => {
      const baseFields = (step.fields || []).filter(isVisible);
      const customStepFields = customFields.filter(field => field.stepTitle === step.title && isVisible(field));
      return {
        ...step,
        fields: [...baseFields, ...customStepFields],
      };
    }).filter(step => (step.fields || []).length > 0);
    return { ...schema, steps };
  }

  function isFeatureEnabled(name, storage = getStorage()) {
    return !!getFeatureFlags(storage)[name];
  }

  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /** Validators — each returns true/false */
  const validators = {
    required: v => Array.isArray(v) ? v.length > 0 : (v !== undefined && v !== null && String(v).trim() !== ''),
    email: v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    url: v => !v || /^(https?:\/\/)[^\s]+\.[^\s]{2,}/i.test(v),
    phone: v => {
      if (!v) return true;
      const digits = String(v).replace(/\D/g, '');
      if (!digits) return false;
      return /^(?:0?1[3-9]\d{8}|8801[3-9]\d{8})$/.test(digits);
    },
    number: v => !v || !isNaN(Number(v)),
    minLength: (v, n) => !v || String(v).length >= n,
    maxLength: (v, n) => !v || String(v).length <= n,
    min: (v, n) => v === '' || v === null || v === undefined || Number(v) >= n,
    max: (v, n) => v === '' || v === null || v === undefined || Number(v) <= n,
    pattern: (v, re) => !v || new RegExp(re).test(v),
  };

  /** Apply a lightweight input mask for Bangladesh phone numbers */
  function maskPhone(value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';
    const normalized = digits.startsWith('880') ? digits.slice(3) : digits.replace(/^0/, '');
    if (!normalized) return '';
    if (normalized.length <= 4) return `+880 ${normalized}`;
    if (normalized.length <= 6) return `+880 ${normalized.slice(0, 4)}-${normalized.slice(4)}`;
    return `+880 ${normalized.slice(0, 4)}-${normalized.slice(4, 10)}`;
  }

  /** Toast notifications */
  function toast(message, type = 'info', duration = 3600) {
    const wrap = document.getElementById('toast-root') || (() => {
      const d = document.createElement('div');
      d.id = 'toast-root';
      document.body.appendChild(d);
      return d;
    })();
    const icons = {
      success: '<svg width="18" height="18" fill="none" stroke="var(--success)" stroke-width="2" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>',
      error: '<svg width="18" height="18" fill="none" stroke="var(--danger)" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
      info: '<svg width="18" height="18" fill="none" stroke="var(--primary)" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></svg>',
    };
    const el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.innerHTML = `${icons[type] || icons.info}<span>${escapeHTML(message)}</span>`;
    wrap.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .3s ease, transform .3s ease';
      el.style.opacity = '0';
      el.style.transform = 'translateY(10px)';
      setTimeout(() => el.remove(), 300);
    }, duration);
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  function formatDate(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  }

  return {
    escapeHTML,
    sanitizeInput,
    debounce,
    storageGet,
    storageSet,
    storageRemove,
    getVisibleFieldIds,
    setVisibleFieldIds,
    buildVisibleSchema,
    getCustomFields,
    setCustomFields,
    slugify,
    getTopics,
    getTopicBySlug,
    setTopics,
    getActiveTopicSlug,
    setActiveTopicSlug,
    // Server-backed topic API
    fetchTopicsFromServer,
    saveTopicsToServer,
    deleteTopicFromServer,
    getSharedConfig,
    applySharedConfig,
    fetchConfigFromServer,
    saveConfigToServer,
    getFeatureFlags,
    setFeatureFlags,
    isFeatureEnabled,
    uuid,
    validators,
    maskPhone,
    toast,
    fileToBase64,
    formatBytes,
    formatDate
  };
})();
