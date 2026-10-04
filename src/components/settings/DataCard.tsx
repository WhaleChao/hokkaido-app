import { useEffect, useState } from 'react';
import { DatabaseBackup, Undo2, ShieldCheck, ShieldAlert, RefreshCw } from 'lucide-react';
import { BackupButtons } from '../BackupButtons';
import { readSnapshot, restoreSnapshot, type ItinerarySnapshot } from '../../utils/tripData';
import { requestPersistence } from '../../db';
import { onData } from '../../utils/bus';
import { useUi } from '../ui/uiContext';
import { checkForUpdate } from '../../pwa';

export function DataCard({ tripId }: { tripId: string }) {
    const ui = useUi();
    const [snap, setSnap] = useState<ItinerarySnapshot | null>(null);
    const [persisted, setPersisted] = useState<boolean | null>(null);

    useEffect(() => {
        let cancelled = false;
        const load = () =>
            void readSnapshot(tripId).then((s) => {
                if (!cancelled) setSnap(s);
            });
        load();
        const off = onData('itinerary', load);
        void requestPersistence().then((p) => {
            if (!cancelled) setPersisted(p);
        });
        return () => {
            cancelled = true;
            off();
        };
    }, [tripId]);

    const handleRestoreSnapshot = async () => {
        if (!snap) return;
        const ok = await ui.confirm({
            title: '還原到匯入之前？',
            message: `會把行程還原成「${new Date(snap.at).toLocaleString('zh-TW')}」${snap.reason}保存的狀態。現在的行程會另存成新的還原點，之後可以再換回來。`,
            confirmText: '還原',
        });
        if (ok) await ui.run(() => restoreSnapshot(tripId), '還原失敗', '已還原旅程');
    };

    const handleUpdateCheck = async () => {
        try {
            const r = await checkForUpdate();
            ui.toast(r === 'unsupported' ? '目前的環境不支援離線版本更新（開發模式或舊瀏覽器）' : '已檢查更新；若有新版本，畫面下方會出現更新提示', 'info');
        } catch {
            ui.toast('無法檢查更新，請確認網路連線', 'error');
        }
    };

    return (
        <section aria-labelledby="data-title">
            <h2 className="section-title" id="data-title">
                <DatabaseBackup size={20} aria-hidden="true" /> 資料與備份
            </h2>
            <div className="card stack">
                <div className={persisted ? 'notice notice-ok' : 'notice notice-warn'} role="status">
                    {persisted ? <ShieldCheck size={18} aria-hidden="true" /> : <ShieldAlert size={18} aria-hidden="true" />}
                    <span>
                        {persisted
                            ? '瀏覽器已答應長期保留這個 App 的資料。'
                            : '你的行程、記帳與票券都只存在這支手機的瀏覽器裡。iPhone 在儲存空間不足或長期沒開時可能清掉網站資料，建議出發前與回程後各做一次完整備份。'}
                    </span>
                </div>

                <BackupButtons />

                {snap && (
                    <div className="notice" role="note">
                        <Undo2 size={18} aria-hidden="true" />
                        <div style={{ flex: 1 }}>
                            <strong>有一份旅程還原點</strong>
                            <p>
                                {new Date(snap.at).toLocaleString('zh-TW')}・{snap.reason}
                            </p>
                            <button type="button" className="btn btn-secondary" style={{ marginTop: 8 }} onClick={() => void handleRestoreSnapshot()}>
                                還原到那個時間點
                            </button>
                        </div>
                    </div>
                )}

                <button type="button" className="btn btn-ghost btn-block" onClick={() => void handleUpdateCheck()}>
                    <RefreshCw size={16} aria-hidden="true" /> 檢查 App 更新
                </button>
            </div>
        </section>
    );
}
