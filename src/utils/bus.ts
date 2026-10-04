// 極簡事件匯流排：某個分頁改了資料，其他分頁（標題列、相簿、行程…）才會同步更新。
export type DataEvent = 'config' | 'itinerary' | 'trips';

const target = new EventTarget();

export function emitData(kind: DataEvent): void {
    target.dispatchEvent(new Event(kind));
}

export function onData(kind: DataEvent, handler: () => void): () => void {
    target.addEventListener(kind, handler);
    return () => target.removeEventListener(kind, handler);
}
