import { useState, useEffect } from 'react';
import { checklistStore } from '../db';

export type PackingCategory = '重要文件' | '電子產品' | '衣物' | '盥洗用品' | '其他';

export interface PackingItem {
    id: string;
    text: string;
    category: PackingCategory;
    isPacked: boolean;
}

const DEFAULT_ITEMS: Omit<PackingItem, 'id'>[] = [
    { text: '護照 (檢查效期過期沒)', category: '重要文件', isPacked: false },
    { text: '日幣現金 / 信用卡', category: '重要文件', isPacked: false },
    { text: 'Visit Japan Web QR Code', category: '重要文件', isPacked: false },
    { text: '網卡或 eSIM', category: '電子產品', isPacked: false },
    { text: '行動電源 (須放隨身)', category: '電子產品', isPacked: false },
    { text: '萬國插頭 / 充電線', category: '電子產品', isPacked: false },
    { text: '保暖外套 / 發熱衣', category: '衣物', isPacked: false },
    { text: '好走的鞋子', category: '衣物', isPacked: false },
    { text: '個人藥品', category: '盥洗用品', isPacked: false },
];

export function useChecklistStore(tripId: string) {
    const [items, setItems] = useState<PackingItem[]>([]);
    const [loading, setLoading] = useState(true);

    const loadItems = async () => {
        if (!tripId) return;
        try {
            const allKeys = await checklistStore.keys();
            const tripKeys = allKeys.filter(k => k.startsWith(`${tripId}_`));

            if (tripKeys.length === 0) {
                // Pre-seed the default items for a fresh trip
                const seeded: PackingItem[] = [];
                for (const tmpl of DEFAULT_ITEMS) {
                    const newItem: PackingItem = { id: crypto.randomUUID(), ...tmpl };
                    await checklistStore.setItem(`${tripId}_${newItem.id}`, newItem);
                    seeded.push(newItem);
                }
                setItems(seeded);
            } else {
                const loaded: PackingItem[] = [];
                for (const key of tripKeys) {
                    const itm = await checklistStore.getItem<PackingItem>(key);
                    if (itm) loaded.push(itm);
                }
                setItems(loaded);
            }
        } catch (e) {
            console.error('Failed to load checklist', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadItems();
    }, [tripId]);

    const addItem = async (data: Omit<PackingItem, 'id' | 'isPacked'>) => {
        if (!tripId) return;
        const newItem: PackingItem = {
            id: crypto.randomUUID(),
            ...data,
            isPacked: false
        };
        await checklistStore.setItem(`${tripId}_${newItem.id}`, newItem);
        await loadItems();
    };

    const togglePacked = async (id: string, currentlyPacked: boolean) => {
        if (!tripId) return;
        const item = await checklistStore.getItem<PackingItem>(`${tripId}_${id}`);
        if (item) {
            item.isPacked = !currentlyPacked;
            await checklistStore.setItem(`${tripId}_${id}`, item);
            await loadItems();
        }
    };

    const removeItem = async (id: string) => {
        if (!tripId) return;
        await checklistStore.removeItem(`${tripId}_${id}`);
        await loadItems();
    };

    return { items, loading, addItem, togglePacked, removeItem };
}
