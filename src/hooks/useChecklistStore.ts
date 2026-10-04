import { useState, useEffect, useCallback } from 'react';
import { checklistStore, configStore } from '../db';

export type PackingCategory = '重要文件' | '電子產品' | '衣物' | '盥洗用品' | '其他';

export interface PackingItem {
    id: string;
    text: string;
    category: PackingCategory;
    isPacked: boolean;
    createdAt?: number;
}

export const DEFAULT_ITEMS: Omit<PackingItem, 'id'>[] = [
    { text: '護照（確認效期）', category: '重要文件', isPacked: false },
    { text: '日幣現金與信用卡', category: '重要文件', isPacked: false },
    { text: 'Visit Japan Web QR Code', category: '重要文件', isPacked: false },
    { text: '網卡或 eSIM', category: '電子產品', isPacked: false },
    { text: '行動電源（須隨身攜帶）', category: '電子產品', isPacked: false },
    { text: '轉接插頭與充電線', category: '電子產品', isPacked: false },
    { text: '保暖外套與發熱衣', category: '衣物', isPacked: false },
    { text: '好走的鞋子', category: '衣物', isPacked: false },
    { text: '個人藥品', category: '盥洗用品', isPacked: false },
];

const seededKey = (tripId: string) => `${tripId}_checklist_seeded`;
const seeding = new Map<string, Promise<void>>();

/** 第一次開啟才放入預設清單；之後即使使用者把項目全刪光，也不會又被塞回來。 */
async function seedOnce(tripId: string): Promise<void> {
    if (await configStore.getItem(seededKey(tripId))) return;
    const keys = (await checklistStore.keys()).filter((k) => k.startsWith(`${tripId}_`));
    if (keys.length === 0) {
        const now = Date.now();
        for (let i = 0; i < DEFAULT_ITEMS.length; i++) {
            const item: PackingItem = { id: crypto.randomUUID(), ...DEFAULT_ITEMS[i], createdAt: now + i };
            await checklistStore.setItem(`${tripId}_${item.id}`, item);
        }
    }
    await configStore.setItem(seededKey(tripId), true);
}

export function sortItems(items: PackingItem[]): PackingItem[] {
    return [...items].sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
}

export function useChecklistStore(tripId: string) {
    const [items, setItems] = useState<PackingItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        if (!tripId) return;
        try {
            let p = seeding.get(tripId);
            if (!p) {
                p = seedOnce(tripId).finally(() => seeding.delete(tripId));
                seeding.set(tripId, p);
            }
            await p;
            const keys = (await checklistStore.keys()).filter((k) => k.startsWith(`${tripId}_`));
            const loaded: PackingItem[] = [];
            for (const key of keys) {
                const it = await checklistStore.getItem<PackingItem>(key);
                if (it) loaded.push(it);
            }
            setItems(sortItems(loaded));
            setError('');
        } catch (e) {
            console.error('Failed to load checklist', e);
            setError('讀取行李清單失敗，請重新整理頁面');
        } finally {
            setLoading(false);
        }
    }, [tripId]);

    useEffect(() => {
        void load();
    }, [load]);

    const addItem = async (data: Omit<PackingItem, 'id' | 'isPacked' | 'createdAt'>) => {
        if (!tripId) return;
        const item: PackingItem = { id: crypto.randomUUID(), ...data, isPacked: false, createdAt: Date.now() };
        await checklistStore.setItem(`${tripId}_${item.id}`, item);
        await load();
    };

    const togglePacked = async (id: string) => {
        if (!tripId) return;
        const item = await checklistStore.getItem<PackingItem>(`${tripId}_${id}`);
        if (item) {
            await checklistStore.setItem(`${tripId}_${id}`, { ...item, isPacked: !item.isPacked });
            await load();
        }
    };

    const removeItem = async (id: string) => {
        if (!tripId) return;
        await checklistStore.removeItem(`${tripId}_${id}`);
        await load();
    };

    return { items, loading, error, addItem, togglePacked, removeItem };
}
