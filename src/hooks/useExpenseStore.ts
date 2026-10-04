import { useState, useEffect, useCallback } from 'react';
import { expenseStore } from '../db';

export type ExpenseCategory = '飲食' | '交通' | '住宿' | '購物' | '門票' | '其他';

export interface ExpenseRecord {
    id: string;
    description: string;
    /** 欄位名稱沿用舊版 amountJPY（為了不動既有資料），實際是「該筆的幣別金額」 */
    amountJPY: number;
    category: ExpenseCategory;
    dateISO: string;
    paidBy: string;
    /** 新增的欄位：記錄當時使用的幣別。舊資料沒有這個欄位，視為目前的旅行幣別。 */
    currency?: string;
    createdAt?: number;
}

export function sortExpenses(list: ExpenseRecord[]): ExpenseRecord[] {
    return [...list].sort((a, b) => {
        if (a.dateISO !== b.dateISO) return a.dateISO < b.dateISO ? 1 : -1;
        return (b.createdAt ?? 0) - (a.createdAt ?? 0);
    });
}

export function useExpenseStore(tripId: string) {
    const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        if (!tripId) return;
        try {
            const keys = (await expenseStore.keys()).filter((k) => k.startsWith(`${tripId}_`));
            const loaded: ExpenseRecord[] = [];
            for (const key of keys) {
                const rec = await expenseStore.getItem<ExpenseRecord>(key);
                if (rec && typeof rec.amountJPY === 'number' && Number.isFinite(rec.amountJPY)) loaded.push(rec);
            }
            setExpenses(sortExpenses(loaded));
            setError('');
        } catch (e) {
            console.error('Failed to load expenses', e);
            setError('讀取帳本失敗，請重新整理頁面');
        } finally {
            setLoading(false);
        }
    }, [tripId]);

    useEffect(() => {
        void load();
    }, [load]);

    const addExpense = async (data: Omit<ExpenseRecord, 'id' | 'createdAt'>) => {
        if (!tripId) return;
        const rec: ExpenseRecord = { id: crypto.randomUUID(), createdAt: Date.now(), ...data };
        await expenseStore.setItem(`${tripId}_${rec.id}`, rec);
        await load();
    };

    const removeExpense = async (id: string) => {
        if (!tripId) return;
        await expenseStore.removeItem(`${tripId}_${id}`);
        await load();
    };

    return { expenses, loading, error, addExpense, removeExpense };
}
