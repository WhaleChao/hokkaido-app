// 金額工具：解析、格式化與四捨五入。不做匯率（匯率在 rates.ts）。

const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND', 'IDR', 'CLP', 'ISK', 'HUF', 'UGX']);

export function fractionDigits(currency: string): number {
    return ZERO_DECIMAL.has(currency.toUpperCase()) ? 0 : 2;
}

const SYMBOLS: Record<string, string> = {
    JPY: '¥',
    TWD: 'NT$',
    USD: 'US$',
    EUR: '€',
    KRW: '₩',
    THB: '฿',
    SGD: 'S$',
    HKD: 'HK$',
    MYR: 'RM',
    GBP: '£',
    CNY: 'CN¥',
    AUD: 'A$',
    VND: '₫',
};

/** 顯示用小數位數：日圓、韓元、越南盾沒有小數；新台幣習慣顯示整數；其餘兩位。 */
export function displayDigits(currency: string): number {
    const c = currency.toUpperCase();
    return ZERO_DECIMAL.has(c) || c === 'TWD' ? 0 : 2;
}

export function currencySymbol(currency: string): string {
    return SYMBOLS[currency.toUpperCase()] ?? `${currency} `;
}

export function roundTo(value: number, digits: number): number {
    const f = 10 ** digits;
    return Math.round((value + Number.EPSILON) * f) / f;
}

export function ceilTo(value: number, digits: number): number {
    const f = 10 ** digits;
    // 先四捨五入到 6 位，避免 0.1+0.2 這類浮點誤差讓 ceil 多進一位
    return Math.ceil(roundTo(value * f, 6)) / f;
}

export const MAX_AMOUNT = 1_000_000_000;

/**
 * 解析使用者輸入的金額。接受半形／全形數字、千分位逗號，最多兩位小數。
 * 無效、零、負數、過大都回傳 null（呼叫端要顯示錯誤，不可默默當成 0）。
 */
export function parseAmount(input: string, currency = 'JPY'): number | null {
    const s = input
        .trim()
        .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
        .replace(/[,，\s]/g, '')
        .replace('．', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
    const n = Number(s);
    if (!Number.isFinite(n) || n <= 0 || n >= MAX_AMOUNT) return null;
    const digits = fractionDigits(currency);
    // 日圓、韓元沒有小數：輸入帶小數視為無效，而不是無聲捨去
    if (digits === 0 && !Number.isInteger(n)) return null;
    return n;
}

export function formatMoney(amount: number, currency: string): string {
    const d = displayDigits(currency);
    return `${currencySymbol(currency)}${amount.toLocaleString('en-US', {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
    })}`;
}

export function sumAmounts(values: number[], currency: string): number {
    return roundTo(
        values.reduce((a, b) => a + b, 0),
        fractionDigits(currency),
    );
}

/** 平均分攤，向上進位到該幣別最小單位。 */
export function splitEvenly(total: number, people: number, currency: string): number {
    const n = Math.max(1, Math.floor(people));
    return ceilTo(total / n, fractionDigits(currency));
}

const NAMES: Record<string, string> = { TWD: '新台幣', JPY: '日圓', KRW: '韓元', USD: '美元', EUR: '歐元', THB: '泰銖', HKD: '港幣', SGD: '新加坡幣', MYR: '馬來西亞令吉', GBP: '英鎊', CNY: '人民幣', AUD: '澳幣', VND: '越南盾' };

/** 白話幣別名稱：日圓；沒有收錄的幣別就顯示代碼。 */
export function currencyName(code: string): string {
    return NAMES[code.toUpperCase()] ?? code.toUpperCase();
}

export const CURRENCIES: { code: string; label: string }[] = [
    { code: 'TWD', label: '新台幣 (TWD)' },
    { code: 'JPY', label: '日圓 (JPY)' },
    { code: 'KRW', label: '韓元 (KRW)' },
    { code: 'USD', label: '美元 (USD)' },
    { code: 'EUR', label: '歐元 (EUR)' },
    { code: 'THB', label: '泰銖 (THB)' },
    { code: 'HKD', label: '港幣 (HKD)' },
    { code: 'SGD', label: '新加坡幣 (SGD)' },
    { code: 'MYR', label: '馬來西亞令吉 (MYR)' },
    { code: 'GBP', label: '英鎊 (GBP)' },
    { code: 'CNY', label: '人民幣 (CNY)' },
    { code: 'AUD', label: '澳幣 (AUD)' },
    { code: 'VND', label: '越南盾 (VND)' },
];
