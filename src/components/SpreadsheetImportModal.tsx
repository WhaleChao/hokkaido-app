import { useState } from 'react';
import { Modal } from './ui/Modal';

interface Props {
    /** 回傳 null＝成功並關閉；回傳字串＝顯示錯誤（空字串＝使用者取消或已另行提示，視窗保持開啟） */
    onImport: (tsv: string) => Promise<string | null>;
    onClose: () => void;
}

export function SpreadsheetImportModal({ onImport, onClose }: Props) {
    const [text, setText] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        if (!text.trim()) {
            setError('請先貼上表格內容');
            return;
        }
        setBusy(true);
        setError('');
        try {
            const result = await onImport(text);
            if (result === null) onClose();
            else setError(result);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal title="從試算表匯入行程" onClose={onClose} size="lg">
            <div className="stack">
                <p>在 Google 試算表或 Excel 選取行程表格，複製後貼到下方。不需要上傳檔案。</p>
                <p className="small muted">電腦上操作最方便：選取儲存格，按 Ctrl+C（Mac 是 Command+C）複製，再到下方框內貼上。</p>

                <details className="card">
                    <summary style={{ cursor: 'pointer', fontWeight: 700, minHeight: 'var(--tap)', display: 'flex', alignItems: 'center' }}>支援的兩種表格格式</summary>
                    <p className="small" style={{ margin: '8px 0' }}>
                        <strong>直式</strong>：每列一個景點，欄位依序是「天數、景點名稱、分類、備註」。
                    </p>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>天數</th>
                                    <th>景點名稱</th>
                                    <th>分類</th>
                                    <th>備註（選填）</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>1</td>
                                    <td>小樽運河</td>
                                    <td>景點</td>
                                    <td>傍晚點燈最美</td>
                                </tr>
                                <tr>
                                    <td>第 2 天</td>
                                    <td>一蘭拉麵</td>
                                    <td>食物</td>
                                    <td></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <p className="small" style={{ margin: '12px 0 0' }}>
                        <strong>橫式</strong>：每一天佔一組欄位並排，表頭寫「時間」「活動地點」「簡介」「備註」。
                    </p>
                </details>

                <div className="notice notice-warn" role="note">
                    <span>匯入只會取代「表格裡有景點的那幾天」，其他天不受影響。匯入前會自動保存還原點，可以在「設定」頁還原。</span>
                </div>

                <label className="field">
                    <span className="label">貼上表格內容</span>
                    <textarea className="textarea code-box" aria-label="貼上表格內容" style={{ minHeight: 160, whiteSpace: 'pre' }} value={text} onChange={(e) => setText(e.target.value)} placeholder={'1\t小樽運河\t景點\t傍晚點燈最美'} spellCheck={false} data-autofocus />
                </label>

                {error && (
                    <div className="notice notice-error" role="alert">
                        <span>{error}</span>
                    </div>
                )}

                <div className="form-actions">
                    <button type="button" className="btn btn-secondary" onClick={onClose}>
                        取消
                    </button>
                    <button type="button" className="btn btn-primary" onClick={() => void submit()} disabled={busy}>
                        {busy ? '匯入中…' : '解析並匯入'}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
