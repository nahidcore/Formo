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
    phone: v => !v || /^\+?[0-9\s\-()]{7,18}$/.test(v),
    number: v => !v || !isNaN(Number(v)),
    minLength: (v, n) => !v || String(v).length >= n,
    maxLength: (v, n) => !v || String(v).length <= n,
    min: (v, n) => v === '' || v === null || v === undefined || Number(v) >= n,
    max: (v, n) => v === '' || v === null || v === undefined || Number(v) <= n,
    pattern: (v, re) => !v || new RegExp(re).test(v),
  };

  /** Apply a lightweight input mask for phone numbers: (123) 456-7890 */
  function maskPhone(value) {
    const digits = value.replace(/\D/g, '').slice(0, 10);
    const len = digits.length;
    if (len === 0) return '';
    if (len < 4) return `(${digits}`;
    if (len < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
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

  return { escapeHTML, sanitizeInput, debounce, uuid, validators, maskPhone, toast, fileToBase64, formatBytes, formatDate };
})();
