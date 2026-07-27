/* ==========================================================================
   FormCraft — Shared Utilities
   Pure helper functions used across index/admin pages.
   ========================================================================== */

const Utils = (() => {

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
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  function getVisibleFieldIds(storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
    try {
      const raw = storage?.getItem('formcraft:visibleFields');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  function setVisibleFieldIds(fieldIds, storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
    try {
      storage?.setItem('formcraft:visibleFields', JSON.stringify(fieldIds || []));
    } catch {}
  }

  function buildVisibleSchema(schema, storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
    const visibleIds = getVisibleFieldIds(storage);
    const visibleSet = new Set(visibleIds || []);
    const steps = (schema.steps || []).map(step => ({
      ...step,
      fields: (step.fields || []).filter(field => visibleSet.size === 0 || visibleSet.has(field.id)),
    })).filter(step => (step.fields || []).length > 0);
    return { ...schema, steps };
  }

  function getFeatureFlags(storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
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

  function setFeatureFlags(flags, storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
    try {
      storage?.setItem('formcraft:featureFlags', JSON.stringify(flags || {}));
    } catch {}
  }

  function getCustomFields(storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
    try {
      const raw = storage?.getItem('formcraft:customFields');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function setCustomFields(fields, storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
    try {
      storage?.setItem('formcraft:customFields', JSON.stringify(fields || []));
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

  function getTopics(storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
    try {
      const raw = storage?.getItem('formcraft:topics');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function getTopicBySlug(slug, storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
    if (!slug) return null;
    return getTopics(storage).find(item => item.slug === slug) || null;
  }

  function setTopics(topics, storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
    try {
      storage?.setItem('formcraft:topics', JSON.stringify(topics || []));
    } catch {}
  }

  function getActiveTopicSlug(storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
    try {
      return storage?.getItem('formcraft:activeTopicSlug') || '';
    } catch {
      return '';
    }
  }

  function setActiveTopicSlug(slug, storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
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
    const data = await res.json();
    if (data.status !== 'ok') throw new Error(data.message || 'Server error saving topics.');
    setTopics(data.topics || topics); // update cache
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
    const data = await res.json();
    if (data.status !== 'ok') throw new Error(data.message || 'Server error deleting topic.');
    const next = data.topics || getTopics().filter(t => t.slug !== slug);
    setTopics(next); // update cache
    return next;
  }

  function buildVisibleSchema(schema, storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
    const visibleIds = getVisibleFieldIds(storage);
    const visibleSet = new Set(visibleIds || []);
    const customFields = getCustomFields(storage);
    const steps = (schema.steps || []).map(step => {
      const baseFields = (step.fields || []).filter(field => visibleSet.size === 0 || visibleSet.has(field.id));
      const customStepFields = customFields.filter(field => field.stepTitle === step.title && (visibleSet.size === 0 || visibleSet.has(field.id)));
      return {
        ...step,
        fields: [...baseFields, ...customStepFields],
      };
    }).filter(step => (step.fields || []).length > 0);
    return { ...schema, steps };
  }

  function isFeatureEnabled(name, storage = (typeof window !== 'undefined' ? window.localStorage : null)) {
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
      return /^01[3-9]\d{8}$/.test(digits) || /^8801[3-9]\d{8}$/.test(digits);
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
