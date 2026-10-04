import { type ExpenseRecord } from '../hooks/useExpenseStore';
import { fractionDigits, roundTo } from './money';

/** 把所有紀錄換算成指定幣別的總額；任何一筆查不到匯率就標記為不完整（不假裝成功）。 */
export function totalIn(expenses: ExpenseRecord[], tripCurr: string, target: string, convert: (a: number, f: string, t: string) => number | null): { value: number; incomplete: boolean; converted: number } {
    let incomplete = false;
    const parts: number[] = [];
    for (const e of expenses) {
        const from = e.currency || tripCurr;
        const v = from === target ? e.amountJPY : convert(e.amountJPY, from, target);
        if (v === null) incomplete = true;
        else parts.push(v);
    }
    return { value: roundTo(parts.reduce((a, b) => a + b, 0), fractionDigits(target)), incomplete, converted: parts.length };
}

