import { describe, it, expect, beforeEach } from 'vitest';
import { loadRates, convertAmount, validateRates, RATES_CACHE_KEY, RATES_MAX_AGE_MS } from './rates';
import { jsonResponse } from '../test/helpers';

const good = { rates: { USD: 1, JPY: 150, TWD: 30, EUR: 0.9, KRW: 1300, THB: 35 } };

beforeEach(() => localStorage.clear());

describe('匯率', () => {
    it('成功取得後寫入快取（沿用舊版快取鍵與格式）', async () => {
        const r = await loadRates({ fetchImpl: async () => jsonResponse(good) });
        expect(r.status).toBe('live');
        const stored = JSON.parse(localStorage.getItem(RATES_CACHE_KEY)!);
        expect(stored.rates.JPY).toBe(150);
        expect(typeof stored.timestamp).toBe('number');
    });

    it('讀得到舊版寫入的快取', async () => {
        localStorage.setItem(RATES_CACHE_KEY, JSON.stringify({ rates: good.rates, timestamp: Date.now() }));
        let called = 0;
        const r = await loadRates({
            fetchImpl: async () => {
                called++;
                return jsonResponse(good);
            },
        });
        expect(r.status).toBe('fresh-cache');
        expect(called).toBe(0);
    });

    it('服務失敗且沒有快取：回報不可用，不用寫死的假匯率', async () => {
        const r = await loadRates({ fetchImpl: async () => jsonResponse({}, { ok: false, status: 503 }) });
        expect(r.status).toBe('unavailable');
        expect(r.snapshot).toBeNull();
        expect(r.error).toMatch(/503/);
    });

    it('網路例外且有過期快取：退回舊匯率並標示過期', async () => {
        const old = Date.now() - RATES_MAX_AGE_MS - 1000;
        localStorage.setItem(RATES_CACHE_KEY, JSON.stringify({ rates: good.rates, timestamp: old }));
        const r = await loadRates({
            fetchImpl: async () => {
                throw new TypeError('Failed to fetch');
            },
        });
        expect(r.status).toBe('stale-cache');
        expect(r.snapshot?.fetchedAt).toBe(old);
    });

    it('服務回傳壞資料（缺幣別、非數字、負數）會被拒絕', async () => {
        expect(validateRates({ rates: { USD: 1, JPY: 'x' } })).toBeNull();
        expect(validateRates({ rates: { USD: 1, JPY: -3, TWD: 30, EUR: 1, KRW: 1, THB: 1 } })?.JPY).toBeUndefined();
        const r = await loadRates({ fetchImpl: async () => jsonResponse({ result: 'error' }) });
        expect(r.status).toBe('unavailable');
    });

    it('換算：同幣別免查、查不到回傳 null', () => {
        expect(convertAmount(100, 'JPY', 'JPY', null)).toBe(100);
        expect(convertAmount(100, 'JPY', 'TWD', null)).toBeNull();
        expect(convertAmount(100, 'JPY', 'XXX', good.rates)).toBeNull();
        expect(convertAmount(1500, 'JPY', 'TWD', good.rates)).toBeCloseTo(300);
    });
});
