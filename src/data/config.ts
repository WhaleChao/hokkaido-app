import { addDaysISO, todayISO } from '../utils/date';

export interface Accommodation {
    id: string;
    name: string;
    address: string;
    url: string;
    checkIn?: string;
    checkOut?: string;
}

export interface AppConfig {
    tripName: string;
    location: string;
    startDate: string;
    endDate: string;
    accommodationAddress: string; // 舊版欄位，保留讀取相容
    accommodations?: Accommodation[];
    travelers?: number;
    baseCurrency?: string;
    tripCurrency?: string;
    defaultRegion?: string;
}

export const LOCATION_PLACEHOLDER = '設定地點';

export function defaultConfig(now: Date = new Date()): AppConfig {
    const start = todayISO(now);
    return {
        tripName: '我的日本自由行',
        location: 'Tokyo, Japan',
        startDate: start,
        endDate: addDaysISO(start, 3) ?? start,
        accommodationAddress: '',
        accommodations: [],
        travelers: 1,
        baseCurrency: 'TWD',
        tripCurrency: 'JPY',
        defaultRegion: '',
    };
}

function str(v: unknown, fallback = ''): string {
    return typeof v === 'string' ? v : fallback;
}

function currencyCode(v: unknown, fallback: string): string {
    return typeof v === 'string' && /^[A-Za-z]{3}$/.test(v) ? v.toUpperCase() : fallback;
}

/** 讀出來的設定可能缺欄位或型別錯誤（舊版、匯入、手動改過），一律補成安全的值。 */
export function normalizeConfig(raw: unknown, fallback: AppConfig = defaultConfig()): AppConfig {
    if (!raw || typeof raw !== 'object') return fallback;
    const r = raw as Record<string, unknown>;

    let accommodations: Accommodation[] = [];
    if (Array.isArray(r.accommodations)) {
        accommodations = r.accommodations
            .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object')
            .map((a, i) => ({
                id: str(a.id) || `acc-${i + 1}`,
                name: str(a.name),
                address: str(a.address),
                url: str(a.url),
                checkIn: typeof a.checkIn === 'string' && a.checkIn ? a.checkIn : undefined,
                checkOut: typeof a.checkOut === 'string' && a.checkOut ? a.checkOut : undefined,
            }));
    } else if (str(r.accommodationAddress)) {
        // 舊版（V1）只有單一住宿地址：轉成清單，id 固定以免每次載入都變
        accommodations = [{ id: 'legacy-acc', name: '預設住宿', address: str(r.accommodationAddress), url: '' }];
    }

    const travelersRaw = Number(r.travelers);
    const travelers = Number.isFinite(travelersRaw) && travelersRaw >= 1 ? Math.min(99, Math.floor(travelersRaw)) : 1;

    return {
        tripName: str(r.tripName, fallback.tripName),
        location: str(r.location, fallback.location),
        startDate: str(r.startDate, fallback.startDate),
        endDate: str(r.endDate, fallback.endDate),
        accommodationAddress: str(r.accommodationAddress),
        accommodations,
        travelers,
        baseCurrency: currencyCode(r.baseCurrency, 'TWD'),
        tripCurrency: currencyCode(r.tripCurrency, 'JPY'),
        defaultRegion: str(r.defaultRegion),
    };
}

/** 顯示用地點：尚未設定時回傳空字串。 */
export function visibleLocation(location: string): string {
    const t = location.trim();
    return t === LOCATION_PLACEHOLDER ? '' : t;
}
