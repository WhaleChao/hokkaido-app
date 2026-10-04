import { useRef, useState } from 'react';
import { DatabaseBackup, Upload } from 'lucide-react';
import { createBackup, parseBackupText, restoreBackup, backupFileName, BackupError } from '../utils/backup';
import { useUi, describeError } from './ui/uiContext';

/** 完整備份與還原（首頁與設定頁共用）。 */
export function BackupButtons() {
    const ui = useUi();
    const [busy, setBusy] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const handleBackup = async () => {
        setBusy(true);
        try {
            const file = await createBackup();
            const blob = new Blob([JSON.stringify(file)], { type: 'application/json' });
            const name = backupFileName();
            const asFile = new File([blob], name, { type: 'application/json' });
            if (navigator.canShare?.({ files: [asFile] })) {
                try {
                    await navigator.share({ files: [asFile], title: '旅遊備份' });
                    return;
                } catch (e) {
                    if (e instanceof DOMException && e.name === 'AbortError') return;
                }
            }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = name;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
            ui.toast('備份檔已下載。裡面包含你的私密票券，請妥善保管', 'success');
        } catch (e) {
            ui.toast(`備份失敗：${describeError(e)}`, 'error');
        } finally {
            setBusy(false);
        }
    };

    const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f) return;
        try {
            const parsed = parseBackupText(await f.text());
            const count = Object.values(parsed.stores).reduce((n, b) => n + Object.keys(b ?? {}).length, 0);
            const ok = await ui.confirm({
                title: '從備份檔還原？',
                message: `備份時間：${new Date(parsed.exportedAt).toLocaleString('zh-TW')}，共 ${count} 筆資料。\n\n備份裡的行程、記帳、清單、票券會寫回這支手機；同一筆資料會被備份版本覆蓋，備份裡沒有的資料不會被刪除。`,
                confirmText: '還原',
                danger: true,
            });
            if (!ok) return;
            const { items } = await restoreBackup(parsed);
            ui.toast(`已還原 ${items} 筆資料`, 'success');
        } catch (err) {
            ui.toast(err instanceof BackupError ? err.message : `還原失敗：${describeError(err)}`, 'error');
        }
    };

    return (
        <div className="stack">
            <button type="button" className="btn btn-secondary btn-block" onClick={() => void handleBackup()} disabled={busy}>
                <DatabaseBackup size={18} aria-hidden="true" /> {busy ? '備份中…' : '下載完整備份'}
            </button>
            <button type="button" className="btn btn-secondary btn-block" onClick={() => fileRef.current?.click()}>
                <Upload size={18} aria-hidden="true" /> 從備份檔還原
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => void handleRestoreFile(e)} aria-label="選擇備份檔" />
            <p className="small muted">備份檔包含所有行程、記帳、清單、相簿連結與私密票券圖片，只存在你選的位置，不會上傳到任何伺服器。</p>
        </div>
    );
}
