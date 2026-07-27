/* ==========================================================================
   FormCraft — Theme Controller (Dark / Light)
   ========================================================================== */

const ThemeController = (() => {
  const STORAGE_KEY = 'formcraft:theme';

  function apply(theme) {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    const btns = document.querySelectorAll('[data-theme-toggle]');
    btns.forEach(b => b.setAttribute('aria-pressed', theme === 'dark'));
    localStorage.setItem(STORAGE_KEY, theme);
  }

  function current() {
    const saved = localStorage.getItem(STORAGE_KEY);
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
