import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Modal } from './Modal';
import { UiCtx, describeError, type ConfirmOptions, type ToastKind, type UiApi } from './uiContext';

interface ToastItem {
    id: number;
    kind: ToastKind;
    text: string;
}

export function UiProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const [pending, setPending] = useState<{ opts: ConfirmOptions; resolve: (v: boolean) => void } | null>(null);
    const seq = useRef(0);

    const toast = useCallback((text: string, kind: ToastKind = 'info') => {
        const id = ++seq.current;
        setToasts((t) => [...t.slice(-2), { id, kind, text }]);
        window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 7000 : 3500);
    }, []);

    const confirm = useCallback(
        (opts: ConfirmOptions) =>
            new Promise<boolean>((resolve) => {
                setPending({ opts, resolve });
            }),
        [],
    );

    const inflight = useRef(new Set<string>());
    const run = useCallback(
        async (action: () => Promise<unknown> | unknown, failText: string, successText?: string) => {
            // 同一個動作還在執行時，重複點擊直接忽略（避免連點造成重複新增）
            if (inflight.current.has(failText)) return false;
            inflight.current.add(failText);
            try {
                await action();
                if (successText) toast(successText, 'success');
                return true;
            } catch (e) {
                console.error(failText, e);
                toast(`${failText}：${describeError(e)}`, 'error');
                return false;
            } finally {
                inflight.current.delete(failText);
            }
        },
        [toast],
    );

    const api = useMemo<UiApi>(() => ({ toast, confirm, run }), [toast, confirm, run]);

    const answer = (v: boolean) => {
        pending?.resolve(v);
        setPending(null);
    };

    return (
        <UiCtx.Provider value={api}>
            {children}
            {createPortal(
            <div className="toast-region" aria-live="polite" aria-atomic="false">
                {toasts.map((t) => (
                    <div key={t.id} className={`toast toast-${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
                        {t.kind === 'error' ? <AlertTriangle size={18} aria-hidden="true" /> : t.kind === 'success' ? <CheckCircle2 size={18} aria-hidden="true" /> : <Info size={18} aria-hidden="true" />}
                        <span>{t.text}</span>
                    </div>
                ))}
            </div>,
            document.body,
            )}
            {pending && (
                <Modal title={pending.opts.title} onClose={() => answer(false)} size="sm" role="alertdialog" hideTitle>
                    <div className="confirm-body">
                        <h2 className="modal-title">{pending.opts.title}</h2>
                        {pending.opts.message && <p className="confirm-message">{pending.opts.message}</p>}
                        <div className="form-actions">
                            <button type="button" className="btn btn-secondary" onClick={() => answer(false)} data-autofocus={pending.opts.danger ? '' : undefined}>
                                {pending.opts.cancelText ?? '取消'}
                            </button>
                            <button type="button" className={`btn ${pending.opts.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => answer(true)}>
                                {pending.opts.confirmText ?? '確定'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </UiCtx.Provider>
    );
}
