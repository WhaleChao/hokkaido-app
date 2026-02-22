import { useState, useEffect } from 'react';
import { expenseStore } from '../db';

export type ExpenseCategory = '飲食' | '交通' | '住宿' | '購物' | '門票' | '其他';

export interface ExpenseRecord {
    id: string;
    description: string;
    amountJPY: number;
    category: ExpenseCategory;
    dateISO: string;
    paidBy: string; // E.g., '自己', '公費', or specific names
}

export function useExpenseStore(tripId: string) {
    const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
    const [loading, setLoading] = useState(true);

    const loadExpenses = async () => {
        if (!tripId) return;
        try {
            const allKeys = await expenseStore.keys();
            const tripKeys = allKeys.filter(k => k.startsWith(`${tripId}_`));

            const loaded: ExpenseRecord[] = [];
            for (const key of tripKeys) {
                const rec = await expenseStore.getItem<ExpenseRecord>(key);
                if (rec) loaded.push(rec);
            }
            // Sort by Date (newest first)
            setExpenses(loaded.sort((a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime()));
        } catch (e) {
            console.error('Failed to load expenses', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadExpenses();
    }, [tripId]);

    const addExpense = async (data: Omit<ExpenseRecord, 'id'>) => {
        if (!tripId) return;
        const newRecord: ExpenseRecord = {
            id: crypto.randomUUID(),
            ...data
        };
        await expenseStore.setItem(`${tripId}_${newRecord.id}`, newRecord);
        await loadExpenses();
    };

    const removeExpense = async (id: string) => {
        if (!tripId) return;
        await expenseStore.removeItem(`${tripId}_${id}`);
        await loadExpenses();
    };

    return { expenses, loading, addExpense, removeExpense };
}
