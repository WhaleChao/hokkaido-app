// 規則檔與狀態檔的結構驗證。驗證不過就不寫入、不提交（絕不產生空白或殘缺規則）。
const isStr = (v, max = 4000) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const isoDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v);

export function validateRulesFile(d) {
    const errs = [];
    if (!d || typeof d !== 'object') return ['不是物件'];
    if (d.schema !== 2) errs.push('schema 必須是 2');
    if (!isoDate(d.updated_at)) errs.push('updated_at 格式錯誤');
    if (!Array.isArray(d.sources) || d.sources.length === 0) errs.push('sources 必須是非空陣列');
    if (!Array.isArray(d.rules) || d.rules.length === 0) errs.push('rules 必須是非空陣列');
    const sourceIds = new Set();
    for (const s of d.sources ?? []) {
        if (!isStr(s?.id, 80) || !isStr(s?.name, 200) || !isStr(s?.agency, 200)) errs.push(`來源缺欄位：${s?.id}`);
        if (!/^https:\/\//.test(s?.url ?? '')) errs.push(`來源網址必須是 https：${s?.id}`);
        if (!['zh', 'en', 'ja'].includes(s?.lang)) errs.push(`來源語言不明：${s?.id}`);
        sourceIds.add(s?.id);
    }
    const ruleIds = new Set();
    for (const r of d.rules ?? []) {
        const w = `規則 ${r?.id}`;
        if (!isStr(r?.id, 80) || ruleIds.has(r.id)) errs.push(`${w}：id 缺漏或重複`);
        ruleIds.add(r?.id);
        if (!sourceIds.has(r?.source_id)) errs.push(`${w}：找不到對應的官方來源（每條規則都必須有來源）`);
        if (!isStr(r?.title, 120)) errs.push(`${w}：title 缺漏`);
        if (!isStr(r?.lead, 300)) errs.push(`${w}：lead 缺漏`);
        if (!['verbatim', 'curated'].includes(r?.mode)) errs.push(`${w}：mode 不明`);
        if (typeof r?.always !== 'boolean') errs.push(`${w}：always 必須是布林`);
        if (!Array.isArray(r?.keywords) || !r.keywords.every((k) => isStr(k, 40))) errs.push(`${w}：keywords 格式錯誤`);
        if (!r?.always && (!Array.isArray(r?.keywords) || r.keywords.length === 0)) errs.push(`${w}：非 always 規則必須有 keywords`);
        if (!Array.isArray(r?.items) || r.items.length === 0 || !r.items.every((x) => isStr(x))) errs.push(`${w}：items 不得為空或含空白條目`);
        if (r?.mode === 'curated') {
            if (!Array.isArray(r?.summary) || r.summary.length === 0 || !r.summary.every((x) => isStr(x))) errs.push(`${w}：curated 規則必須有白話摘要`);
            if (!/^[0-9a-f]{64}$/.test(r?.reviewed_hash ?? '')) errs.push(`${w}：reviewed_hash 格式錯誤`);
        }
        if (r?.change && (!isoDate(r.change.at) || !isStr(r.change.summary, 400))) errs.push(`${w}：change 格式錯誤`);
    }
    return errs;
}

export function validateStatusFile(d) {
    const errs = [];
    if (!d || typeof d !== 'object') return ['不是物件'];
    if (d.schema !== 1) errs.push('schema 必須是 1');
    if (!isoDate(d.checked_at)) errs.push('checked_at 格式錯誤');
    if (!d.sources || typeof d.sources !== 'object') errs.push('sources 缺漏');
    for (const [id, s] of Object.entries(d.sources ?? {})) {
        if (!['ok', 'review', 'error'].includes(s?.status)) errs.push(`${id}：status 不明`);
        if (!isoDate(s?.checked_at)) errs.push(`${id}：checked_at 格式錯誤`);
        if (!/^[0-9a-f]{64}$/.test(s?.hash ?? '')) errs.push(`${id}：hash 格式錯誤`);
    }
    return errs;
}
