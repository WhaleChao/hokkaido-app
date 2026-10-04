import { type ExpenseRecord } from '../hooks/useExpenseStore';
import { formatYMD } from './date';

/** CSV 欄位：含逗號、引號、換行要加引號；以 = + - @ 開頭的文字前面加單引號，避免用 Excel 開啟時被當成公式執行。 */
export function csvCell(v: string | number): string {
    let s = String(v);
    if (/^[=+\-@\t\r]/.test(s) && typeof v === 'string') s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function expensesToCsv(expenses: ExpenseRecord[], defaultCurrency: string): string {
    const rows: (string | number)[][] = [['日期', '說明', '分類', '金額', '幣別', '先付款的人']];
    for (const e of [...expenses].sort((a, b) => (a.dateISO < b.dateISO ? -1 : a.dateISO > b.dateISO ? 1 : (a.createdAt ?? 0) - (b.createdAt ?? 0)))) {
        rows.push([formatYMD(e.dateISO) || e.dateISO, e.description, e.category, e.amountJPY, e.currency || defaultCurrency, e.paidBy]);
    }
    // 開頭加 BOM，Excel 才會用 UTF-8 正確顯示中文
    return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
