import localforage from 'localforage';
import { itineraryData } from './data/itinerary';

// App Configuration Store
export const configStore = localforage.createInstance({
    name: 'hokkaido_app',
    storeName: 'config'
});

// Itinerary Store
export const itineraryStore = localforage.createInstance({
    name: 'hokkaido_app',
    storeName: 'itinerary'
});

// Ticket/QR Code Store
export const ticketStore = localforage.createInstance({
    name: 'hokkaido_app',
    storeName: 'tickets'
});

// Expense Tracker Store
export const expenseStore = localforage.createInstance({
    name: 'hokkaido_app',
    storeName: 'expenses'
});

// Packing Checklist Store
export const checklistStore = localforage.createInstance({
    name: 'hokkaido_app',
    storeName: 'checklists'
});

export const albumStore = localforage.createInstance({
    name: 'hokkaido_app',
    storeName: 'albums'
});

// Initialize DB with seed data if empty
export async function initializeDB() {
    const existingItinerary = await itineraryStore.length();

    if (existingItinerary === 0) {
        // Seed the database with the initial mock data
        for (const day of itineraryData) {
            await itineraryStore.setItem(day.id, day);
        }

        // Set a default ordering array
        await itineraryStore.setItem('dayOrder', itineraryData.map(d => d.id));
    }
}
