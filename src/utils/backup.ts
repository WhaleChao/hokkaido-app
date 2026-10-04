import { allStores } from '../db';
import { emitData } from './bus';

// 完整備份：把這支手機上的所有旅程、記帳、清單、相簿連結與票夾（含私密 QR）存成一個檔案。
// 檔案只存在使用者自己選的位置，不會上傳到任何伺服器。

export const BACKUP_APP = 'hokkaido-app';
export const BACKUP_VERSION = 1;

type StoreName = keyof typeof allStores;
type Json = unknown;

export interface BackupFile {
    app: typeof BACKUP_APP;
    version: number;
    exportedAt: number;
    stores: Record<StoreName, Record<string, Json>>;
}

const SKIP_KEY = /^(exchange_|prohibited_rules_cache)/;

function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(r.error ?? new Error('讀取圖片失敗'));
        r.readAsDataURL(blob);
    });
}

function dataUrlToBlob(dataUrl: string): Blob {
    const mime = /^data:([^;,]+)/.exec(dataUrl)?.[1] ?? 'application/octet-stream';
    const bin = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
}

export async function encodeValue(value: Json): Promise<Json> {
    if (value instanceof Blob) return { __blob: await blobToDataUrl(value) };
    if (Array.isArray(value)) return Promise.all(value.map(encodeValue));
    if (value && typeof value === 'object') {
        const out: Record<string, Json> = {};
        for (const [k, v] of Object.entries(value)) out[k] = await encodeValue(v);
        return out;
    }
    return value;
}

export function decodeValue(value: Json): Json {
    if (Array.isArray(value)) return value.map(decodeValue);
    if (value && typeof value === 'object') {
        const o = value as Record<string, Json>;
        if (typeof o.__blob === 'string' && o.__blob.startsWith('data:') && Object.keys(o).length === 1) return dataUrlToBlob(o.__blob);
        const out: Record<string, Json> = {};
        for (const [k, v] of Object.entries(o)) out[k] = decodeValue(v);
        return out;
    }
    return value;
}

export async function createBackup(): Promise<BackupFile> {
    const stores = {} as BackupFile['stores'];
    for (const name of Object.keys(allStores) as StoreName[]) {
        const store = allStores[name];
        const bucket: Record<string, Json> = {};
        for (const key of await store.keys()) {
            if (SKIP_KEY.test(key)) continue;
            bucket[key] = await encodeValue(await store.getItem<Json>(key));
        }
        stores[name] = bucket;
    }
    return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: Date.now(), stores };
}

export class BackupError extends Error {}

export function validateBackup(data: unknown): BackupFile {
    if (!data || typeof data !== 'object') throw new BackupError('這不是備份檔');
    const d = data as Partial<BackupFile>;
    if (d.app !== BACKUP_APP) throw new BackupError('這不是這個 App 的備份檔');
    if (typeof d.version !== 'number' || d.version > BACKUP_VERSION) throw new BackupError('備份檔來自較新的版本，請先更新 App');
    if (!d.stores || typeof d.stores !== 'object') throw new BackupError('備份檔內容不完整');
    for (const name of Object.keys(allStores)) {
        const b = (d.stores as Record<string, unknown>)[name];
        if (b !== undefined && (typeof b !== 'object' || b === null || Array.isArray(b))) throw new BackupError('備份檔內容格式有誤');
    }
    return d as BackupFile;
}

export function parseBackupText(text: string): BackupFile {
    let json: unknown;
    try {
        json = JSON.parse(text);
    } catch {
        throw new BackupError('檔案不是有效的備份檔（內容無法讀取）');
    }
    return validateBackup(json);
}

/** 還原＝把備份內每一筆寫回去（同名覆蓋、其他保留），不會刪除備份檔裡沒有的資料。 */
export async function restoreBackup(file: BackupFile): Promise<{ items: number }> {
    let items = 0;
    for (const name of Object.keys(allStores) as StoreName[]) {
        const bucket = file.stores[name];
        if (!bucket) continue;
        for (const [key, value] of Object.entries(bucket)) {
            await allStores[name].setItem(key, decodeValue(value));
            items++;
        }
    }
    emitData('trips');
    emitData('config');
    emitData('itinerary');
    return { items };
}

export function backupFileName(now = new Date()): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `旅遊備份_${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}.json`;
}
