import { useState, useEffect, useCallback } from 'react';
import { itineraryStore, configStore } from '../db';
import { type DayItinerary } from '../data/itinerary';

export function useItinerary(tripId: string) {
    const [days, setDays] = useState<DayItinerary[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async (showLoader = true) => {
        if (!tripId) return;
        try {
            if (showLoader) setLoading(true);
            const appConfig = await configStore.getItem<any>(`${tripId}_app_config`);
            if (!appConfig?.startDate || !appConfig?.endDate) {
                setDays([]);
                return;
            }

            const start = new Date(appConfig.startDate);
            const end = new Date(appConfig.endDate);
            const diffTime = Math.abs(end.getTime() - start.getTime());
            const expectedDaysCount = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

            let orderConfig = await itineraryStore.getItem<string[]>(`${tripId}_dayOrder`);

            // Re-seed if days changed
            if (!orderConfig || orderConfig.length !== expectedDaysCount) {
                const newOrder: string[] = [];
                for (let i = 0; i < expectedDaysCount; i++) {
                    const dayId = `day-${i + 1}`;
                    newOrder.push(dayId);

                    const existingDay = await itineraryStore.getItem<DayItinerary>(`${tripId}_${dayId}`);
                    if (!existingDay) {
                        const currentDate = new Date(start);
                        currentDate.setDate(start.getDate() + i);

                        await itineraryStore.setItem(`${tripId}_${dayId}`, {
                            id: dayId,
                            dayLabel: `Day ${i + 1}`,
                            date: `${currentDate.getMonth() + 1}月${currentDate.getDate()}日`,
                            locationLabel: appConfig.location || '設定地點',
                            attractions: [],
                            advice: {
                                clothing: '等待即時天氣預報...',
                                snowCondition: '請確保填寫正確的目的地與出發日期以獲取建議。'
                            }
                        } as DayItinerary);
                    }
                }
                await itineraryStore.setItem(`${tripId}_dayOrder`, newOrder);
                orderConfig = newOrder;
            }

            const loadedDays: DayItinerary[] = [];
            for (const id of orderConfig) {
                const day = await itineraryStore.getItem<DayItinerary>(`${tripId}_${id}`);
                if (day) loadedDays.push(day);
            }
            setDays(loadedDays);
        } catch (e) {
            console.error('Failed to load itinerary from IndexedDB', e);
        } finally {
            if (showLoader) setLoading(false);
        }
    }, [tripId]);

    useEffect(() => {
        loadData(true);
        // Listen to focus to simulate a refresh when returning from settings
        const handleFocus = () => loadData(true);
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [loadData, tripId]); // include tripId to react to changes

    const saveDay = async (day: DayItinerary) => {
        if (!tripId) return;
        await itineraryStore.setItem(`${tripId}_${day.id}`, day);
        await loadData(false); // Background refresh without showing spinner
    };

    return { days, loading, saveDay, refreshAgenda: loadData };
}
