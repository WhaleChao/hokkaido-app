import { useEffect } from 'react';
import { usePwa, applyUpdate, dismissNeedRefresh, dismissOfflineReady } from '../pwa';
import { useUi } from './ui/uiContext';

export function UpdatePrompt() {
    const { needRefresh, offlineReady } = usePwa();
    const ui = useUi();

    useEffect(() => {
        if (offlineReady) {
            ui.toast('已存好離線版本，沒有網路也能使用', 'success');
            dismissOfflineReady();
        }
    }, [offlineReady, ui]);

    if (!needRefresh) return null;
    return (
        <div className="update-banner" role="alert">
            <span>有新版本可以使用。更新後頁面會重新載入，你的資料不會受影響。</span>
            <button type="button" className="btn btn-ghost" onClick={dismissNeedRefresh}>
                稍後
            </button>
            <button type="button" className="btn" onClick={applyUpdate}>
                立即更新
            </button>
        </div>
    );
}
