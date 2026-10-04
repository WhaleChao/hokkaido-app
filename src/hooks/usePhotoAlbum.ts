import { useState, useEffect, useCallback } from 'react';
import { albumStore } from '../db';

export interface DailyAlbum {
    dayId: string;
    url: string;
}

export function usePhotoAlbum(tripId: string) {
    const [albums, setAlbums] = useState<DailyAlbum[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        if (!tripId) return;
        try {
            const saved = await albumStore.getItem<DailyAlbum[]>(`${tripId}_albums`);
            setAlbums(Array.isArray(saved) ? saved.filter((a) => a && typeof a.dayId === 'string' && typeof a.url === 'string') : []);
            setError('');
        } catch (e) {
            console.error('Failed to load albums', e);
            setError('讀取相簿連結失敗，請重新整理頁面');
        } finally {
            setLoading(false);
        }
    }, [tripId]);

    useEffect(() => {
        void load();
    }, [load]);

    const persist = async (next: DailyAlbum[]) => {
        await albumStore.setItem(`${tripId}_albums`, next);
        setAlbums(next);
    };

    const saveAlbumLink = async (dayId: string, url: string) => {
        if (!tripId) return;
        const next = albums.some((a) => a.dayId === dayId) ? albums.map((a) => (a.dayId === dayId ? { dayId, url } : a)) : [...albums, { dayId, url }];
        await persist(next);
    };

    const removeAlbumLink = async (dayId: string) => {
        if (!tripId) return;
        await persist(albums.filter((a) => a.dayId !== dayId));
    };

    const getUrlForDay = (dayId: string) => albums.find((a) => a.dayId === dayId)?.url || '';

    return { albums, loading, error, saveAlbumLink, removeAlbumLink, getUrlForDay };
}
