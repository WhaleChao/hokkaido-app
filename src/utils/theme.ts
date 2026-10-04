import { lsGet, lsSet } from './safeStorage';

export type ThemeChoice = 'auto' | 'light' | 'dark';
const KEY = 'hokkaido_theme';

export function readTheme(): ThemeChoice {
    const v = lsGet(KEY);
    return v === 'light' || v === 'dark' ? v : 'auto';
}

export function applyTheme(choice: ThemeChoice): void {
    const root = document.documentElement;
    if (choice === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', choice);
    // 同步瀏覽器網址列顏色
    const dark = choice === 'dark' || (choice === 'auto' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? '#0d1722' : '#f6f2ea'));
}

export function setTheme(choice: ThemeChoice): void {
    lsSet(KEY, choice);
    applyTheme(choice);
}
