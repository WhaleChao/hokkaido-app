import { describe, it, expect, beforeEach } from 'vitest';
import { createBackup, restoreBackup, parseBackupText, BackupError, validateBackup, encodeValue, decodeValue } from './backup';
import { configStore, expenseStore, ticketStore, checklistStore, albumStore, itineraryStore } from '../db';
import { resetAll } from '../test/helpers';

beforeEach(resetAll);

describe('完整備份與還原', () => {
    it('備份後清空再還原，所有資料（含票券圖片）一筆不少', async () => {
        await configStore.setItem('trips_list', [{ id: 'trip_1', name: 'T', createdAt: 1 }]);
        await configStore.setItem('trip_1_app_config', { tripName: 'T' });
        await itineraryStore.setItem('trip_1_day-1', { id: 'day-1', attractions: [{ id: 'a', name: '景點' }] });
        await expenseStore.setItem('trip_1_e1', { id: 'e1', amountJPY: 1200, description: '拉麵', currency: 'JPY' });
        await checklistStore.setItem('trip_1_c1', { id: 'c1', text: '護照', isPacked: true });
        await albumStore.setItem('trip_1_albums', [{ dayId: 'day-1', url: 'https://example.com' }]);
        await ticketStore.setItem('trip_1_t1', { id: 't1', title: '票', addedAt: 1 });
        await configStore.setItem('exchange_JPY_to_TWD', { skip: true }); // 快取不備份

        const file = await createBackup();
        expect(JSON.stringify(file)).not.toContain('exchange_JPY_to_TWD');
        const text = JSON.stringify(file);

        await resetAll();
        expect(await expenseStore.length()).toBe(0);

        const { items } = await restoreBackup(parseBackupText(text));
        expect(items).toBeGreaterThanOrEqual(7);
        expect(await configStore.getItem('trips_list')).toEqual([{ id: 'trip_1', name: 'T', createdAt: 1 }]);
        expect((await expenseStore.getItem<{ amountJPY: number }>('trip_1_e1'))?.amountJPY).toBe(1200);
        expect((await checklistStore.getItem<{ isPacked: boolean }>('trip_1_c1'))?.isPacked).toBe(true);
        expect(await albumStore.getItem('trip_1_albums')).toEqual([{ dayId: 'day-1', url: 'https://example.com' }]);
        expect((await ticketStore.getItem<{ title: string }>('trip_1_t1'))?.title).toBe('票');
    });

    it('票券圖片（Blob）可編碼成文字再還原成 Blob（真實瀏覽器的 IndexedDB 流程另由 e2e 驗證）', async () => {
        const original = { id: 't', privateImageBlob: new Blob(['QRDATA'], { type: 'image/png' }), nested: [{ publicTutorialBlob: new Blob(['TUTORIAL'], { type: 'image/jpeg' }) }] };
        const encoded = await encodeValue(original);
        expect(JSON.stringify(encoded)).toMatch(/__blob/);
        const back = decodeValue(JSON.parse(JSON.stringify(encoded))) as typeof original;
        expect(back.privateImageBlob).toBeInstanceOf(Blob);
        expect(back.privateImageBlob.type).toBe('image/png');
        expect(await back.privateImageBlob.text()).toBe('QRDATA');
        expect(await back.nested[0].publicTutorialBlob.text()).toBe('TUTORIAL');
    });

    it('還原是「寫回」不是「清空」：備份裡沒有的資料不會被刪', async () => {
        await expenseStore.setItem('trip_1_old', { id: 'old', amountJPY: 5 });
        const file = await createBackup();
        await expenseStore.setItem('trip_2_new', { id: 'new', amountJPY: 9 });
        await restoreBackup(file);
        expect(await expenseStore.getItem('trip_2_new')).not.toBeNull();
    });

    it('不是備份檔、來自更新版本、內容壞掉都會被拒絕', () => {
        expect(() => parseBackupText('not json')).toThrow(BackupError);
        expect(() => validateBackup({ app: 'other' })).toThrow(/不是這個 App/);
        expect(() => validateBackup({ app: 'hokkaido-app', version: 99, stores: {} })).toThrow(/較新/);
        expect(() => validateBackup({ app: 'hokkaido-app', version: 1, stores: { config: [] } })).toThrow(/格式有誤/);
        expect(() => validateBackup(null)).toThrow(BackupError);
    });
});
