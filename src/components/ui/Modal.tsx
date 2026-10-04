import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface Props {
    title: string;
    onClose: () => void;
    children: ReactNode;
    /** 視窗寬度：預設 520px */
    size?: 'sm' | 'md' | 'lg' | 'full';
    /** 隱藏標題列（內容自己處理標題）。標題仍會當作無障礙名稱。 */
    hideTitle?: boolean;
    role?: 'dialog' | 'alertdialog';
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

let openCount = 0;

export function Modal({ title, onClose, children, size = 'md', hideTitle = false, role = 'dialog' }: Props) {
    const ref = useRef<HTMLDivElement>(null);
    const onCloseRef = useRef(onClose);
    useEffect(() => {
        onCloseRef.current = onClose;
    });

    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        const node = ref.current;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        // 對話框之外的內容暫時不可操作（輔助科技與 Tab 鍵都不會跑到背後去）
        const root = document.getElementById('root');
        openCount++;
        root?.setAttribute('inert', '');
        (node?.querySelector<HTMLElement>('[data-autofocus]') ?? node?.querySelector<HTMLElement>(FOCUSABLE) ?? node)?.focus();

        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onCloseRef.current();
                return;
            }
            if (e.key !== 'Tab' || !node) return;
            const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
            if (items.length === 0) {
                e.preventDefault();
                return;
            }
            const first = items[0];
            const last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };
        document.addEventListener('keydown', onKey, true);
        return () => {
            document.removeEventListener('keydown', onKey, true);
            document.body.style.overflow = prevOverflow;
            openCount--;
            if (openCount <= 0) root?.removeAttribute('inert');
            previous?.focus?.();
        };
    }, []);

    return createPortal(
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div ref={ref} className={`modal modal-${size}`} role={role} aria-modal="true" aria-label={title} tabIndex={-1}>
                {!hideTitle && (
                    <div className="modal-head">
                        <h2 className="modal-title">{title}</h2>
                        <button type="button" className="btn-icon" onClick={onClose} aria-label="關閉">
                            <X size={20} aria-hidden="true" />
                        </button>
                    </div>
                )}
                {children}
            </div>
        </div>,
        document.body,
    );
}
