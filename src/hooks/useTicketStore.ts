import { useState, useEffect, useCallback } from 'react';
import { ticketStore } from '../db';

export type TicketType = 'transit' | 'flight' | 'other';

export interface Ticket {
    id: string;
    title: string;
    type: TicketType;
    textPayload?: string;
    privateImageBlob?: Blob; // 私密 QR：只存在這支手機，永遠不會被匯出或上傳
    publicTutorialBlob?: Blob; // 換票教學圖：使用者可選擇隨行程分享
    publicTutorialBase64?: string;
    addedAt: number;
}

export function useTicketStore(tripId: string) {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        if (!tripId) return;
        try {
            const keys = (await ticketStore.keys()).filter((k) => k.startsWith(`${tripId}_`));
            const loaded: Ticket[] = [];
            for (const key of keys) {
                const t = await ticketStore.getItem<Ticket>(key);
                if (t) loaded.push(t);
            }
            setTickets(loaded.sort((a, b) => b.addedAt - a.addedAt));
            setError('');
        } catch (e) {
            console.error('Failed to load tickets', e);
            setError('讀取票夾失敗，請重新整理頁面');
        } finally {
            setLoading(false);
        }
    }, [tripId]);

    useEffect(() => {
        void load();
    }, [load]);

    const addTicket = async (data: Omit<Ticket, 'id' | 'addedAt'>) => {
        if (!tripId) return;
        const t: Ticket = { id: crypto.randomUUID(), ...data, addedAt: Date.now() };
        await ticketStore.setItem(`${tripId}_${t.id}`, t);
        await load();
    };

    const removeTicket = async (id: string) => {
        if (!tripId) return;
        await ticketStore.removeItem(`${tripId}_${id}`);
        await load();
    };

    return { tickets, loading, error, addTicket, removeTicket };
}
