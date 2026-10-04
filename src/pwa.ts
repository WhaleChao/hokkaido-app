import { registerSW } from 'virtual:pwa-register';
import { useSyncExternalStore } from 'react';

// Service Worker 狀態：有新版本、已可離線使用。更新策略是「先通知、使用者按了才換」，
// 避免旅途中畫面突然被換掉，也不會永遠卡在舊版（每小時與每次回到 App 都會檢查）。

interface PwaState {
    needRefresh: boolean;
    offlineReady: boolean;
}

let state: PwaState = { needRefresh: false, offlineReady: false };
const listeners = new Set<() => void>();
let updateSW: ((reload?: boolean) => Promise<void>) | null = null;
let registration: ServiceWorkerRegistration | undefined;

function set(next: Partial<PwaState>) {
    state = { ...state, ...next };
    listeners.forEach((l) => l());
}

export function initPwa(): void {
    if (!('serviceWorker' in navigator)) return;
    updateSW = registerSW({
        immediate: true,
        onNeedRefresh: () => set({ needRefresh: true }),
        onOfflineReady: () => set({ offlineReady: true }),
        onRegisteredSW(_url, reg) {
            registration = reg;
            if (reg) {
                window.setInterval(() => void reg.update().catch(() => undefined), 60 * 60 * 1000);
                document.addEventListener('visibilitychange', () => {
                    if (document.visibilityState === 'visible') void reg.update().catch(() => undefined);
                });
            }
        },
        onRegisterError: (e) => console.error('Service Worker 註冊失敗', e),
    });
}

export async function checkForUpdate(): Promise<'unsupported' | 'checked'> {
    if (!registration) return 'unsupported';
    await registration.update();
    return 'checked';
}

export function applyUpdate(): void {
    void updateSW?.(true);
}

export function dismissOfflineReady(): void {
    set({ offlineReady: false });
}

export function dismissNeedRefresh(): void {
    set({ needRefresh: false });
}

export function usePwa(): PwaState {
    return useSyncExternalStore(
        (cb) => {
            listeners.add(cb);
            return () => listeners.delete(cb);
        },
        () => state,
        () => state,
    );
}
