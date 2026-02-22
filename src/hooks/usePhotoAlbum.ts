import { useState, useEffect } from 'react';
import { albumStore } from '../db';

export interface DailyAlbum {
    dayId: string;
    url: string;
}

export function usePhotoAlbum(tripId: string) {
    const [albums, setAlbums] = useState<DailyAlbum[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadAlbums = async () => {
            if (!tripId) return;
            try {
                const saved = await albumStore.getItem<DailyAlbum[]>(`${tripId}_albums`);
                if (saved) {
                    setAlbums(saved);
                } else {
                    setAlbums([]);
                }
            } catch (e) {
                console.error('Failed to load albums', e);
            } finally {
                setLoading(false);
            }
        };
        loadAlbums();
    }, [tripId]);

    const saveAlbumLink = async (dayId: string, url: string) => {
        if (!tripId) return;
        const newAlbums = [...albums];
        const existingIndex = newAlbums.findIndex(a => a.dayId === dayId);

        if (existingIndex >= 0) {
            newAlbums[existingIndex] = { dayId, url };
        } else {
            newAlbums.push({ dayId, url });
        }

        setAlbums(newAlbums);
        await albumStore.setItem(`${tripId}_albums`, newAlbums);
    };

    const removeAlbumLink = async (dayId: string) => {
        if (!tripId) return;
        const newAlbums = albums.filter(a => a.dayId !== dayId);
        setAlbums(newAlbums);
        await albumStore.setItem(`${tripId}_albums`, newAlbums);
    };

    const getUrlForDay = (dayId: string) => {
        return albums.find(a => a.dayId === dayId)?.url || '';
    };

    return { albums, loading, saveAlbumLink, removeAlbumLink, getUrlForDay };
}
