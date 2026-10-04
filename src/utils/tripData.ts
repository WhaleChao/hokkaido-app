import { configStore, itineraryStore, ticketStore, expenseStore, checklistStore, albumStore } from '../db';
import { normalizeConfig, type AppConfig } from '../data/config';
import { type DayItinerary } from '../data/itinerary';
import { emitData } from './bus';
import { legacyDayLabel, addDaysISO, tripDayCount } from './date';

export interface TripMeta {
    id: string;
    name: string;
    createdAt: number;
}

export const MAX_ORDER_DAYS = 366;

// ---------- 小工具 ----------

const locks = new Map<string, Promise<unknown>>();

/** 同一個行程的讀改寫排隊執行，避免兩個連續操作互相用舊資料覆蓋。 */
export function withLock<T>(tripId: string, fn: () => Promise<T>): Promise<T> {
    const prev = locks.get(tripId) ?? Promise.resolve();
    const next = prev.then(fn, fn);
    locks.set(
        tripId,
        next.catch(() => undefined),
    );
    return next;
}

export function dayIdFor(index: number): string {
    return `day-${index + 1}`;
}

export function emptyDay(id: string, index: number, startDate: string, location: string): DayItinerary {
    const date = addDaysISO(startDate, index);
    return {
        id,
        dayLabel: `第 ${index + 1} 天`,
        date: date ? legacyDayLabel(date) : `第 ${index + 1} 天`,
        locationLabel: location || '',
        attractions: [],
        advice: { clothing: '', snowCondition: '' },
    };
}

/**
 * 依天數整理「天」的順序，並盡量保留使用者既有的順序與 id。
 * 天數變多：在尾端補新的 id；天數變少：只截斷順序（每天的資料仍留在儲存庫，不會被刪）。
 */
export function reconcileOrder(existing: string[] | null | undefined, expected: number): string[] {
    const count = Math.max(0, Math.min(expected, MAX_ORDER_DAYS));
    const base = Array.isArray(existing) ? existing.filter((x): x is string => typeof x === 'string') : [];
    if (base.length >= count) return base.slice(0, count);
    const used = new Set(base);
    const out = [...base];
    let n = 1;
    while (out.length < count) {
        const id = dayIdFor(n - 1);
        n++;
        if (!used.has(id)) {
            used.add(id);
            out.push(id);
        }
    }
    return out;
}

// ---------- 設定 ----------

export async function readConfig(tripId: string): Promise<AppConfig | null> {
    const raw = await configStore.getItem<unknown>(`${tripId}_app_config`);
    return raw ? normalizeConfig(raw) : null;
}

export async function patchConfig(tripId: string, patch: Partial<AppConfig>): Promise<AppConfig> {
    return withLock(tripId, async () => {
        const current = (await readConfig(tripId)) ?? normalizeConfig({});
        const next = normalizeConfig({ ...current, ...patch });
        await configStore.setItem(`${tripId}_app_config`, next);
        emitData('config');
        return next;
    });
}

// ---------- 行程（每天） ----------

export async function readDays(tripId: string): Promise<DayItinerary[]> {
    const order = await itineraryStore.getItem<string[]>(`${tripId}_dayOrder`);
    if (!order) return [];
    const days: DayItinerary[] = [];
    for (const id of order) {
        const d = await itineraryStore.getItem<DayItinerary>(`${tripId}_${id}`);
        if (d) days.push({ ...d, attractions: Array.isArray(d.attractions) ? d.attractions : [] });
    }
    return days;
}

/** 依設定的日期補齊／整理每天資料。日期無效時不動既有資料，直接回傳現有內容。 */
export async function ensureDays(tripId: string): Promise<DayItinerary[]> {
    return withLock(tripId, async () => {
        const config = await readConfig(tripId);
        const existingOrder = await itineraryStore.getItem<string[]>(`${tripId}_dayOrder`);
        const expected = config ? tripDayCount(config.startDate, config.endDate) : null;
        if (!config || expected === null) {
            // 日期有問題：保留現有資料，不要重建
            return readDays(tripId);
        }
        const order = reconcileOrder(existingOrder, expected);
        if (!existingOrder || order.length !== existingOrder.length || order.some((id, i) => id !== existingOrder[i])) {
            await itineraryStore.setItem(`${tripId}_dayOrder`, order);
        }
        for (let i = 0; i < order.length; i++) {
            const key = `${tripId}_${order[i]}`;
            if (!(await itineraryStore.getItem(key))) {
                await itineraryStore.setItem(key, emptyDay(order[i], i, config.startDate, config.location));
            }
        }
        return readDays(tripId);
    });
}

/** 以「最新儲存的內容」為基礎修改某一天，避免用畫面上舊的資料覆蓋。 */
export async function updateDay(tripId: string, dayId: string, fn: (d: DayItinerary) => DayItinerary): Promise<DayItinerary> {
    return withLock(tripId, async () => {
        const key = `${tripId}_${dayId}`;
        const current = await itineraryStore.getItem<DayItinerary>(key);
        if (!current) throw new Error('找不到這一天的資料，請回到行程頁重新整理');
        const next = fn({ ...current, attractions: Array.isArray(current.attractions) ? current.attractions : [] });
        await itineraryStore.setItem(key, next);
        emitData('itinerary');
        return next;
    });
}

export async function writeDays(tripId: string, days: DayItinerary[], order?: string[]): Promise<void> {
    return withLock(tripId, async () => {
        for (const d of days) await itineraryStore.setItem(`${tripId}_${d.id}`, d);
        if (order) await itineraryStore.setItem(`${tripId}_dayOrder`, order);
        emitData('itinerary');
    });
}

// ---------- 還原點（匯入前自動備份） ----------

export interface ItinerarySnapshot {
    at: number;
    reason: string;
    config?: AppConfig;
    dayOrder: string[];
    days: DayItinerary[];
}

const snapshotKey = (tripId: string) => `${tripId}_itinerary_backup`;

export async function takeSnapshot(tripId: string, reason: string): Promise<void> {
    const days = await readDays(tripId);
    const order = (await itineraryStore.getItem<string[]>(`${tripId}_dayOrder`)) ?? [];
    const config = await readConfig(tripId);
    const snap: ItinerarySnapshot = { at: Date.now(), reason, config: config ?? undefined, dayOrder: order, days };
    await configStore.setItem(snapshotKey(tripId), snap);
}

export async function readSnapshot(tripId: string): Promise<ItinerarySnapshot | null> {
    const s = await configStore.getItem<ItinerarySnapshot>(snapshotKey(tripId));
    return s && Array.isArray(s.days) && Array.isArray(s.dayOrder) ? s : null;
}

/** 還原後，把「還原前」的狀態存成新的還原點，所以再按一次可以換回來。 */
export async function restoreSnapshot(tripId: string): Promise<boolean> {
    const snap = await readSnapshot(tripId);
    if (!snap) return false;
    await takeSnapshot(tripId, '還原前自動保存');
    await withLock(tripId, async () => {
        if (snap.config) await configStore.setItem(`${tripId}_app_config`, snap.config);
        for (const d of snap.days) await itineraryStore.setItem(`${tripId}_${d.id}`, d);
        await itineraryStore.setItem(`${tripId}_dayOrder`, snap.dayOrder);
    });
    emitData('config');
    emitData('itinerary');
    return true;
}

// ---------- 行程庫 ----------

export async function readTrips(): Promise<TripMeta[]> {
    const list = await configStore.getItem<TripMeta[]>('trips_list');
    return Array.isArray(list) ? list.filter((t) => t && typeof t.id === 'string') : [];
}

export async function writeTrips(trips: TripMeta[]): Promise<void> {
    await configStore.setItem('trips_list', trips);
    emitData('trips');
}

/** 從舊版（V1，沒有多行程）搬到 trip_legacy。先全部複製、最後才寫入行程清單並刪舊鍵，中途失敗可重跑。 */
export async function migrateLegacyData(): Promise<string | null> {
    const legacyConfig = await configStore.getItem<Record<string, unknown>>('app_config');
    if (!legacyConfig) return null;
    const id = 'trip_legacy';

    await configStore.setItem(`${id}_app_config`, legacyConfig);

    const dayOrder = await itineraryStore.getItem<string[]>('dayOrder');
    const movedDays: string[] = [];
    if (dayOrder) {
        await itineraryStore.setItem(`${id}_dayOrder`, dayOrder);
        for (const dtId of dayOrder) {
            const day = await itineraryStore.getItem<unknown>(dtId);
            if (day) {
                await itineraryStore.setItem(`${id}_${dtId}`, day);
                movedDays.push(dtId);
            }
        }
    }

    const movedTickets: string[] = [];
    for (const key of await ticketStore.keys()) {
        if (key.startsWith('trip_')) continue; // 已經是新格式
        const t = await ticketStore.getItem<unknown>(key);
        if (t) {
            await ticketStore.setItem(`${id}_${key}`, t);
            movedTickets.push(key);
        }
    }

    const name = typeof legacyConfig.tripName === 'string' && legacyConfig.tripName ? legacyConfig.tripName : '我的日本自由行';
    await writeTrips([{ id, name, createdAt: Date.now() }]);
    await configStore.setItem('active_trip_id', id);

    // 複製與清單都成功了才清掉舊鍵
    await configStore.removeItem('app_config');
    if (dayOrder) {
        for (const dtId of movedDays) await itineraryStore.removeItem(dtId);
        await itineraryStore.removeItem('dayOrder');
    }
    for (const key of movedTickets) await ticketStore.removeItem(key);
    return id;
}

/** 行程清單遺失（但各行程的設定還在）時，從設定鍵重建清單，避免資料「看起來消失」。 */
export async function recoverTripsList(): Promise<TripMeta[]> {
    const keys = await configStore.keys();
    const found: TripMeta[] = [];
    for (const k of keys) {
        const m = /^(trip_[A-Za-z0-9]+)_app_config$/.exec(k);
        if (!m) continue;
        const cfg = await readConfig(m[1]);
        const ts = Number(m[1].slice(5));
        found.push({ id: m[1], name: cfg?.tripName || '未命名旅程', createdAt: Number.isFinite(ts) && ts > 0 ? ts : Date.now() });
    }
    found.sort((a, b) => a.createdAt - b.createdAt);
    if (found.length > 0) await writeTrips(found);
    return found;
}

export async function loadTripsWithMigration(): Promise<TripMeta[]> {
    let trips = await readTrips();
    if (trips.length === 0) {
        const legacy = await migrateLegacyData();
        if (legacy) trips = await readTrips();
        else trips = await recoverTripsList();
    }
    return trips;
}

export async function createTripRecord(name: string, startDate: string, endDate: string, location = ''): Promise<TripMeta> {
    const trips = await readTrips();
    // 同一毫秒內連點兩次不能產生同一個 id（會讓兩趟旅程共用資料）
    const used = new Set(trips.map((t) => t.id));
    let ts = Date.now();
    while (used.has(`trip_${ts}`)) ts++;
    const meta: TripMeta = { id: `trip_${ts}`, name, createdAt: ts };
    await configStore.setItem(`${meta.id}_app_config`, {
        tripName: name,
        location,
        startDate,
        endDate,
        accommodationAddress: '',
        accommodations: [],
        travelers: 1,
        baseCurrency: 'TWD',
        tripCurrency: 'JPY',
        defaultRegion: '',
    } satisfies AppConfig);
    await writeTrips([...trips, meta]);
    return meta;
}

type AnyStore = typeof itineraryStore;

async function removeByPrefix(store: AnyStore, prefix: string): Promise<void> {
    for (const k of await store.keys()) {
        if (k.startsWith(prefix)) await store.removeItem(k);
    }
}

/** 刪除行程的「全部」資料（包含記帳、清單、相簿、票夾與還原點），不留孤兒資料。 */
export async function purgeTripData(tripId: string): Promise<void> {
    const prefix = `${tripId}_`;
    await configStore.removeItem(`${tripId}_app_config`); // 先刪設定，中途失敗也不會被「重建清單」救回來
    await removeByPrefix(configStore, prefix);
    await removeByPrefix(itineraryStore, prefix);
    await removeByPrefix(ticketStore, prefix);
    await removeByPrefix(expenseStore, prefix);
    await removeByPrefix(checklistStore, prefix);
    await removeByPrefix(albumStore, prefix);
}

export async function deleteTripRecord(tripId: string): Promise<TripMeta[]> {
    const trips = (await readTrips()).filter((t) => t.id !== tripId);
    await writeTrips(trips);
    await purgeTripData(tripId);
    return trips;
}
