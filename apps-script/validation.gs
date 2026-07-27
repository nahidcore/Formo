/**
 * FormCraft — Google Apps Script Backend
 * validation.gs — server-side security: sanitization, honeypot, rate limiting,
 * and admin token verification. Client-side validation is a UX convenience;
 * this file is the actual line of defense.
 */

const Validation = (() => {

  const RATE_LIMIT_MAX = 5;          // max submissions
  const RATE_LIMIT_WINDOW_SEC = 600; // per 10 minutes, per IP

  function checkHoneypot(value) {
    if (value && String(value).trim() !== '') {
      throw new Error('Spam detected.');
    }
  }

  function checkRateLimit(ip) {
    if (!ip || ip === 'unknown') return; // can't rate-limit without an identifier
    const cache = CacheService.getScriptCache();
    const key = 'rl_' + ip;
    const raw = cache.get(key);
    const count = raw ? parseInt(raw, 10) : 0;
    if (count >= RATE_LIMIT_MAX) {
      throw new Error('Too many submissions from your network. Please try again later.');
    }
    cache.put(key, String(count + 1), RATE_LIMIT_WINDOW_SEC);
  }

  /** Strip tags/scripts and trim; prevents stored-XSS from reaching the Sheet or admin UI. */
  function sanitizeString(str) {
    if (typeof str !== 'string') return str;
    return str
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/<\/?[a-z][^>]*>/gi, '')
      .replace(/javascript:/gi, '')
      .trim()
      .slice(0, 5000);
  }

  function sanitizeObject(obj) {
    const out = {};
    Object.keys(obj || {}).forEach(key => {
      const v = obj[key];
      if (Array.isArray(v)) out[key] = v.map(item => typeof item === 'string' ? sanitizeString(item) : item);
      else if (typeof v === 'string') out[key] = sanitizeString(v);
      else out[key] = v;
    });
    return out;
  }

  function verifyAdminToken(token) {
    const expected = PropertiesService.getScriptProperties().getProperty('ADMIN_TOKEN');
    if (!expected) throw new Error('Server misconfigured: ADMIN_TOKEN not set.');
    if (!token || token !== expected) throw new Error('Invalid admin token.');
  }

  return { checkHoneypot, checkRateLimit, sanitizeString, sanitizeObject, verifyAdminToken };
})();
