import { useEffect, useState } from 'react';
import { validateRulesFile, validateStatusFile, type RulesFile, type StatusFile } from '../utils/customs';
import { lsGetJSON, lsSetJSON } from '../utils/safeStorage';

const RULES_CACHE = 'hokkaido_customs_rules_v2';
const STATUS_CACHE = 'hokkaido_customs_status_v1';

export interface CustomsData {
    rules: RulesFile | null;
    status: StatusFile | null;
    /** 狀態檔是從網路取得（true）還是用上次存下的（false，離線或連線失敗） */
    statusLive: boolean;
    loading: boolean;
    error: string;
}

async function getJSON(path: string): Promise<unknown> {
    const res = await fetch(`${import.meta.env.BASE_URL}${path}`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

/**
 * 規則內容（prohibited_rules.json）跟著 App 一起打包與預先快取，更新時會隨 PWA 更新提示一起換新；
 * 核對狀態（rules-status.json）每天由 Actions 更新，單獨抓取並存一份在手機上，離線時用上次存的。
 */
export function useCustomsData(): CustomsData {
    const [state, setState] = useState<CustomsData>(() => ({
        rules: validateRulesFile(lsGetJSON(RULES_CACHE)),
        status: validateStatusFile(lsGetJSON(STATUS_CACHE)),
        statusLive: false,
        loading: true,
        error: '',
    }));

    useEffect(() => {
        let cancelled = false;
        (async () => {
            let rules: RulesFile | null = null;
            let status: StatusFile | null = null;
            let live = false;
            let error = '';
            try {
                rules = validateRulesFile(await getJSON('prohibited_rules.json'));
                if (!rules) error = '規則資料格式不正確';
                else lsSetJSON(RULES_CACHE, rules);
            } catch (e) {
                console.warn('讀取海關規則失敗，改用上次存下的版本', e);
            }
            try {
                status = validateStatusFile(await getJSON('rules-status.json'));
                if (status) {
                    live = true;
                    lsSetJSON(STATUS_CACHE, status);
                }
            } catch (e) {
                console.warn('讀取規則核對狀態失敗，改用上次存下的版本', e);
            }
            if (cancelled) return;
            setState((prev) => ({
                rules: rules ?? prev.rules,
                status: status ?? prev.status,
                statusLive: live,
                loading: false,
                error: !(rules ?? prev.rules) ? error || '無法載入海關規則' : '',
            }));
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    return state;
}
