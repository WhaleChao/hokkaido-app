import { useState, useEffect, useCallback } from 'react';
import { configStore } from '../db';
import { loadTripsWithMigration, createTripRecord, deleteTripRecord, type TripMeta } from '../utils/tripData';
import { validateTripDates } from '../utils/date';
import { onData } from '../utils/bus';

export type { TripMeta } from '../utils/tripData';

export function useTripManager() {
    const [trips, setTrips] = useState<TripMeta[]>([]);
    const [activeTripId, setActiveTripId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        try {
            const list = await loadTripsWithMigration();
            const saved = await configStore.getItem<string>('active_trip_id');
            const active = saved && list.some((t) => t.id === saved) ? saved : null;
            setTrips(list);
            setActiveTripId(active);
            setError('');
        } catch (e) {
            console.error('Failed to load trips', e);
            setError('讀取行程庫失敗，請重新整理頁面。你的資料不會因此消失。');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
        return onData('trips', () => void load());
    }, [load]);

    const selectTrip = useCallback(async (id: string | null) => {
        if (id) await configStore.setItem('active_trip_id', id);
        else await configStore.removeItem('active_trip_id');
        setActiveTripId(id);
    }, []);

    const createTrip = useCallback(async (name: string, startDate: string, endDate: string) => {
        const problem = validateTripDates(startDate, endDate);
        if (problem) throw new Error(problem);
        const meta = await createTripRecord(name, startDate, endDate);
        setTrips((prev) => [...prev, meta]);
        await configStore.setItem('active_trip_id', meta.id);
        setActiveTripId(meta.id);
        return meta.id;
    }, []);

    const deleteTrip = useCallback(
        async (id: string) => {
            const remaining = await deleteTripRecord(id);
            setTrips(remaining);
            if (activeTripId === id) {
                await configStore.removeItem('active_trip_id');
                setActiveTripId(null);
            }
        },
        [activeTripId],
    );

    return { trips, activeTripId, loading, error, createTrip, selectTrip, deleteTrip, reload: load };
}
