import { describe, it, expect, beforeEach } from 'vitest';
import { buildAdvice, weatherKind, geocodeCandidates, fetchWeather, pickDay } from './weather';
import { jsonResponse } from '../test/helpers';

beforeEach(() => localStorage.clear());

const geoOk = { results: [{ latitude: 43.06, longitude: 141.35 }] };
const daily = (date: string) => ({
    daily: { time: [date], weather_code: [73], temperature_2m_max: [-1.4], temperature_2m_min: [-6.2] },
});

function router(map: Record<string, () => Response>): typeof fetch {
    return (async (url: RequestInfo | URL) => {
        const u = String(url);
        for (const [k, v] of Object.entries(map)) if (u.includes(k)) return v();
        throw new Error('unexpected ' + u);
    }) as typeof fetch;
}

describe('天氣', () => {
    it('依溫度與天氣代碼給穿著建議', () => {
        expect(buildAdvice(-6, -1, 73)).toMatch(/零度.*降雪|降雪/s);
        expect(buildAdvice(2, 8, 61)).toMatch(/帶傘/);
        expect(buildAdvice(20, 30, 0)).toMatch(/炎熱/);
        expect(weatherKind(95)).toBe('storm');
        expect(weatherKind(85)).toBe('snow');
        expect(weatherKind(81)).toBe('rain');
    });

    it('地點「Kyoto, Japan」查不到時改查逗號前的第一段', () => {
        expect(geocodeCandidates('Kyoto, Japan')).toEqual(['Kyoto, Japan', 'Kyoto']);
        expect(geocodeCandidates('札幌')).toEqual(['札幌']);
        expect(geocodeCandidates('  ')).toEqual([]);
    });

    it('正常取得：四捨五入、判斷下雪', async () => {
        const f = router({ 'geocoding-api': () => jsonResponse(geoOk), 'api.open-meteo.com': () => jsonResponse(daily('2026-02-10')) });
        const r = await fetchWeather('Sapporo, Japan', '2026-02-10', { fetchImpl: f });
        expect(r.state).toBe('ok');
        if (r.state === 'ok') {
            expect(r.data.maxTemp).toBe(-1);
            expect(r.data.minTemp).toBe(-6);
            expect(r.data.kind).toBe('snow');
            expect(r.stale).toBe(false);
        }
    });

    it('不在預報範圍、尚未設定地點、查無地點，各有明確狀態', async () => {
        const f = router({ 'geocoding-api': () => jsonResponse(geoOk), 'api.open-meteo.com': () => jsonResponse(daily('2026-02-10')) });
        expect((await fetchWeather('Sapporo', '2027-01-01', { fetchImpl: f })).state).toBe('out-of-range');
        expect((await fetchWeather('', '2026-02-10', { fetchImpl: f })).state).toBe('no-location');
        expect((await fetchWeather('設定地點', '2026-02-10', { fetchImpl: f })).state).toBe('no-location');
        const none = router({ 'geocoding-api': () => jsonResponse({}) });
        expect((await fetchWeather('Nowhereville', '2026-02-10', { fetchImpl: none })).state).toBe('location-not-found');
    });

    it('服務壞掉：回報錯誤而不是假裝沒事；離線則標示離線', async () => {
        const bad = router({ 'geocoding-api': () => jsonResponse(geoOk), 'api.open-meteo.com': () => jsonResponse({}, { ok: false, status: 500 }) });
        const r = await fetchWeather('Sapporo', '2026-02-10', { fetchImpl: bad, online: true });
        expect(r.state).toBe('error');
        const off = await fetchWeather('Tokyo', '2026-02-10', {
            fetchImpl: (async () => {
                throw new TypeError('Failed to fetch');
            }) as typeof fetch,
            online: false,
        });
        expect(off.state).toBe('offline');
    });

    it('離線時使用先前存下的預報並標示「過期」', async () => {
        const ok = router({ 'geocoding-api': () => jsonResponse(geoOk), 'api.open-meteo.com': () => jsonResponse(daily('2026-02-10')) });
        await fetchWeather('Sapporo', '2026-02-10', { fetchImpl: ok, now: 1_000 });
        const down = (async () => {
            throw new TypeError('offline');
        }) as typeof fetch;
        const r = await fetchWeather('Sapporo', '2026-02-10', { fetchImpl: down, now: 1_000 + 24 * 3600 * 1000, online: false });
        expect(r.state).toBe('ok');
        if (r.state === 'ok') expect(r.stale).toBe(true);
    });

    it('pickDay 遇到缺值回傳 null', () => {
        expect(pickDay({ time: ['2026-02-10'], weather_code: [1], temperature_2m_max: [Number.NaN], temperature_2m_min: [0] }, '2026-02-10')).toBeNull();
    });
});
