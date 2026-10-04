// 日期工具：行程日期一律視為「沒有時區的日曆日期」（YYYY-MM-DD）。
// 全部用 UTC 做加減，避免台灣（UTC+8）、日本（UTC+9）或夏令時間造成差一天。

export const MAX_TRIP_DAYS = 60;

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface DateParts {
    y: number;
    m: number;
    d: number;
}

export function parseISODate(s: unknown): DateParts | null {
    if (typeof s !== 'string') return null;
    const m = ISO_RE.exec(s.trim());
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const t = new Date(Date.UTC(y, mo - 1, d));
    if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;
    return { y, m: mo, d };
}

export function isValidISODate(s: unknown): s is string {
    return parseISODate(s) !== null;
}

function pad(n: number): string {
    return String(n).padStart(2, '0');
}

export function toISO(p: DateParts): string {
    return `${String(p.y).padStart(4, '0')}-${pad(p.m)}-${pad(p.d)}`;
}

/** 以裝置當地時間回傳今天（不是 UTC），在日本用手機就是日本的今天。 */
export function todayISO(now: Date = new Date()): string {
    return toISO({ y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() });
}

export function addDaysISO(iso: string, n: number): string | null {
    const p = parseISODate(iso);
    if (!p) return null;
    const t = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
    return toISO({ y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() });
}

export function diffDaysISO(a: string, b: string): number | null {
    const pa = parseISODate(a);
    const pb = parseISODate(b);
    if (!pa || !pb) return null;
    return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86400000);
}

/** 行程天數（含頭尾）。日期無效或結束早於開始時回傳 null。 */
export function tripDayCount(start: unknown, end: unknown): number | null {
    if (!isValidISODate(start) || !isValidISODate(end)) return null;
    const diff = diffDaysISO(start, end);
    if (diff === null || diff < 0) return null;
    return diff + 1;
}

export function formatMD(iso: string): string {
    const p = parseISODate(iso);
    return p ? `${p.m}/${p.d}` : '';
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export function weekdayZh(iso: string): string {
    const p = parseISODate(iso);
    if (!p) return '';
    return WEEKDAYS[new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()];
}

/** 舊版建立每日資料時使用的標籤格式，維持不變以免舊資料不一致。 */
export function legacyDayLabel(iso: string): string {
    const p = parseISODate(iso);
    return p ? `${p.m}月${p.d}日` : '';
}

/** 建立或修改行程日期時的檢查；有問題回傳白話的錯誤訊息，沒問題回傳 null。 */
export function validateTripDates(start: string, end: string, maxDays = MAX_TRIP_DAYS): string | null {
    if (!isValidISODate(start) || !isValidISODate(end)) return '請選擇出發日與結束日';
    const n = tripDayCount(start, end);
    if (n === null) return '結束日不能早於出發日';
    if (n > maxDays) return `旅程最長 ${maxDays} 天，請縮短日期區間`;
    return null;
}

/** 完整日期的統一顯示格式：2026/02/10（全 App 一致）。 */
export function formatYMD(iso: string): string {
    const p = parseISODate(iso);
    return p ? `${p.y}/${pad(p.m)}/${pad(p.d)}` : '';
}

/**
 * 寬鬆解析使用者打的日期：2026/2/10、2026-02-10、2026.2.10、2026年2月10日、20260210，
 * 全形數字也可。解析不出（含不存在的日期）回傳 null。
 */
export function parseLooseDate(input: string): string | null {
    const s = input
        .trim()
        .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
        .replace(/[／－.。]/g, '/')
        .replace(/[年月]/g, '/')
        .replace(/日/g, '')
        .replace(/-/g, '/')
        .replace(/\s+/g, '');
    const sep = /^(\d{4})\/(\d{1,2})\/(\d{1,2})\/?$/.exec(s);
    const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
    const hit = sep ?? compact;
    if (!hit) return null;
    const iso = toISO({ y: Number(hit[1]), m: Number(hit[2]), d: Number(hit[3]) });
    return parseISODate(iso) ? iso : null;
}
