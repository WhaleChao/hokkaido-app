import { createContext, useContext } from 'react';

export type ToastKind = 'info' | 'success' | 'error';

export interface ConfirmOptions {
    title: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
}

export interface UiApi {
    toast: (text: string, kind?: ToastKind) => void;
    confirm: (opts: ConfirmOptions) => Promise<boolean>;
    /** 執行會寫入資料的動作；失敗時顯示白話錯誤而不是默默吞掉，回傳是否成功。 */
    run: (action: () => Promise<unknown> | unknown, failText: string, successText?: string) => Promise<boolean>;
}

export const UiCtx = createContext<UiApi | null>(null);

export function useUi(): UiApi {
    const v = useContext(UiCtx);
    if (!v) throw new Error('useUi 必須在 UiProvider 內使用');
    return v;
}

export function describeError(e: unknown): string {
    if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22)) return '手機儲存空間不足';
    if (e instanceof Error && /quota/i.test(e.message)) return '手機儲存空間不足';
    if (e instanceof Error && e.message) return e.message;
    return '發生未知問題';
}

