import localforage from 'localforage';

// 儲存庫名稱與 storeName 與舊版完全相同——絕對不能改，否則使用者手機上的既有資料會「消失」。
export const configStore = localforage.createInstance({ name: 'hokkaido_app', storeName: 'config' });
export const itineraryStore = localforage.createInstance({ name: 'hokkaido_app', storeName: 'itinerary' });
export const ticketStore = localforage.createInstance({ name: 'hokkaido_app', storeName: 'tickets' });
export const expenseStore = localforage.createInstance({ name: 'hokkaido_app', storeName: 'expenses' });
export const checklistStore = localforage.createInstance({ name: 'hokkaido_app', storeName: 'checklists' });
export const albumStore = localforage.createInstance({ name: 'hokkaido_app', storeName: 'albums' });

export const allStores = {
    config: configStore,
    itinerary: itineraryStore,
    tickets: ticketStore,
    expenses: expenseStore,
    checklists: checklistStore,
    albums: albumStore,
} as const;

/**
 * 請瀏覽器把這個網站的資料標為「持久」，降低 iPhone Safari 在儲存空間吃緊時自動清掉資料的機率。
 * 結果僅供參考（使用者可在設定頁看到），失敗不影響使用。
 */
export async function requestPersistence(): Promise<boolean> {
    try {
        if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
        if (navigator.storage?.persist) return await navigator.storage.persist();
    } catch {
        /* 瀏覽器不支援：忽略 */
    }
    return false;
}
