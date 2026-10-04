// localStorage 在無痕模式、被封鎖或容量已滿時會丟例外；這裡統一包起來，
// 讀不到就回傳 null，寫入失敗回傳 false，呼叫端自己決定要不要提醒使用者。

export function lsGet(key: string): string | null {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

export function lsSet(key: string, value: string): boolean {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch {
        return false;
    }
}

export function lsGetJSON<T>(key: string): T | null {
    const raw = lsGet(key);
    if (raw === null) return null;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
}

export function lsSetJSON(key: string, value: unknown): boolean {
    try {
        return lsSet(key, JSON.stringify(value));
    } catch {
        return false;
    }
}
