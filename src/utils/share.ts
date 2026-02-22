import { configStore, itineraryStore, ticketStore } from '../db';
import { type DayItinerary } from '../data/itinerary';
import { type Ticket } from '../hooks/useTicketStore';

export async function exportTripData(tripId: string): Promise<string> {
    try {
        if (!tripId) throw new Error("No active trip");
        // 1. Fetch Configuration
        const config = await configStore.getItem<any>(`${tripId}_app_config`);

        // 2. Fetch Itinerary Structure
        const orderConfig = await itineraryStore.getItem<string[]>(`${tripId}_dayOrder`);
        const days: DayItinerary[] = [];

        if (orderConfig) {
            for (const id of orderConfig) {
                const day = await itineraryStore.getItem<DayItinerary>(`${tripId}_${id}`);
                if (day) days.push(day);
            }
        }

        // 3. Fetch shareable public tickets (Ignore private blobs!)
        const allKeys = await ticketStore.keys();
        const tripKeys = allKeys.filter(k => k.startsWith(`${tripId}_`));
        const shareableTickets: any[] = [];
        for (const key of tripKeys) {
            const ticket = await ticketStore.getItem<Ticket>(key);
            // Only export tickets that have text payloads or public tutorials.
            // Strip the local blob files out to save space and privacy.
            if (ticket) {
                shareableTickets.push({
                    id: ticket.id,
                    title: ticket.title,
                    type: ticket.type,
                    textPayload: ticket.textPayload,
                    publicTutorialBase64: ticket.publicTutorialBase64,
                    addedAt: ticket.addedAt
                });
            }
        }

        // 4. Assemble Payload 
        const payload = {
            config,
            dayOrder: orderConfig,
            days,
            tickets: shareableTickets
        };

        // 5. Serialize & Encode to Base64
        const jsonString = JSON.stringify(payload);
        return btoa(encodeURIComponent(jsonString));
    } catch (e) {
        console.error("Export failed", e);
        throw new Error("匯出失敗，請再試一次");
    }
}

// Helper to convert base64 to Blob
function base64ToBlob(base64: string, contentType: string = 'image/jpeg'): Blob {
    const byteCharacters = atob(base64.split(',')[1] || base64);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
    }
    return new Blob(byteArrays, { type: contentType });
}

export async function importTripData(tripId: string, base64String: string): Promise<boolean> {
    try {
        if (!tripId) throw new Error("No active trip");
        // 1. Decode payload
        const jsonString = decodeURIComponent(atob(base64String));
        const payload = JSON.parse(jsonString);

        if (!payload.config || !payload.dayOrder || !payload.days) {
            throw new Error("無效的行程碼格式");
        }

        // 2. Overwrite Local DB (Config)
        await configStore.setItem(`${tripId}_app_config`, payload.config);

        // 3. Overwrite Local DB (Itinerary), wiping exact DayItinerary keys
        await itineraryStore.setItem(`${tripId}_dayOrder`, payload.dayOrder);
        for (const day of payload.days) {
            await itineraryStore.setItem(`${tripId}_${day.id}`, day);
        }

        // 4. Overwrite Local DB (Tickets)
        if (payload.tickets && Array.isArray(payload.tickets)) {
            // Optional: wipe old tickets? For now we'll just add them.
            for (const t of payload.tickets) {
                const newTicket: Ticket = {
                    id: t.id,
                    title: t.title,
                    type: t.type,
                    textPayload: t.textPayload,
                    addedAt: t.addedAt,
                    // Rehydrate the base64 string back into a local blob for identical rendering later
                    publicTutorialBlob: t.publicTutorialBase64 ? base64ToBlob(t.publicTutorialBase64) : undefined,
                    publicTutorialBase64: t.publicTutorialBase64
                };
                await ticketStore.setItem(`${tripId}_${newTicket.id}`, newTicket);
            }
        }

        return true;
    } catch (e) {
        console.error("Import failed", e);
        return false;
    }
}
