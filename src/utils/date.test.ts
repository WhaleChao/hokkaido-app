import { describe, it, expect } from 'vitest';
import { parseISODate, addDaysISO, diffDaysISO, tripDayCount, todayISO, validateTripDates, formatMD, weekdayZh, legacyDayLabel } from './date';

describe('日期工具', () => {
    it('嚴格解析 YYYY-MM-DD，擋掉不存在的日期', () => {
        expect(parseISODate('2026-02-10')).toEqual({ y: 2026, m: 2, d: 10 });
        expect(parseISODate('2026-02-30')).toBeNull();
        expect(parseISODate('2026-13-01')).toBeNull();
        expect(parseISODate('2/10')).toBeNull();
        expect(parseISODate('')).toBeNull();
        expect(parseISODate(undefined)).toBeNull();
    });

    it('加減天數跨月、跨年、閏年都正確', () => {
        expect(addDaysISO('2026-02-27', 3)).toBe('2026-03-02');
        expect(addDaysISO('2028-02-28', 1)).toBe('2028-02-29');
        expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01');
        expect(addDaysISO('2026-03-01', -1)).toBe('2026-02-28');
    });

    it('跨夏令時間（美國 3/8、歐洲 3/29）天數仍然精確', () => {
        expect(diffDaysISO('2026-03-07', '2026-03-09')).toBe(2);
        expect(diffDaysISO('2026-03-28', '2026-03-30')).toBe(2);
        expect(tripDayCount('2026-03-07', '2026-03-09')).toBe(3);
    });

    it('旅程天數含頭尾；結束早於開始回傳 null', () => {
        expect(tripDayCount('2026-02-10', '2026-02-12')).toBe(3);
        expect(tripDayCount('2026-02-10', '2026-02-10')).toBe(1);
        expect(tripDayCount('2026-02-12', '2026-02-10')).toBeNull();
        expect(tripDayCount('', '2026-02-10')).toBeNull();
    });

    it('todayISO 用裝置「當地」日期，不是 UTC（台北凌晨 0:30 仍是當天）', () => {
        // 以當地時間建構：2026-02-10 00:30
        expect(todayISO(new Date(2026, 1, 10, 0, 30))).toBe('2026-02-10');
        expect(todayISO(new Date(2026, 1, 10, 23, 59))).toBe('2026-02-10');
    });

    it('驗證旅程日期：缺漏、顛倒、過長都有白話訊息', () => {
        expect(validateTripDates('2026-02-10', '2026-02-12')).toBeNull();
        expect(validateTripDates('', '2026-02-12')).toMatch(/出發日/);
        expect(validateTripDates('2026-02-12', '2026-02-10')).toMatch(/早於/);
        expect(validateTripDates('2026-01-01', '2026-12-31')).toMatch(/最長/);
    });

    it('格式化與星期', () => {
        expect(formatMD('2026-02-10')).toBe('2/10');
        expect(weekdayZh('2026-02-10')).toBe('二');
        expect(legacyDayLabel('2026-02-10')).toBe('2月10日');
    });
});
