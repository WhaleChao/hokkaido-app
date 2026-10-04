// 既有使用者資料相容性：舊版（2026-02 的 gh-pages 版本）寫進手機的資料，新版必須一筆不少地讀得出來。
// 這裡的「舊資料」是照舊版程式碼實際寫入的格式手工重建的（鍵名、欄位、缺少新欄位）。
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { configStore, itineraryStore, ticketStore, expenseStore, checklistStore, albumStore } from './db';
import { useTripManager } from './hooks/useTripManager';
import { useConfigStore } from './hooks/useConfigStore';
import { useItinerary } from './hooks/useItinerary';
import { useExpenseStore } from './hooks/useExpenseStore';
import { useChecklistStore } from './hooks/useChecklistStore';
import { usePhotoAlbum } from './hooks/usePhotoAlbum';
import { useTicketStore } from './hooks/useTicketStore';
import { resetAll } from './test/helpers';

beforeEach(resetAll);

const T = 'trip_1769000000000';

async function seedOldVersionData() {
    await configStore.setItem('trips_list', [{ id: T, name: '北海道 2026', createdAt: 1769000000000 }]);
    await configStore.setItem('active_trip_id', T);
    // 舊版建立行程時寫入的設定（沒有 travelers／幣別／accommodations 等後來加的欄位）
    await configStore.setItem(`${T}_app_config`, { tripName: '北海道 2026', location: 'Sapporo, Japan', startDate: '2026-02-10', endDate: '2026-02-12', accommodationAddress: '札幌市中央區大通西1丁目' });
    await itineraryStore.setItem(`${T}_dayOrder`, ['day-1', 'day-2', 'day-3']);
    await itineraryStore.setItem(`${T}_day-1`, {
        id: 'day-1',
        dayLabel: 'Day 1',
        date: '2月10日',
        locationLabel: 'Sapporo, Japan',
        attractions: [
            { id: 'p1', name: '[09:00] 新千歲機場', category: '交通', description: '抵達', tags: [], mapQuery: '新千歲機場' },
            { id: 'p2', name: '午餐', category: '食物', description: '湯咖哩\n📝 記得預約', tags: ['必吃'], mapQuery: '午餐', planVariant: '男生行程', durationMinutes: 90 },
        ],
        advice: { clothing: '等待即時天氣預報...', snowCondition: '請確保填寫正確的目的地與出發日期以獲取建議。' },
    });
    await itineraryStore.setItem(`${T}_day-2`, { id: 'day-2', dayLabel: 'Day 2', date: '2月11日', locationLabel: '', attractions: [], advice: { clothing: '', snowCondition: '' } });
    await itineraryStore.setItem(`${T}_day-3`, { id: 'day-3', dayLabel: 'Day 3', date: '2月12日', locationLabel: '', attractions: [], advice: { clothing: '', snowCondition: '' } });
    // 舊版記帳：amountJPY 實際是當時旅行幣別金額、沒有 currency 與 createdAt
    await expenseStore.setItem(`${T}_e1`, { id: 'e1', description: '拉麵', amountJPY: 1200, category: '飲食', dateISO: '2026-02-10', paidBy: '自己' });
    await expenseStore.setItem(`${T}_e2`, { id: 'e2', description: '計程車', amountJPY: 3400, category: '交通', dateISO: '2026-02-11', paidBy: '小明' });
    await checklistStore.setItem(`${T}_c1`, { id: 'c1', text: '護照 (檢查效期過期沒)', category: '重要文件', isPacked: true });
    await checklistStore.setItem(`${T}_c2`, { id: 'c2', text: '我自己加的暖暖包', category: '其他', isPacked: false });
    await albumStore.setItem(`${T}_albums`, [{ dayId: 'day-1', url: 'https://photos.app.goo.gl/abc' }]);
    await ticketStore.setItem(`${T}_k1`, { id: 'k1', title: '星宇 JX800', type: 'flight', textPayload: '2 航廈', addedAt: 1769000000001 });
}

describe('儲存位置與鍵名沒有被改動', () => {
    it('資料庫名稱與六個 storeName 與舊版完全相同', () => {
        const expected: [typeof configStore, string][] = [
            [configStore, 'config'],
            [itineraryStore, 'itinerary'],
            [ticketStore, 'tickets'],
            [expenseStore, 'expenses'],
            [checklistStore, 'checklists'],
            [albumStore, 'albums'],
        ];
        for (const [store, name] of expected) {
            expect(store.config().name).toBe('hokkaido_app');
            expect(store.config().storeName).toBe(name);
        }
    });
});

describe('舊版資料讀得出來、一筆不少', () => {
    it('行程庫與目前開啟的行程', async () => {
        await seedOldVersionData();
        const { result } = renderHook(() => useTripManager());
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.trips).toHaveLength(1);
        expect(result.current.trips[0].name).toBe('北海道 2026');
        expect(result.current.activeTripId).toBe(T);
    });

    it('旅程設定：舊欄位保留，新欄位補上預設值，單一住宿地址轉成住宿清單', async () => {
        await seedOldVersionData();
        const { result } = renderHook(() => useConfigStore(T));
        await waitFor(() => expect(result.current.loading).toBe(false));
        const c = result.current.config;
        expect(c.tripName).toBe('北海道 2026');
        expect(c.location).toBe('Sapporo, Japan');
        expect(c.startDate).toBe('2026-02-10');
        expect(c.travelers).toBe(1);
        expect(c.tripCurrency).toBe('JPY');
        expect(c.baseCurrency).toBe('TWD');
        expect(c.accommodations?.[0].address).toBe('札幌市中央區大通西1丁目');
    });

    it('行程：景點、時段、方案、停留時間完整保留，且沒有被改寫或丟失', async () => {
        await seedOldVersionData();
        const before = JSON.stringify(await itineraryStore.getItem(`${T}_day-1`));
        const { result } = renderHook(() => useItinerary(T));
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.days.map((d) => d.id)).toEqual(['day-1', 'day-2', 'day-3']);
        const a = result.current.days[0].attractions;
        expect(a.map((x) => x.name)).toEqual(['[09:00] 新千歲機場', '午餐']);
        expect(a[1]).toMatchObject({ planVariant: '男生行程', durationMinutes: 90, tags: ['必吃'], description: '湯咖哩\n📝 記得預約' });
        // 讀取不會改寫儲存內容
        expect(JSON.stringify(await itineraryStore.getItem(`${T}_day-1`))).toBe(before);
    });

    it('記帳：舊紀錄沒有 currency 也能讀，金額不變', async () => {
        await seedOldVersionData();
        const { result } = renderHook(() => useExpenseStore(T));
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.expenses).toHaveLength(2);
        expect(result.current.expenses.map((e) => e.amountJPY).sort()).toEqual([1200, 3400]);
        expect(result.current.expenses[0].dateISO).toBe('2026-02-11'); // 新的在前
    });

    it('行李清單：舊項目與勾選狀態保留，不會又被塞回預設清單', async () => {
        await seedOldVersionData();
        const { result } = renderHook(() => useChecklistStore(T));
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.items).toHaveLength(2);
        expect(result.current.items.find((i) => i.id === 'c1')?.isPacked).toBe(true);
        expect(result.current.items.find((i) => i.text === '我自己加的暖暖包')).toBeTruthy();
    });

    it('使用者把清單全刪光後，不會再被預設項目填回來', async () => {
        const { result } = renderHook(() => useChecklistStore('trip_fresh'));
        await waitFor(() => expect(result.current.items.length).toBeGreaterThan(0));
        const ids = result.current.items.map((i) => i.id);
        for (const id of ids) await act(async () => result.current.removeItem(id));
        expect(result.current.items).toHaveLength(0);
        const again = renderHook(() => useChecklistStore('trip_fresh'));
        await waitFor(() => expect(again.result.current.loading).toBe(false));
        expect(again.result.current.items).toHaveLength(0);
    });

    it('相簿連結與票券', async () => {
        await seedOldVersionData();
        const album = renderHook(() => usePhotoAlbum(T));
        await waitFor(() => expect(album.result.current.loading).toBe(false));
        expect(album.result.current.getUrlForDay('day-1')).toBe('https://photos.app.goo.gl/abc');
        const tk = renderHook(() => useTicketStore(T));
        await waitFor(() => expect(tk.result.current.loading).toBe(false));
        expect(tk.result.current.tickets[0]).toMatchObject({ title: '星宇 JX800', textPayload: '2 航廈' });
    });

    it('新版寫入後，舊欄位仍在（沒有欄位被洗掉）', async () => {
        await seedOldVersionData();
        const { result } = renderHook(() => useConfigStore(T));
        await waitFor(() => expect(result.current.loading).toBe(false));
        await act(async () => result.current.updateConfig({ travelers: 3 }));
        const raw = await configStore.getItem<Record<string, unknown>>(`${T}_app_config`);
        expect(raw).toMatchObject({ tripName: '北海道 2026', location: 'Sapporo, Japan', startDate: '2026-02-10', endDate: '2026-02-12', accommodationAddress: '札幌市中央區大通西1丁目', travelers: 3 });
    });
});
