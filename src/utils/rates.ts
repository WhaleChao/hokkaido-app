import { lsGetJSON, lsSetJSON } from './safeStorage';

// 沿用舊版快取鍵與格式（{ rates, timestamp }），升級後既有快取仍可使用。
export const RATES_CACHE_KEY = 'hokkaido_exchange_rates';
export const RATES_MAX_AGE_MS = 12 * 60 * 60 * 1000;
export const RATES_URL = 'https://open.er-api.com/v6/latest/USD';

export interface RatesSnapshot {
    rates: Record<string, number>;
    fetchedAt: number;
}

export type RatesStatus = 'live' | 'fresh-cache' | 'stale-cache' | 'unavailable';

export interface RatesResult {
    snapshot: RatesSnapshot | null;
    status: RatesStatus;
    error?: string;
}

interface StoredCache {
    rates: Record<string, number>;
    timestamp: number;
}

export function validateRates(data: unknown): Record<string, number> | null {
    if (!data || typeof data !== 'object') return null;
    const rates = (data as { rates?: unknown }).rates;
    if (!rates || typeof rates !== 'object') return null;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(rates as Record<string, unknown>)) {
        if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[k] = v;
    }
    // 至少要有美元基準與幾個幣別，否則視為壞資料
    if (out.USD !== 1 && !(out.USD > 0)) return null;
    return Object.keys(out).length >= 5 ? out : null;
}

export function readCachedRates(): RatesSnapshot | null {
    const c = lsGetJSON<StoredCache>(RATES_CACHE_KEY);
    if (!c || typeof c.timestamp !== 'number') return null;
    const rates = validateRates({ rates: c.rates });
    return rates ? { rates, fetchedAt: c.timestamp } : null;
}

export async function fetchLiveRates(fetchImpl: typeof fetch = fetch): Promise<RatesSnapshot> {
    const res = await fetchImpl(RATES_URL);
    if (!res.ok) throw new Error(`匯率服務回應異常（${res.status}）`);
    const data: unknown = await res.json();
    const rates = validateRates(data);
    if (!rates) throw new Error('匯率服務回傳的資料格式不正確');
    return { rates, fetchedAt: Date.now() };
}

/**
 * 取得匯率：新鮮快取 → 即時抓取 → 失敗時退回過期快取（並標示過期）→ 都沒有就明確回報不可用。
 * 絕不使用寫死的假匯率。
 */
export async function loadRates(opts: { force?: boolean; fetchImpl?: typeof fetch; now?: number } = {}): Promise<RatesResult> {
    const now = opts.now ?? Date.now();
    const cached = readCachedRates();
    if (!opts.force && cached && now - cached.fetchedAt < RATES_MAX_AGE_MS) {
        return { snapshot: cached, status: 'fresh-cache' };
    }
    try {
        const snap = await fetchLiveRates(opts.fetchImpl);
        lsSetJSON(RATES_CACHE_KEY, { rates: snap.rates, timestamp: snap.fetchedAt } satisfies StoredCache);
        return { snapshot: snap, status: 'live' };
    } catch (e) {
        const message = e instanceof Error ? e.message : '無法連線到匯率服務';
        if (cached) return { snapshot: cached, status: 'stale-cache', error: message };
        return { snapshot: null, status: 'unavailable', error: message };
    }
}

/** 轉換金額。任一幣別查無匯率時回傳 null（不要假裝成功）。 */
export function convertAmount(amount: number, from: string, to: string, rates: Record<string, number> | null): number | null {
    if (from === to) return amount;
    if (!rates) return null;
    const rf = rates[from];
    const rt = rates[to];
    if (!rf || !rt) return null;
    return (amount / rf) * rt;
}
