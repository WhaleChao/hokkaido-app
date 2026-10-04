import { configStore, itineraryStore, ticketStore } from '../db';
import { normalizeConfig, type AppConfig } from '../data/config';
import { type DayItinerary, type Attraction, type Category, type Tag, type TimeSlot, type SubOption } from '../data/itinerary';
import { type Ticket, type TicketType } from '../hooks/useTicketStore';
import { readDays, takeSnapshot, writeDays, withLock } from './tripData';
import { emitData } from './bus';

// 行程分享碼格式與舊版相同（base64(encodeURIComponent(JSON))），朋友手上舊版產生的碼仍可匯入。

const CATEGORIES: Category[] = ['食物', '活動', '購物', '景點', '酒店', '交通'];
const TAGS: Tag[] = ['必吃', '必買', '必拍', '正選', '備選'];
const SLOTS: TimeSlot[] = ['早餐', '午餐', '晚餐', '無', ''];
const TICKET_TYPES: TicketType[] = ['transit', 'flight', 'other'];
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_DAYS = 366;
const MAX_ATTRACTIONS = 500;
const MAX_IMAGE_CHARS = 4_000_000;

export interface SharedTicket {
    id: string;
    title: string;
    type: TicketType;
    textPayload?: string;
    publicTutorialBase64?: string;
    addedAt: number;
}

export interface SharePayload {
    config: AppConfig;
    dayOrder: string[];
    days: DayItinerary[];
    tickets: SharedTicket[];
}

export class ShareError extends Error {}

const s = (v: unknown, max = 5000): string => (typeof v === 'string' ? v.slice(0, max) : '');
const opt = (v: unknown, max = 5000): string | undefined => (typeof v === 'string' && v ? v.slice(0, max) : undefined);

function sanitizeSubOptions(v: unknown): SubOption[] | undefined {
    if (!Array.isArray(v) || v.length === 0) return undefined;
    return v
        .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
        .slice(0, 26)
        .map((x) => ({ label: s(x.label, 40), name: s(x.name, 300), description: s(x.description), mapQuery: s(x.mapQuery, 300) }));
}

export function sanitizeAttraction(raw: unknown): Attraction | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    if (typeof r.id !== 'string' || !r.id || typeof r.name !== 'string') return null;
    const td = r.transitDetails && typeof r.transitDetails === 'object' ? (r.transitDetails as Record<string, unknown>) : null;
    const a: Attraction = {
        id: r.id.slice(0, 80),
        name: s(r.name, 300),
        category: CATEGORIES.includes(r.category as Category) ? (r.category as Category) : '景點',
        description: s(r.description),
        tags: Array.isArray(r.tags) ? (r.tags.filter((t) => TAGS.includes(t as Tag)) as Tag[]) : [],
        mapQuery: s(r.mapQuery, 300),
    };
    if (SLOTS.includes(r.timeSlot as TimeSlot) && r.timeSlot) a.timeSlot = r.timeSlot as TimeSlot;
    if (opt(r.startTime, 10)) a.startTime = opt(r.startTime, 10);
    if (opt(r.planVariant, 60)) a.planVariant = opt(r.planVariant, 60);
    if (r.isBackup === true) a.isBackup = true;
    if (typeof r.durationMinutes === 'number' && r.durationMinutes > 0 && r.durationMinutes < 10000) a.durationMinutes = r.durationMinutes;
    if (opt(r.parkingInfo)) a.parkingInfo = opt(r.parkingInfo);
    if (opt(r.gasInfo)) a.gasInfo = opt(r.gasInfo);
    if (opt(r.photoTip)) a.photoTip = opt(r.photoTip);
    if (r.hasPhotoUpload === true) a.hasPhotoUpload = true;
    if (td) {
        a.transitDetails = { mode: opt(td.mode, 100), line: opt(td.line, 200), platform: opt(td.platform, 100), exit: opt(td.exit, 100), cost: opt(td.cost, 100) };
    }
    const subs = sanitizeSubOptions(r.subOptions);
    if (subs) a.subOptions = subs;
    return a;
}

export function sanitizeDay(raw: unknown): DayItinerary | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    if (typeof r.id !== 'string' || !ID_RE.test(r.id)) return null;
    const adv = r.advice && typeof r.advice === 'object' ? (r.advice as Record<string, unknown>) : {};
    const attractions = (Array.isArray(r.attractions) ? r.attractions : [])
        .slice(0, MAX_ATTRACTIONS)
        .map(sanitizeAttraction)
        .filter((a): a is Attraction => a !== null);
    return {
        id: r.id,
        dayLabel: s(r.dayLabel, 40),
        date: s(r.date, 40),
        locationLabel: s(r.locationLabel, 200),
        attractions,
        advice: { clothing: s(adv.clothing, 1000), snowCondition: s(adv.snowCondition, 1000) },
    };
}

export function decodeShareCode(code: string): unknown {
    const cleaned = code.replace(/\s+/g, '');
    if (!cleaned) throw new ShareError('請先貼上行程分享碼');
    try {
        return JSON.parse(decodeURIComponent(atob(cleaned)));
    } catch {
        throw new ShareError('分享碼讀不出來，可能複製得不完整，請請朋友重新傳一次');
    }
}

export function parseShareCode(code: string): SharePayload {
    const raw = decodeShareCode(code);
    if (!raw || typeof raw !== 'object') throw new ShareError('這不是行程分享碼');
    const p = raw as Record<string, unknown>;
    if (!p.config || typeof p.config !== 'object' || !Array.isArray(p.dayOrder) || !Array.isArray(p.days)) {
        throw new ShareError('這不是行程分享碼（缺少行程內容）');
    }
    if (p.days.length > MAX_DAYS) throw new ShareError('分享碼內的天數太多，無法匯入');
    const days = p.days.map(sanitizeDay).filter((d): d is DayItinerary => d !== null);
    if (days.length === 0) throw new ShareError('分享碼裡沒有任何一天的行程');
    const ids = new Set(days.map((d) => d.id));
    const dayOrder = p.dayOrder.filter((x): x is string => typeof x === 'string' && ids.has(x));
    if (dayOrder.length === 0) throw new ShareError('分享碼內的天數順序有誤，無法匯入');

    const tickets: SharedTicket[] = [];
    if (Array.isArray(p.tickets)) {
        for (const t of p.tickets) {
            if (!t || typeof t !== 'object') continue;
            const x = t as Record<string, unknown>;
            if (typeof x.id !== 'string' || !ID_RE.test(x.id) || typeof x.title !== 'string') continue;
            const img =
                typeof x.publicTutorialBase64 === 'string' && /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(x.publicTutorialBase64) && x.publicTutorialBase64.length <= MAX_IMAGE_CHARS
                    ? x.publicTutorialBase64
                    : undefined;
            tickets.push({
                id: x.id,
                title: s(x.title, 200),
                type: TICKET_TYPES.includes(x.type as TicketType) ? (x.type as TicketType) : 'other',
                textPayload: opt(x.textPayload, 2000),
                publicTutorialBase64: img,
                addedAt: typeof x.addedAt === 'number' ? x.addedAt : Date.now(),
            });
        }
    }
    return { config: normalizeConfig(p.config), dayOrder, days, tickets };
}

export async function exportTripData(tripId: string): Promise<string> {
    if (!tripId) throw new Error('目前沒有選擇行程');
    try {
        const config = await configStore.getItem<unknown>(`${tripId}_app_config`);
        const dayOrder = (await itineraryStore.getItem<string[]>(`${tripId}_dayOrder`)) ?? [];
        const days = await readDays(tripId);

        // 只匯出「可公開」的票券內容：標題、文字備註、換票教學圖。私密 QR（privateImageBlob）絕不匯出。
        const tickets: SharedTicket[] = [];
        for (const key of (await ticketStore.keys()).filter((k) => k.startsWith(`${tripId}_`))) {
            const t = await ticketStore.getItem<Ticket>(key);
            if (t) {
                tickets.push({ id: t.id, title: t.title, type: t.type, textPayload: t.textPayload, publicTutorialBase64: t.publicTutorialBase64, addedAt: t.addedAt });
            }
        }
        return btoa(encodeURIComponent(JSON.stringify({ config, dayOrder, days, tickets })));
    } catch (e) {
        throw new Error(`匯出失敗：${e instanceof Error ? e.message : '請再試一次'}`);
    }
}

export function base64ToBlob(dataUrl: string): Blob {
    const comma = dataUrl.indexOf(',');
    const mime = /^data:([^;]+);/.exec(dataUrl)?.[1] ?? 'image/jpeg';
    const bin = atob(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
}

export interface ImportSummary {
    days: number;
    attractions: number;
    tickets: number;
}

/** 匯入前先驗證格式、並自動建立還原點；任何一步失敗都不會留下半套資料。 */
export async function importTripData(tripId: string, code: string): Promise<ImportSummary> {
    if (!tripId) throw new ShareError('目前沒有選擇行程');
    const payload = parseShareCode(code); // 先驗證（還沒動任何資料）
    await takeSnapshot(tripId, '匯入朋友的行程前自動保存');
    await withLock(tripId, async () => {
        await configStore.setItem(`${tripId}_app_config`, payload.config);
    });
    await writeDays(tripId, payload.days, payload.dayOrder);
    for (const t of payload.tickets) {
        const ticket: Ticket = {
            id: t.id,
            title: t.title,
            type: t.type,
            textPayload: t.textPayload,
            addedAt: t.addedAt,
            publicTutorialBlob: t.publicTutorialBase64 ? base64ToBlob(t.publicTutorialBase64) : undefined,
            publicTutorialBase64: t.publicTutorialBase64,
        };
        await ticketStore.setItem(`${tripId}_${ticket.id}`, ticket);
    }
    emitData('config');
    return {
        days: payload.days.length,
        attractions: payload.days.reduce((n, d) => n + d.attractions.length, 0),
        tickets: payload.tickets.length,
    };
}
