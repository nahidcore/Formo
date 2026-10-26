/* ==========================================================================
   FormCraft — Theme Controller (Dark / Light)
   ========================================================================== */

const ThemeController = (() => {
  const STORAGE_KEY = 'formcraft:theme';

  function readSavedTheme() {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return ''; }
  }

  function apply(theme) {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    const btns = document.querySelectorAll('[data-theme-toggle]');
    btns.forEach(b => b.setAttribute('aria-pressed', theme === 'dark'));
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* Theme still applies for this page. */ }
  }

  function current() {
    const saved = readSavedTheme();
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function toggle() {
    const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
    apply(next);
  }

  function init() {
    apply(current());
    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
      btn.addEventListener('click', toggle);
    });
  }

  return { init, toggle, apply, current };
})();

document.addEventListener('DOMContentLoaded', ThemeController.init);
