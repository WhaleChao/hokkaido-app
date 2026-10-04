import { lsGetJSON, lsSetJSON } from './safeStorage';

export type WeatherKind = 'clear' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm';

export interface WeatherData {
    minTemp: number;
    maxTemp: number;
    weatherCode: number;
    kind: WeatherKind;
    advice: string;
}

export type WeatherStatus =
    | { state: 'ok'; data: WeatherData; stale: boolean; fetchedAt: number }
    | { state: 'no-location' }
    | { state: 'location-not-found' }
    | { state: 'out-of-range' }
    | { state: 'offline' }
    | { state: 'error'; message: string };

interface DailyForecast {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
}

interface ForecastCache {
    fetchedAt: number;
    daily: DailyForecast;
}

export const FORECAST_TTL_MS = 3 * 60 * 60 * 1000;
const GEO_KEY = 'hokkaido_geo_cache_v1';
const FORECAST_KEY_PREFIX = 'hokkaido_forecast_v1_';

export function weatherKind(code: number): WeatherKind {
    if (code >= 95) return 'storm';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
    if (code === 45 || code === 48) return 'fog';
    if (code === 2 || code === 3) return 'cloudy';
    return 'clear';
}

export function buildAdvice(min: number, max: number, code: number): string {
    let advice: string;
    if (min <= 0) advice = '氣溫在零度上下，請穿發熱衣、厚毛衣與羽絨外套，並帶帽子、圍巾和防水手套。';
    else if (max <= 10) advice = '天氣很冷，建議洋蔥式穿搭：發熱衣、保暖中層、防風大衣。';
    else if (max <= 18) advice = '天氣偏涼，長袖加薄外套或風衣，早晚溫差大。';
    else if (max <= 25) advice = '天氣舒適，短袖或薄長袖即可，帶一件薄外套備用。';
    else advice = '天氣炎熱，穿透氣的衣物，注意防曬並多補充水分。';

    const kind = weatherKind(code);
    if (kind === 'rain') advice += ' 預報有雨，請帶傘或輕便雨衣。';
    else if (kind === 'snow') advice += ' 預報有降雪，走路請穿防滑雪靴；自駕務必確認車輛有雪胎。';
    else if (kind === 'storm') advice += ' 預報有雷雨，戶外行程請留意天氣變化。';
    return advice;
}

/** 地點名稱整理：「Kyoto, Japan」查不到時改查逗號前的第一段。 */
export function geocodeCandidates(location: string): string[] {
    const full = location.trim();
    if (!full) return [];
    const first = full.split(/[,，、/]/)[0].trim();
    return first && first !== full ? [full, first] : [full];
}

type GeoCache = Record<string, { lat: number; lon: number }>;

async function geocode(name: string, fetchImpl: typeof fetch): Promise<{ lat: number; lon: number } | null> {
    const cache = lsGetJSON<GeoCache>(GEO_KEY) ?? {};
    const key = name.toLowerCase();
    if (cache[key]) return cache[key];
    for (const candidate of geocodeCandidates(name)) {
        const res = await fetchImpl(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(candidate)}&count=1&language=en&format=json`,
        );
        if (!res.ok) throw new Error(`地點查詢服務回應異常（${res.status}）`);
        const json = (await res.json()) as { results?: { latitude: number; longitude: number }[] };
        const hit = json.results?.[0];
        if (hit && Number.isFinite(hit.latitude) && Number.isFinite(hit.longitude)) {
            const coords = { lat: hit.latitude, lon: hit.longitude };
            lsSetJSON(GEO_KEY, { ...cache, [key]: coords });
            return coords;
        }
    }
    return null;
}

function validDaily(d: unknown): d is DailyForecast {
    if (!d || typeof d !== 'object') return false;
    const x = d as Record<string, unknown>;
    return (
        Array.isArray(x.time) &&
        Array.isArray(x.weather_code) &&
        Array.isArray(x.temperature_2m_max) &&
        Array.isArray(x.temperature_2m_min) &&
        x.time.length === x.weather_code.length
    );
}

export function pickDay(daily: DailyForecast, dateISO: string): WeatherData | null {
    const i = daily.time.indexOf(dateISO);
    if (i < 0) return null;
    const max = daily.temperature_2m_max[i];
    const min = daily.temperature_2m_min[i];
    const code = daily.weather_code[i];
    if (![max, min, code].every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
    const mn = Math.round(min);
    const mx = Math.round(max);
    return { minTemp: mn, maxTemp: mx, weatherCode: code, kind: weatherKind(code), advice: buildAdvice(mn, mx, code) };
}

const inflight = new Map<string, Promise<ForecastCache>>();

async function loadForecast(lat: number, lon: number, fetchImpl: typeof fetch, now: number): Promise<{ cache: ForecastCache; stale: boolean }> {
    const key = `${FORECAST_KEY_PREFIX}${lat.toFixed(2)}_${lon.toFixed(2)}`;
    const cached = lsGetJSON<ForecastCache>(key);
    const usable = cached && validDaily(cached.daily) ? cached : null;
    if (usable && now - usable.fetchedAt < FORECAST_TTL_MS) return { cache: usable, stale: false };

    try {
        let p = inflight.get(key);
        if (!p) {
            p = (async () => {
                const res = await fetchImpl(
                    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=16&timezone=auto`,
                );
                if (!res.ok) throw new Error(`天氣服務回應異常（${res.status}）`);
                const json = (await res.json()) as { daily?: unknown };
                if (!validDaily(json.daily)) throw new Error('天氣服務回傳的資料格式不正確');
                const fresh: ForecastCache = { fetchedAt: now, daily: json.daily };
                lsSetJSON(key, fresh);
                return fresh;
            })().finally(() => inflight.delete(key));
            inflight.set(key, p);
        }
        return { cache: await p, stale: false };
    } catch (e) {
        if (usable) return { cache: usable, stale: true };
        throw e;
    }
}

export async function fetchWeather(
    location: string,
    dateISO: string,
    opts: { fetchImpl?: typeof fetch; now?: number; online?: boolean } = {},
): Promise<WeatherStatus> {
    const fetchImpl = opts.fetchImpl ?? fetch;
    const now = opts.now ?? Date.now();
    if (!location.trim() || location.trim() === '設定地點') return { state: 'no-location' };
    try {
        const coords = await geocode(location, fetchImpl);
        if (!coords) return { state: 'location-not-found' };
        const { cache, stale } = await loadForecast(coords.lat, coords.lon, fetchImpl, now);
        const data = pickDay(cache.daily, dateISO);
        if (!data) return { state: 'out-of-range' };
        return { state: 'ok', data, stale, fetchedAt: cache.fetchedAt };
    } catch (e) {
        if (opts.online === false || (typeof navigator !== 'undefined' && navigator.onLine === false)) return { state: 'offline' };
        return { state: 'error', message: e instanceof Error ? e.message : '無法取得天氣資料' };
    }
}
