import { useState, useEffect, useCallback } from 'react';
import { type DayItinerary } from '../data/itinerary';
import { ensureDays, updateDay as updateDayStored } from '../utils/tripData';
import { onData } from '../utils/bus';

export function useItinerary(tripId: string) {
    const [days, setDays] = useState<DayItinerary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        if (!tripId) return;
        try {
            setDays(await ensureDays(tripId));
            setError('');
        } catch (e) {
            console.error('Failed to load itinerary', e);
            setError('讀取行程失敗，請重新整理頁面');
        } finally {
            setLoading(false);
        }
    }, [tripId]);

    useEffect(() => {
        void load();
        const offA = onData('config', () => void load());
        const offB = onData('itinerary', () => void load());
        // 切回 App 時靜默重新讀取（不顯示讀取中，不會打斷正在編輯的表單）
        const refresh = () => {
            if (document.visibilityState === 'visible') void load();
        };
        document.addEventListener('visibilitychange', refresh);
        return () => {
            offA();
            offB();
            document.removeEventListener('visibilitychange', refresh);
        };
    }, [load]);

    /** 以最新儲存內容為基礎修改某一天；失敗會丟出錯誤。 */
    const updateDay = useCallback(
        async (dayId: string, fn: (d: DayItinerary) => DayItinerary) => {
            await updateDayStored(tripId, dayId, fn);
        },
        [tripId],
    );

    return { days, loading, error, updateDay, reload: load };
}
