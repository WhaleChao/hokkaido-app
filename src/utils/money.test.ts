import { describe, it, expect } from 'vitest';
import { parseAmount, formatMoney, splitEvenly, fractionDigits, roundTo, ceilTo, sumAmounts } from './money';

describe('金額工具', () => {
    it('接受千分位、全形數字、小數；拒絕無效、零、負數', () => {
        expect(parseAmount('1,234', 'JPY')).toBe(1234);
        expect(parseAmount('１２３', 'JPY')).toBe(123);
        expect(parseAmount('12.5', 'USD')).toBe(12.5);
        expect(parseAmount('0', 'JPY')).toBeNull();
        expect(parseAmount('-5', 'JPY')).toBeNull();
        expect(parseAmount('abc', 'JPY')).toBeNull();
        expect(parseAmount('', 'JPY')).toBeNull();
        expect(parseAmount('1e3', 'JPY')).toBeNull();
        expect(parseAmount('12.345', 'USD')).toBeNull();
    });

    it('日圓沒有小數：帶小數視為無效，而不是無聲捨去', () => {
        expect(parseAmount('100.5', 'JPY')).toBeNull();
        expect(parseAmount('100.5', 'USD')).toBe(100.5);
    });

    it('過大的金額被擋下', () => {
        expect(parseAmount('99999999999', 'JPY')).toBeNull();
    });

    it('浮點誤差不會讓總額多出 1 分', () => {
        expect(sumAmounts([0.1, 0.2], 'USD')).toBe(0.3);
        expect(roundTo(1.005, 2)).toBe(1.01);
        expect(ceilTo(0.1 + 0.2, 1)).toBe(0.3);
    });

    it('平分向上進位到最小單位', () => {
        expect(splitEvenly(1000, 3, 'JPY')).toBe(334);
        expect(splitEvenly(10, 3, 'USD')).toBe(3.34);
        expect(splitEvenly(100, 0, 'JPY')).toBe(100);
    });

    it('格式化與小數位數', () => {
        expect(fractionDigits('JPY')).toBe(0);
        expect(fractionDigits('TWD')).toBe(2);
        expect(formatMoney(1234, 'JPY')).toBe('¥1,234');
        expect(formatMoney(1234.4, 'TWD')).toBe('NT$1,234'); // 新台幣顯示整數
        expect(formatMoney(1234.5, 'USD')).toBe('US$1,234.50');
    });
});
