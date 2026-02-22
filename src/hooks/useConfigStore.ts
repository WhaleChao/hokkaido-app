import { useState, useEffect } from 'react';
import { configStore } from '../db';

export interface Accommodation {
    id: string;
    name: string;
    address: string;
    url: string;
    checkIn?: string;
    checkOut?: string;
}

export interface AppConfig {
    tripName: string;
    location: string;
    startDate: string;
    endDate: string;
    accommodationAddress: string; // Legacy
    accommodations?: Accommodation[];
    travelers?: number;
    baseCurrency?: string;
    tripCurrency?: string;
    defaultRegion?: string; // Phase 15: Search prefix
}

const DEFAULT_CONFIG: AppConfig = {
    tripName: '我的日本自由行',
    location: 'Tokyo, Japan',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
    accommodationAddress: '',
    accommodations: [],
    travelers: 1,
    baseCurrency: 'TWD',
    tripCurrency: 'JPY',
    defaultRegion: ''
};

export function useConfigStore(tripId: string) {
    const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(true);

    const loadConfig = async () => {
        if (!tripId) return;
        try {
            const savedConfig = await configStore.getItem<AppConfig>(`${tripId}_app_config`);
            if (savedConfig) {
                // Backward compatibility migration for V1 to V2
                if (!savedConfig.accommodations && savedConfig.accommodationAddress) {
                    savedConfig.accommodations = [
                        {
                            id: crypto.randomUUID(),
                            name: '預設住宿',
                            address: savedConfig.accommodationAddress,
                            url: ''
                        }
                    ];
                } else if (!savedConfig.accommodations) {
                    savedConfig.accommodations = [];
                }
                setConfig(savedConfig);
            } else {
                setConfig(DEFAULT_CONFIG);
            }
        } catch (e) {
            console.error('Failed to load config', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadConfig();
    }, [tripId]);

    const updateConfig = async (newConfig: Partial<AppConfig>) => {
        if (!tripId) return;
        const updated = { ...config, ...newConfig };
        await configStore.setItem(`${tripId}_app_config`, updated);
        setConfig(updated);
    };

    return { config, loading, updateConfig };
}
