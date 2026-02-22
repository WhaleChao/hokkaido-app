import { useState, useEffect } from 'react';
import { configStore, itineraryStore, ticketStore } from '../db';

export interface TripMeta {
    id: string;
    name: string;
    createdAt: number;
}

export function useTripManager() {
    const [trips, setTrips] = useState<TripMeta[]>([]);
    const [activeTripId, setActiveTripId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadTrips();
    }, []);

    const migrateLegacyData = async (savedTrips: TripMeta[]) => {
        const legacyConfig = await configStore.getItem<any>('app_config');
        if (legacyConfig && savedTrips.length === 0) {
            const legacyTripId = 'trip_legacy';
            const legacyTrip: TripMeta = {
                id: legacyTripId,
                name: legacyConfig.tripName || '我的日本自由行',
                createdAt: Date.now()
            };

            savedTrips.push(legacyTrip);
            await configStore.setItem('trips_list', savedTrips);

            // Migrate config
            await configStore.setItem(`${legacyTripId}_app_config`, legacyConfig);
            await configStore.removeItem('app_config');

            // Migrate itinerary
            const dayOrder = await itineraryStore.getItem<string[]>('dayOrder');
            if (dayOrder) {
                await itineraryStore.setItem(`${legacyTripId}_dayOrder`, dayOrder);
                for (const dtId of dayOrder) {
                    const day = await itineraryStore.getItem<any>(dtId);
                    if (day) {
                        await itineraryStore.setItem(`${legacyTripId}_${dtId}`, day);
                        await itineraryStore.removeItem(dtId);
                    }
                }
                await itineraryStore.removeItem('dayOrder');
            }

            // Migrate tickets
            const tKeys = await ticketStore.keys();
            for (const key of tKeys) {
                const tick = await ticketStore.getItem<any>(key);
                if (tick) {
                    await ticketStore.setItem(`${legacyTripId}_${key}`, tick);
                    await ticketStore.removeItem(key);
                }
            }

            return legacyTripId;
        }
        return null; // No migration needed
    };

    const loadTrips = async () => {
        try {
            let savedTrips = await configStore.getItem<TripMeta[]>('trips_list') || [];

            // Check for legacy v1 data unconditionally on boot if empty
            if (savedTrips.length === 0) {
                const legacyId = await migrateLegacyData(savedTrips);
                if (legacyId) { // Repopulate active
                    await configStore.setItem('active_trip_id', legacyId);
                }
            }

            const activeId = await configStore.getItem<string>('active_trip_id') || (savedTrips.length > 0 ? savedTrips[0].id : null);
            setTrips(savedTrips);
            setActiveTripId(activeId);
        } catch (e) {
            console.error('Failed to load trips', e);
        } finally {
            setLoading(false);
        }
    };

    const createTrip = async (name: string, startDate: string, endDate: string) => {
        const newTrip: TripMeta = {
            id: `trip_${Date.now()}`,
            name,
            createdAt: Date.now()
        };
        const updated = [...trips, newTrip];
        await configStore.setItem('trips_list', updated);

        // Setup initial trip config matrix so itinerary mathematically parses the days
        await configStore.setItem(`${newTrip.id}_app_config`, {
            tripName: name,
            location: '設定地點',
            startDate,
            endDate,
            accommodationAddress: ''
        });

        await configStore.setItem('active_trip_id', newTrip.id);

        setTrips(updated);
        setActiveTripId(newTrip.id);
        return newTrip.id;
    };

    const selectTrip = async (id: string | null) => {
        if (id) {
            await configStore.setItem('active_trip_id', id);
        } else {
            await configStore.removeItem('active_trip_id');
        }
        setActiveTripId(id);
    };

    const deleteTrip = async (id: string) => {
        const confirmStr = window.prompt(`您確定要刪除這個行程嗎？此動作無法復原。\n請輸入 "delete" 來確認刪除：`);
        if (confirmStr !== 'delete') return;

        const updated = trips.filter(t => t.id !== id);
        await configStore.setItem('trips_list', updated);

        if (activeTripId === id) {
            const nextActive = updated.length > 0 ? updated[0].id : null;
            await configStore.setItem('active_trip_id', nextActive);
            setActiveTripId(nextActive);
        } else {
            setTrips([...updated]);
        }

        // Wipe Database Records lazily
        try {
            await configStore.removeItem(`${id}_app_config`);

            const dayOrder = await itineraryStore.getItem<string[]>(`${id}_dayOrder`);
            if (dayOrder) {
                for (const dtId of dayOrder) {
                    await itineraryStore.removeItem(`${id}_${dtId}`);
                }
                await itineraryStore.removeItem(`${id}_dayOrder`);
            }

            const tKeys = await ticketStore.keys();
            for (const key of tKeys) {
                if (key.startsWith(`${id}_`)) {
                    await ticketStore.removeItem(key);
                }
            }
        } catch (e) {
            console.error("Failed to clean up trip resources", e);
        }
    };

    return { trips, activeTripId, loading, createTrip, selectTrip, deleteTrip };
}
