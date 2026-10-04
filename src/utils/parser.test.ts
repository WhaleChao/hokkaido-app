import { describe, it, expect } from 'vitest';
import { parseSpreadsheetData } from './parser';
import { type DayItinerary, type Attraction } from '../data/itinerary';

const att = (name: string): Attraction => ({ id: `a-${name}`, name, category: '景點', description: '', tags: [], mapQuery: name });
const day = (i: number, names: string[] = []): DayItinerary => ({
    id: `day-${i}`,
    dayLabel: `Day ${i}`,
    date: `${i}月`,
    locationLabel: '',
    attractions: names.map(att),
    advice: { clothing: '', snowCondition: '' },
});

describe('試算表匯入', () => {
    it('亂貼的文字：解析失敗，原本的行程一個都不會被動到', () => {
        const days = [day(1, ['原本的景點']), day(2, ['另一個'])];
        const r = parseSpreadsheetData('隨便亂貼的文字\n第二行', days);
        expect(r.ok).toBe(false);
        expect(r.error).toMatch(/沒有改動/);
        expect(r.days).toBe(days);
        expect(days[0].attractions).toHaveLength(1);
    });

    it('空白內容回報錯誤', () => {
        expect(parseSpreadsheetData('   ', [day(1)]).ok).toBe(false);
    });

    it('直式：只取代有出現的那天，其他天原封不動；分類欄會被採用', () => {
        const days = [day(1, ['舊1']), day(2, ['舊2']), day(3, ['舊3'])];
        const tsv = '天數\t景點名稱\t分類\t備註\n1\t小樽運河\t景點\t傍晚\n1\t一蘭拉麵\t食物\t\n3\t札幌車站\t交通\t';
        const r = parseSpreadsheetData(tsv, days);
        expect(r.ok).toBe(true);
        expect(r.parsedItems).toBe(3);
        expect(r.touchedIndexes).toEqual([0, 2]);
        expect(r.days[0].attractions.map((a) => a.name)).toEqual(['小樽運河', '一蘭拉麵']);
        expect(r.days[0].attractions[1].category).toBe('食物');
        expect(r.days[1].attractions.map((a) => a.name)).toEqual(['舊2']); // 沒出現的天保持原樣
        expect(r.days[2].attractions[0].category).toBe('交通');
    });

    it('直式：天數超出行程的列被略過並提醒', () => {
        const r = parseSpreadsheetData('1\tA\t景點\t\n9\tB\t景點\t', [day(1)]);
        expect(r.ok).toBe(true);
        expect(r.parsedItems).toBe(1);
        expect(r.warnings.join('')).toMatch(/略過/);
    });

    it('橫式：表頭有「活動地點」，多天並排；行程天數不夠會自動補天（id 與設定頁一致）', () => {
        const tsv = ['日期\t\t\t\t2/11\t\t\t', '時間\t活動地點\t簡介\t備註\t時間\t活動地點\t簡介\t備註', '09:00\t新千歲機場\t抵達\t\t10:00\t小樽運河\t拍照\t', '12:00\t午餐\t咖哩\t\t\t\t\t'].join('\n');
        const r = parseSpreadsheetData(tsv, [day(1)]);
        expect(r.ok).toBe(true);
        expect(r.addedDays).toBe(1);
        expect(r.days).toHaveLength(2);
        expect(r.days[1].id).toBe('day-2'); // 舊版會產生 day2 而不是 day-2，導致新增的天永遠不顯示
        expect(r.days[0].attractions.map((a) => a.name)).toEqual(['[09:00] 新千歲機場', '[12:00] 午餐']);
        expect(r.days[1].attractions[0].name).toBe('[10:00] 小樽運河');
    });

    it('通用標題「午餐」會用說明第一行當導航搜尋字', () => {
        const tsv = '時間\t活動地點\t簡介\t備註\n12:00\t午餐\t湯咖哩 Suage\t';
        const r = parseSpreadsheetData(tsv, [day(1)]);
        expect(r.days[0].attractions[0].mapQuery).toContain('Suage');
    });

    it('「1. xxx 2. yyy」會拆成多個方案選項', () => {
        const tsv = '時間\t活動地點\t簡介\t備註\n12:00\t午餐\t1. 咖哩 2. 松屋\t';
        const r = parseSpreadsheetData(tsv, [day(1)]);
        expect(r.days[0].attractions[0].subOptions).toHaveLength(2);
        expect(r.days[0].attractions[0].subOptions?.[0].label).toBe('A 方案');
    });

    it('不修改傳入的原始資料（純函式）', () => {
        const days = [day(1, ['舊'])];
        const snapshot = JSON.stringify(days);
        parseSpreadsheetData('1\t新\t景點\t', days);
        expect(JSON.stringify(days)).toBe(snapshot);
    });
});
