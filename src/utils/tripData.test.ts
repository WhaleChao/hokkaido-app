import { describe, it, expect, beforeEach } from 'vitest';
import { configStore, itineraryStore, ticketStore, expenseStore, checklistStore, albumStore } from '../db';
import { reconcileOrder, ensureDays, updateDay, patchConfig, readDays, migrateLegacyData, recoverTripsList, loadTripsWithMigration, purgeTripData, deleteTripRecord, createTripRecord, takeSnapshot, restoreSnapshot, readSnapshot, readTrips, withLock } from './tripData';
import { resetAll } from '../test/helpers';
import { type DayItinerary } from '../data/itinerary';

beforeEach(resetAll);

const mkDay = (id: string, names: string[]): DayItinerary => ({
    id,
    dayLabel: id,
    date: '2/10',
    locationLabel: '',
    attractions: names.map((n) => ({ id: `${id}-${n}`, name: n, category: '景點', description: '', tags: [], mapQuery: n })),
    advice: { clothing: '', snowCondition: '' },
});

describe('行程順序整理', () => {
    it('沒有舊順序：產生 day-1…day-N', () => {
        expect(reconcileOrder(null, 3)).toEqual(['day-1', 'day-2', 'day-3']);
    });
    it('保留使用者既有的 id 與順序（舊版匯入的 day1、day2…不會被換掉）', () => {
        expect(reconcileOrder(['day1', 'day2', 'day3'], 3)).toEqual(['day1', 'day2', 'day3']);
        expect(reconcileOrder(['day1', 'day2', 'day3'], 5)).toEqual(['day1', 'day2', 'day3', 'day-1', 'day-2']);
        expect(reconcileOrder(['a', 'b', 'c'], 2)).toEqual(['a', 'b']);
    });
    it('新增 id 不會與既有的重複', () => {
        expect(reconcileOrder(['day-1', 'x'], 4)).toEqual(['day-1', 'x', 'day-2', 'day-3']);
    });
});

describe('補齊每天資料', () => {
    it('依日期建立每天；日期有誤時不動既有資料', async () => {
        const { id } = await createTripRecord('T', '2026-02-10', '2026-02-12');
        const days = await ensureDays(id);
        expect(days.map((d) => d.id)).toEqual(['day-1', 'day-2', 'day-3']);
        expect(days[0].date).toBe('2月10日');

        await updateDay(id, 'day-1', (d) => ({ ...d, attractions: [{ id: 'x', name: '保留我', category: '景點', description: '', tags: [], mapQuery: '' }] }));
        await patchConfig(id, { startDate: '2026-02-12', endDate: '2026-02-10' }); // 顛倒
        const after = await ensureDays(id);
        expect(after).toHaveLength(3);
        expect(after[0].attractions[0].name).toBe('保留我');
    });

    it('縮短日期只隱藏後面幾天，資料仍在；改回來就再出現', async () => {
        const { id } = await createTripRecord('T', '2026-02-10', '2026-02-12');
        await ensureDays(id);
        await updateDay(id, 'day-3', (d) => ({ ...d, attractions: [{ id: 'k', name: '第三天景點', category: '景點', description: '', tags: [], mapQuery: '' }] }));
        await patchConfig(id, { endDate: '2026-02-11' });
        expect(await ensureDays(id)).toHaveLength(2);
        expect(await itineraryStore.getItem(`${id}_day-3`)).not.toBeNull();
        await patchConfig(id, { endDate: '2026-02-12' });
        expect((await ensureDays(id))[2].attractions[0].name).toBe('第三天景點');
    });

    it('updateDay 以最新儲存內容為基礎，連續兩次修改不會互相覆蓋', async () => {
        const { id } = await createTripRecord('T', '2026-02-10', '2026-02-10');
        await ensureDays(id);
        const add = (name: string) => updateDay(id, 'day-1', (d) => ({ ...d, attractions: [...d.attractions, { id: name, name, category: '景點', description: '', tags: [], mapQuery: '' }] }));
        await Promise.all([add('A'), add('B'), add('C')]);
        expect((await readDays(id))[0].attractions.map((a) => a.name).sort()).toEqual(['A', 'B', 'C']);
    });

    it('withLock 讓同一行程的操作依序執行', async () => {
        const order: number[] = [];
        await Promise.all([
            withLock('t', async () => {
                await new Promise((r) => setTimeout(r, 15));
                order.push(1);
            }),
            withLock('t', async () => {
                order.push(2);
            }),
        ]);
        expect(order).toEqual([1, 2]);
    });
});

describe('舊版（V1）資料搬遷', () => {
    async function seedLegacy() {
        await configStore.setItem('app_config', { tripName: '北海道', location: 'Sapporo, Japan', startDate: '2026-02-10', endDate: '2026-02-12', accommodationAddress: '札幌市中央區大通西1丁目' });
        await itineraryStore.setItem('dayOrder', ['day1', 'day2', 'day3']);
        for (const d of ['day1', 'day2', 'day3']) await itineraryStore.setItem(d, mkDay(d, [`${d}景點`]));
        await ticketStore.setItem('tk1', { id: 'tk1', title: '舊票', type: 'transit', addedAt: 1 });
    }

    it('搬到 trip_legacy，行程、設定、票券完整保留，舊鍵清除', async () => {
        await seedLegacy();
        const trips = await loadTripsWithMigration();
        expect(trips).toHaveLength(1);
        expect(trips[0].id).toBe('trip_legacy');
        expect(trips[0].name).toBe('北海道');
        const days = await ensureDays('trip_legacy');
        expect(days.map((d) => d.id)).toEqual(['day1', 'day2', 'day3']); // 舊 id 不被換成 day-1
        expect(days.map((d) => d.attractions[0].name)).toEqual(['day1景點', 'day2景點', 'day3景點']);
        expect(await ticketStore.getItem('trip_legacy_tk1')).not.toBeNull();
        expect(await configStore.getItem('app_config')).toBeNull();
        expect(await itineraryStore.getItem('day1')).toBeNull();
        expect(await ticketStore.getItem('tk1')).toBeNull();
        expect(await configStore.getItem('active_trip_id')).toBe('trip_legacy');
    });

    it('搬遷可重跑：中途失敗後再次啟動不會丟資料', async () => {
        await seedLegacy();
        await migrateLegacyData();
        // 模擬重跑：舊鍵已清除，再跑一次不應出錯也不應重複
        expect(await migrateLegacyData()).toBeNull();
        expect(await readTrips()).toHaveLength(1);
    });

    it('舊版單一住宿地址會轉成住宿清單', async () => {
        await seedLegacy();
        await loadTripsWithMigration();
        const { readConfig } = await import('./tripData');
        const c = await readConfig('trip_legacy');
        expect(c?.accommodations?.[0].address).toBe('札幌市中央區大通西1丁目');
    });
});

describe('行程清單遺失時的復原', () => {
    it('trips_list 不見但各行程設定還在：自動重建，資料不會「看起來消失」', async () => {
        const a = await createTripRecord('甲', '2026-02-10', '2026-02-12');
        await new Promise((r) => setTimeout(r, 3));
        const b = await createTripRecord('乙', '2026-03-01', '2026-03-02');
        await configStore.removeItem('trips_list');
        const trips = await recoverTripsList();
        expect(trips.map((t) => t.id)).toEqual([a.id, b.id]);
        expect(trips[0].name).toBe('甲');
    });
});

describe('刪除行程不留孤兒資料', () => {
    it('六個儲存庫與還原點全部清乾淨，別的行程不受影響', async () => {
        const a = await createTripRecord('甲', '2026-02-10', '2026-02-11');
        const b = await createTripRecord('乙', '2026-02-10', '2026-02-11');
        for (const t of [a.id, b.id]) {
            await ensureDays(t);
            await expenseStore.setItem(`${t}_e1`, { id: 'e1' });
            await checklistStore.setItem(`${t}_c1`, { id: 'c1' });
            await albumStore.setItem(`${t}_albums`, []);
            await ticketStore.setItem(`${t}_k1`, { id: 'k1' });
            await takeSnapshot(t, 'x');
        }
        const left = await deleteTripRecord(a.id);
        expect(left.map((t) => t.id)).toEqual([b.id]);
        for (const store of [configStore, itineraryStore, ticketStore, expenseStore, checklistStore, albumStore]) {
            expect((await store.keys()).filter((k) => k.startsWith(`${a.id}_`))).toEqual([]);
        }
        expect(await expenseStore.getItem(`${b.id}_e1`)).not.toBeNull();
        expect(await readSnapshot(b.id)).not.toBeNull();
        await purgeTripData('nonexistent'); // 不存在也不出錯
    });
});

describe('還原點', () => {
    it('還原後可以再換回來', async () => {
        const { id } = await createTripRecord('T', '2026-02-10', '2026-02-10');
        await ensureDays(id);
        await updateDay(id, 'day-1', (d) => ({ ...d, attractions: [{ id: 'o', name: '原本', category: '景點', description: '', tags: [], mapQuery: '' }] }));
        await takeSnapshot(id, '匯入前');
        await updateDay(id, 'day-1', (d) => ({ ...d, attractions: [] }));
        expect((await readDays(id))[0].attractions).toHaveLength(0);
        expect(await restoreSnapshot(id)).toBe(true);
        expect((await readDays(id))[0].attractions[0].name).toBe('原本');
        expect(await restoreSnapshot(id)).toBe(true); // 換回去
        expect((await readDays(id))[0].attractions).toHaveLength(0);
    });
});
