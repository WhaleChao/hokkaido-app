import { useState, useEffect, useCallback } from 'react';
import { defaultConfig, type AppConfig } from '../data/config';
import { readConfig, patchConfig } from '../utils/tripData';
import { onData } from '../utils/bus';

export type { AppConfig, Accommodation } from '../data/config';

export function useConfigStore(tripId: string) {
    const [config, setConfig] = useState<AppConfig>(() => defaultConfig());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        if (!tripId) return;
        try {
            const c = await readConfig(tripId);
            setConfig(c ?? defaultConfig());
            setError('');
        } catch (e) {
            console.error('Failed to load config', e);
            setError('讀取旅程設定失敗，請重新整理頁面');
        } finally {
            setLoading(false);
        }
    }, [tripId]);

    useEffect(() => {
        void load();
        return onData('config', () => void load());
    }, [load]);

    /** 儲存失敗會丟出錯誤，由呼叫端顯示給使用者（不吞錯）。 */
    const updateConfig = useCallback(
        async (patch: Partial<AppConfig>) => {
            if (!tripId) return;
            const next = await patchConfig(tripId, patch);
            setConfig(next);
        },
        [tripId],
    );

    return { config, loading, error, updateConfig };
}
