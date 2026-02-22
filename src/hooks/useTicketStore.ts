import { useState, useEffect } from 'react';
import { ticketStore } from '../db';
export type TicketType = 'transit' | 'flight' | 'other';

export interface Ticket {
    id: string;
    title: string;           // e.g., "72HR Pass", "Flight CI 100"
    type: TicketType;
    textPayload?: string;    // e.g., "Terminal 2, 10:00 AM"
    privateImageBlob?: Blob; // The actual QR code (Never Exported)
    publicTutorialBlob?: Blob; // The "How to exchange" guide (Exported via base64)
    publicTutorialBase64?: string; // Stringified guide for sharing
    addedAt: number;
}
export function useTicketStore(tripId: string) {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);

    const loadTickets = async () => {
        if (!tripId) return;
        try {
            const allKeys = await ticketStore.keys();
            const tripKeys = allKeys.filter(k => k.startsWith(`${tripId}_`));

            const loaded: Ticket[] = [];
            for (const key of tripKeys) {
                const ticket = await ticketStore.getItem<Ticket>(key);
                if (ticket) loaded.push(ticket);
            }
            // Sort by newest first
            setTickets(loaded.sort((a, b) => b.addedAt - a.addedAt));
        } catch (e) {
            console.error('Failed to load tickets', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTickets();
    }, [tripId]);

    const addTicket = async (ticketData: Omit<Ticket, 'id' | 'addedAt'>) => {
        if (!tripId) return;
        const newTicket: Ticket = {
            id: crypto.randomUUID(),
            ...ticketData,
            addedAt: Date.now()
        };
        await ticketStore.setItem(`${tripId}_${newTicket.id}`, newTicket);
        await loadTickets();
    };

    const removeTicket = async (id: string) => {
        if (!tripId) return;
        await ticketStore.removeItem(`${tripId}_${id}`);
        await loadTickets();
    };

    return { tickets, loading, addTicket, removeTicket };
}
