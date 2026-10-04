import { describe, it, expect } from 'vitest';
import { csvCell, expensesToCsv } from './csv';

describe('CSV 匯出', () => {
    it('逗號、引號、換行會被正確包起來', () => {
        expect(csvCell('a,b')).toBe('"a,b"');
        expect(csvCell('say "hi"')).toBe('"say ""hi"""');
        expect(csvCell('兩\n行')).toBe('"兩\n行"');
    });
    it('以 = + - @ 開頭的文字不會變成試算表公式', () => {
        expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
        expect(csvCell('+1')).toBe("'+1");
        expect(csvCell(-5)).toBe('-5'); // 數字本身不加
    });
    it('有 BOM、表頭與逐筆資料，依日期排序，沒有幣別的舊紀錄用旅行幣別', () => {
        const csv = expensesToCsv(
            [
                { id: '2', description: '晚餐', amountJPY: 3000, category: '飲食', dateISO: '2026-02-11', paidBy: '小明' },
                { id: '1', description: '拉麵, 大碗', amountJPY: 1200, category: '飲食', dateISO: '2026-02-10', paidBy: '自己', currency: 'JPY' },
            ],
            'JPY',
        );
        expect(csv.charCodeAt(0)).toBe(0xfeff);
        const lines = csv.slice(1).trim().split('\r\n');
        expect(lines[0]).toBe('日期,說明,分類,金額,幣別,先付款的人');
        expect(lines[1]).toBe('2026/02/10,"拉麵, 大碗",飲食,1200,JPY,自己');
        expect(lines[2]).toBe('2026/02/11,晚餐,飲食,3000,JPY,小明');
    });
});
