import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Node 25 內建的 localStorage 是個空殼（沒有 clear 等方法），會蓋掉 jsdom 的；測試統一改用記憶體版本。
class MemoryStorage implements Storage {
    private m = new Map<string, string>();
    get length() {
        return this.m.size;
    }
    clear() {
        this.m.clear();
    }
    getItem(k: string) {
        return this.m.has(k) ? (this.m.get(k) as string) : null;
    }
    key(i: number) {
        return [...this.m.keys()][i] ?? null;
    }
    removeItem(k: string) {
        this.m.delete(k);
    }
    setItem(k: string, v: string) {
        this.m.set(k, String(v));
    }
}
for (const target of [globalThis, window] as object[]) {
    Object.defineProperty(target, 'localStorage', { value: new MemoryStorage(), configurable: true, writable: true });
}

afterEach(() => {
    cleanup();
});

// jsdom 沒有 matchMedia / scrollTo
if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(), onchange: null }),
    });
}
