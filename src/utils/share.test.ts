import { describe, it, expect, beforeEach } from 'vitest';
import { ticketStore } from '../db';
import { exportTripData, importTripData, parseShareCode, ShareError, sanitizeAttraction } from './share';
import { createTripRecord, ensureDays, updateDay, readDays, readSnapshot, readConfig } from './tripData';
import { resetAll } from '../test/helpers';

beforeEach(resetAll);

const enc = (o: unknown) => btoa(encodeURIComponent(JSON.stringify(o)));

async function tripWithData(name = '甲') {
    const { id } = await createTripRecord(name, '2026-02-10', '2026-02-11');
    await ensureDays(id);
    await updateDay(id, 'day-1', (d) => ({ ...d, attractions: [{ id: 'a1', name: '小樽運河', category: '景點', description: '好看', tags: ['必拍'], mapQuery: '小樽運河', durationMinutes: 60 }] }));
    return id;
}

describe('行程分享碼', () => {
    it('匯出再匯入：行程內容一致', async () => {
        const src = await tripWithData();
        const code = await exportTripData(src);
        const dst = (await createTripRecord('乙', '2026-05-01', '2026-05-01')).id;
        await ensureDays(dst);
        const sum = await importTripData(dst, code);
        expect(sum.days).toBe(2);
        expect(sum.attractions).toBe(1);
        const days = await readDays(dst);
        expect(days[0].attractions[0].name).toBe('小樽運河');
        expect((await readConfig(dst))?.startDate).toBe('2026-02-10');
    });

    it('私密票券圖片（privateImageBlob）絕不會被匯出', async () => {
        const src = await tripWithData();
        await ticketStore.setItem(`${src}_t1`, { id: 't1', title: '航班', type: 'flight', textPayload: '2 航廈', addedAt: 1, privateImageBlob: new Blob(['SECRET-QR'], { type: 'image/png' }), publicTutorialBase64: 'data:image/png;base64,AAAA' });
        const code = await exportTripData(src);
        const decoded = decodeURIComponent(atob(code));
        expect(decoded).not.toMatch(/SECRET-QR|privateImageBlob/);
        expect(decoded).toMatch(/publicTutorialBase64/);
    });

    it('匯入前自動建立還原點', async () => {
        const src = await tripWithData();
        const code = await exportTripData(src);
        const dst = await tripWithData('丙');
        await updateDay(dst, 'day-2', (d) => ({ ...d, attractions: [{ id: 'mine', name: '我自己的景點', category: '景點', description: '', tags: [], mapQuery: '' }] }));
        await importTripData(dst, code);
        const snap = await readSnapshot(dst);
        expect(snap?.days[1].attractions[0].name).toBe('我自己的景點');
    });

    it('壞掉的分享碼：丟出白話錯誤，而且完全不動目前的資料', async () => {
        const id = await tripWithData();
        const before = JSON.stringify(await readDays(id));
        for (const bad of ['', '%%%not-base64%%%', btoa('not json'), enc({ foo: 1 }), enc({ config: {}, dayOrder: [], days: [] }), enc({ config: {}, dayOrder: ['x'], days: [{ id: '../evil', attractions: [] }] })]) {
            await expect(importTripData(id, bad)).rejects.toBeInstanceOf(ShareError);
        }
        expect(JSON.stringify(await readDays(id))).toBe(before);
        expect(await readSnapshot(id)).toBeNull(); // 驗證失敗連還原點都不會建立
    });

    it('清理惡意或錯誤的欄位：id 只能是安全字元、分類與標籤限定範圍、未知欄位丟棄', () => {
        const p = parseShareCode(
            enc({
                config: { tripName: 'T', startDate: '2026-02-10', endDate: '2026-02-10' },
                dayOrder: ['day-1', 'day-evil/../x'],
                days: [
                    { id: 'day-1', attractions: [{ id: 'a', name: 'N', category: '不存在的分類', tags: ['必吃', '惡意標籤'], mapQuery: 'q', evil: '<script>' }] },
                    { id: 'day-evil/../x', attractions: [] },
                ],
                tickets: [{ id: 't', title: '票', type: 'weird', publicTutorialBase64: 'javascript:alert(1)', addedAt: 1 }],
            }),
        );
        expect(p.days).toHaveLength(1);
        expect(p.dayOrder).toEqual(['day-1']);
        const a = p.days[0].attractions[0];
        expect(a.category).toBe('景點');
        expect(a.tags).toEqual(['必吃']);
        expect('evil' in a).toBe(false);
        expect(p.tickets[0].type).toBe('other');
        expect(p.tickets[0].publicTutorialBase64).toBeUndefined();
    });

    it('舊版產生的分享碼（只有基本欄位）仍可匯入', async () => {
        const dst = (await createTripRecord('乙', '2026-02-10', '2026-02-10')).id;
        await ensureDays(dst);
        const legacyCode = enc({
            config: { tripName: '朋友的', location: 'Tokyo', startDate: '2026-02-10', endDate: '2026-02-11', accommodationAddress: '' },
            dayOrder: ['day-1', 'day-2'],
            days: [
                { id: 'day-1', dayLabel: 'Day 1', date: '2月10日', locationLabel: 'x', attractions: [{ id: 'z', name: '築地', category: '食物', description: '', tags: [], mapQuery: '築地' }], advice: { clothing: '等待即時天氣預報...', snowCondition: '' } },
                { id: 'day-2', dayLabel: 'Day 2', date: '2月11日', locationLabel: 'x', attractions: [], advice: { clothing: '', snowCondition: '' } },
            ],
            tickets: [],
        });
        await importTripData(dst, legacyCode);
        expect((await readDays(dst))[0].attractions[0].name).toBe('築地');
    });

    it('sanitizeAttraction 拒絕沒有 id 或名稱的資料', () => {
        expect(sanitizeAttraction({ name: 'x' })).toBeNull();
        expect(sanitizeAttraction(null)).toBeNull();
    });
});
