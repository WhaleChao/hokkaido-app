import { useState } from 'react';
import { Share2, Download } from 'lucide-react';
import { exportTripData, importTripData, parseShareCode, ShareError } from '../../utils/share';
import { useUi, describeError } from '../ui/uiContext';

export function ShareCard({ tripId }: { tripId: string }) {
    const ui = useUi();
    const [code, setCode] = useState('');
    const [showImport, setShowImport] = useState(false);
    const [importCode, setImportCode] = useState('');
    const [importError, setImportError] = useState('');
    const [busy, setBusy] = useState(false);

    const handleExport = async () => {
        setBusy(true);
        try {
            const c = await exportTripData(tripId);
            setCode(c);
            if (navigator.share) {
                try {
                    await navigator.share({ title: '我的行程', text: c });
                    return;
                } catch (e) {
                    if (e instanceof DOMException && e.name === 'AbortError') return; // 使用者自己取消分享，不算錯誤
                    // 其他原因分享失敗：改用複製
                }
            }
            try {
                await navigator.clipboard.writeText(c);
                ui.toast('行程分享碼已複製，貼給朋友就可以了', 'success');
            } catch {
                ui.toast('無法自動複製，請從下方框內手動全選複製', 'error');
            }
        } catch (e) {
            ui.toast(describeError(e), 'error');
        } finally {
            setBusy(false);
        }
    };

    const handleImport = async () => {
        setImportError('');
        let summary;
        try {
            const p = parseShareCode(importCode);
            summary = `${p.days.length} 天、${p.days.reduce((n, d) => n + d.attractions.length, 0)} 個景點、${p.tickets.length} 張公開票券`;
        } catch (e) {
            setImportError(e instanceof ShareError ? e.message : describeError(e));
            return;
        }
        const ok = await ui.confirm({
            title: '用朋友的行程取代目前的行程？',
            message: `分享碼內容：${summary}。\n\n目前這趟旅程的行程與設定會被取代（記帳、清單、你自己的票券不受影響）。匯入前會自動保存還原點，可以在下方「資料與備份」還原。`,
            confirmText: '匯入',
            danger: true,
        });
        if (!ok) return;
        const done = await ui.run(() => importTripData(tripId, importCode), '匯入失敗，原本的行程沒有被改動', '行程匯入完成');
        if (done) {
            setImportCode('');
            setShowImport(false);
        }
    };

    return (
        <section aria-labelledby="share-title">
            <h2 className="section-title" id="share-title">
                <Share2 size={20} aria-hidden="true" /> 與朋友共用行程
            </h2>
            <div className="card">
                <div className="notice" style={{ marginBottom: 14 }}>
                    <div>
                        <strong>分享的內容</strong>
                        <p>
                            行程、住宿設定（含地址與連結）、票券名稱與文字備註、以及你標為「公開」的換票教學圖。<b>不會分享</b>：記帳、行李清單、私密 QR 憑證。分享碼只是編碼、沒有加密，拿到的人都看得到內容，請只傳給同行的朋友。
                        </p>
                    </div>
                </div>

                <button type="button" className="btn btn-primary btn-block" onClick={() => void handleExport()} disabled={busy}>
                    <Share2 size={18} aria-hidden="true" /> {busy ? '產生中…' : '產生行程分享碼'}
                </button>
                {code && (
                    <label className="field">
                        <span className="label">分享碼（如果沒有自動複製，請手動全選複製；共 {code.length.toLocaleString()} 字）</span>
                        <textarea className="textarea code-box" readOnly value={code} onFocus={(e) => e.currentTarget.select()} />
                        {code.length > 12000 && <span className="hint">分享碼很長（可能含圖片），有些通訊軟體會截斷。若朋友匯入失敗，請改用較小的圖片。</span>}
                    </label>
                )}

                <div style={{ marginTop: 16 }}>
                    {showImport ? (
                        <div>
                            <p className="small muted" style={{ marginBottom: 8 }}>
                                請朋友先在他的 App 產生分享碼並傳給你，再貼到下面。
                            </p>
                            <label className="field">
                                <span className="label">朋友傳來的分享碼</span>
                                <textarea className="textarea code-box" value={importCode} onChange={(e) => setImportCode(e.target.value)} aria-invalid={!!importError} data-autofocus />
                                {importError && (
                                    <p className="field-error" role="alert">
                                        {importError}
                                    </p>
                                )}
                            </label>
                            <div className="form-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowImport(false)}>
                                    取消
                                </button>
                                <button type="button" className="btn btn-primary" onClick={() => void handleImport()}>
                                    檢查並匯入
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button type="button" className="btn btn-secondary btn-block" onClick={() => setShowImport(true)}>
                            <Download size={18} aria-hidden="true" /> 接收朋友的行程
                        </button>
                    )}
                </div>
            </div>
        </section>
    );
}
