// frontend/src/utils/theme.js

const THEME_KEY = 'ims-theme';

export function getStoredTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  return stored === 'light' ? 'light' : 'dark';
}

export function applyTheme(theme) {
  const value = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', value);
  localStorage.setItem(THEME_KEY, value);
  return value;
}

export function initTheme() {
  return applyTheme(getStoredTheme());
}

export function toggleTheme() {
  return applyTheme(getStoredTheme() === 'dark' ? 'light' : 'dark');
}
