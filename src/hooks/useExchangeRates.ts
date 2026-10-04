import { useState, useEffect, useCallback } from 'react';
import { loadRates, convertAmount, type RatesResult } from '../utils/rates';

// 全站共用同一份匯率與同一次請求，避免每個分頁各打一次 API。
let shared: Promise<RatesResult> | null = null;
const listeners = new Set<(r: RatesResult) => void>();
let last: RatesResult | null = null;

function fetchShared(force: boolean): Promise<RatesResult> {
    if (!force && shared) return shared;
    shared = loadRates({ force }).then((r) => {
        last = r;
        listeners.forEach((l) => l(r));
        return r;
    });
    return shared;
}

/** 測試用：清掉模組內快取 */
export function resetRatesForTests() {
    shared = null;
    last = null;
    listeners.clear();
}

export function useExchangeRates() {
    const [result, setResult] = useState<RatesResult | null>(last);
    const [loading, setLoading] = useState(last === null);

    useEffect(() => {
        const l = (r: RatesResult) => {
            setResult(r);
            setLoading(false);
        };
        listeners.add(l);
        void fetchShared(false);
        return () => {
            listeners.delete(l);
        };
    }, []);

    const refresh = useCallback(async () => {
        setLoading(true);
        await fetchShared(true);
    }, []);

    const rates = result?.snapshot?.rates ?? null;
    const convert = useCallback((amount: number, from: string, to: string) => convertAmount(amount, from, to, rates), [rates]);

    return {
        rates,
        fetchedAt: result?.snapshot?.fetchedAt ?? null,
        status: result?.status ?? 'unavailable',
        error: result?.error,
        loading,
        refresh,
        convert,
    };
}
