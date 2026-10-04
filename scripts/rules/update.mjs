// 海關／檢疫規則自動更新。流程見 README「海關與檢疫規則」與 .github/workflows/update-rules.yml。
//
//   node scripts/rules/update.mjs            # 抓官方頁面、比對、寫入 public/*.json（有問題時產生 Issue 清單）
//   node scripts/rules/update.mjs --accept jp-customs-passenger   # 人工確認新版官方原文後，把它設為新的基準
//
// 原則：
//   * 只抓 sources.mjs 登錄的官方網址，每個來源每次只請求一次（失敗最多重試一次），來源之間間隔 1.5 秒，
//     並帶可辨識的 User-Agent；不使用任何金鑰。
//   * 解析不出、結構異常、內容無法可靠判讀 → 不覆蓋現有規則，標記為「待確認」並開 Issue。
//   * 寫入前一定驗證結構，驗證不過就丟錯、不寫檔。
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { SOURCES, ParseError } from './sources.mjs';
import { DEFINITIONS } from './definitions.mjs';
import { validateRulesFile, validateStatusFile } from './schema.mjs';

export const USER_AGENT = 'hokkaido-app-rules-checker (+https://github.com/WhaleChao/hokkaido-app; reads public official pages once a day)';
export const hashLines = (lines) => createHash('sha256').update(lines.join('\n')).digest('hex');

const isoDay = (d) => d.toISOString().slice(0, 10);
const clip = (s, n = 300) => (s.length > n ? s.slice(0, n) + '…' : s);

export function diffLines(oldLines, newLines) {
    const o = new Set(oldLines);
    const n = new Set(newLines);
    return { added: newLines.filter((l) => !o.has(l)), removed: oldLines.filter((l) => !n.has(l)) };
}

async function fetchPage(url, fetchImpl, retryDelayMs = 2000) {
    let lastErr;
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 30000);
            const res = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' }, signal: ctrl.signal, redirect: 'follow' });
            clearTimeout(t);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.text();
        } catch (e) {
            const cause = e?.cause ? `（${e.cause.code ?? e.cause.message}）` : '';
            lastErr = new Error(`${e?.message ?? e}${cause}`);
            await new Promise((r) => setTimeout(r, retryDelayMs));
        }
    }
    throw lastErr;
}

/**
 * @param {object} o
 * @param {object|null} o.currentRules  目前的 public/prohibited_rules.json（初次建立時為 null）
 * @param {object|null} o.currentStatus 目前的 public/rules-status.json
 * @param {Function}    o.fetchImpl
 * @param {Date}        o.now
 * @param {string[]}    o.accept        要把「目前官方原文」設為新基準的來源 id（人工確認後）
 * @param {boolean}     o.init          初次建立：所有 curated 來源直接以目前官方原文為基準
 */
export async function runUpdate({ currentRules = null, currentStatus = null, fetchImpl = fetch, now = new Date(), accept = [], init = false, delayMs = 1500, retryDelayMs = 2000, sources = SOURCES, definitions = DEFINITIONS }) {
    const today = isoDay(now);
    const stamp = now.toISOString();
    const prevRules = new Map((currentRules?.rules ?? []).map((r) => [r.id, r]));
    const prevSources = new Map((currentRules?.sources ?? []).map((s) => [s.id, s]));
    const prevStatus = currentStatus?.sources ?? {};

    const issues = [];
    const log = [];
    const nextRules = [];
    const nextSources = [];
    const nextStatus = {};
    let contentChanged = false;

    for (const [i, src] of sources.entries()) {
        if (i > 0 && delayMs) await new Promise((r) => setTimeout(r, delayMs));
        const def = definitions.find((d) => d.source_id === src.id);
        const old = prevRules.get(def.id) ?? null;
        const oldStatus = prevStatus[src.id] ?? null;
        const keepOld = () => (old ? { rule: old, source: prevSources.get(src.id) } : null);
        const baseSource = { id: src.id, agency: src.agency, name: src.name, url: src.url, lang: src.lang, mode: src.mode };

        let parsed;
        let failure = null;
        try {
            parsed = src.parse(await fetchPage(src.url, fetchImpl, retryDelayMs));
        } catch (e) {
            failure = e;
        }

        // ---- 抓取或解析失敗：不覆蓋現有規則 ----
        if (failure) {
            const structural = failure instanceof ParseError;
            const fails = (oldStatus?.fail_count ?? 0) + 1;
            const kept = keepOld();
            if (!kept) throw new Error(`第一次建立規則時 ${src.id} 失敗：${failure.message}`);
            nextRules.push(kept.rule);
            nextSources.push(kept.source);
            nextStatus[src.id] = {
                status: structural ? 'review' : 'error',
                checked_at: oldStatus?.checked_at ?? stamp,
                attempted_at: stamp,
                hash: oldStatus?.hash ?? hashLines(kept.rule.items),
                fail_count: fails,
                message: structural ? `官方頁面結構有變，無法可靠解析：${failure.message}` : `暫時無法連線到官方來源：${failure.message}`,
                ...(oldStatus?.issue_key ? { issue_key: oldStatus.issue_key, issue_url: oldStatus.issue_url } : {}),
            };
            const issueKey = `${src.id}:${structural ? 'parse' : 'net'}`;
            const needIssue = structural || fails >= 3;
            if (needIssue && oldStatus?.issue_key !== issueKey) {
                issues.push({
                    key: issueKey,
                    sourceId: src.id,
                    title: `[海關規則] 無法解析官方來源：${src.name}`,
                    body: `官方來源：${src.url}\n\n錯誤：${failure.message}\n連續失敗次數：${fails}\n\n${structural ? '頁面結構可能已改版，解析器需要更新。' : '連續多天無法連線，請確認來源網址是否仍有效。'}\n\nApp 目前沿用上一版規則，並顯示「官方來源有變動待確認，請以官方網站為準」。`,
                });
                nextStatus[src.id].issue_key = issueKey;
            }
            log.push(`${src.id}: 失敗（${failure.message}）`);
            continue;
        }

        const hash = hashLines(parsed.lines);
        const source = { ...baseSource, ...(parsed.published ? { published: parsed.published } : {}) };

        // ---- verbatim：官方中文原文，可靠且有變動就自動更新 ----
        if (src.mode === 'verbatim') {
            const items = parsed.lines;
            if (old && hashLines(old.items) === hash) {
                nextRules.push(old);
                log.push(`${src.id}: 無變動`);
            } else {
                const shrink = old && items.length < Math.ceil(old.items.length / 2);
                if (shrink) {
                    // 條目數量腰斬：極可能是版面改動造成的誤判，不自動採用
                    const key = `${src.id}:${hash}`;
                    nextRules.push(old);
                    nextSources.push(prevSources.get(src.id) ?? source);
                    nextStatus[src.id] = { status: 'review', checked_at: oldStatus?.checked_at ?? stamp, attempted_at: stamp, hash: oldStatus?.hash ?? hashLines(old.items), pending_hash: hash, message: `官方內容條目由 ${old.items.length} 條變成 ${items.length} 條，變動過大無法可靠判讀` };
                    if (oldStatus?.issue_key !== key) {
                        const d = diffLines(old.items, items);
                        issues.push({ key, sourceId: src.id, title: `[海關規則] 官方內容大幅變動待確認：${src.name}`, body: renderDiff(src, d, '條目數量大幅減少，未自動更新。') });
                        nextStatus[src.id].issue_key = key;
                    } else nextStatus[src.id].issue_url = oldStatus.issue_url;
                    log.push(`${src.id}: 變動過大，待確認`);
                    continue;
                }
                const d = old ? diffLines(old.items, items) : { added: [], removed: [] };
                const rule = {
                    id: def.id, source_id: src.id, mode: 'verbatim', title: def.title, lead: def.lead, always: def.always, keywords: def.keywords,
                    items,
                    ...(old
                        ? { change: { at: today, summary: `新增 ${d.added.length} 條、移除 ${d.removed.length} 條`, added: d.added.slice(0, 5).map((x) => clip(x)), removed: d.removed.slice(0, 5).map((x) => clip(x)) } }
                        : {}),
                };
                nextRules.push(rule);
                contentChanged = true;
                log.push(`${src.id}: ${old ? '已自動更新' : '初次建立'}`);
            }
            nextSources.push(source);
            nextStatus[src.id] = { status: 'ok', checked_at: stamp, hash };
            continue;
        }

        // ---- curated：白話摘要是人工整理的，官方原文變動時不自動改寫 ----
        const accepted = init || accept.includes(src.id);
        const baseline = !old || accepted;
        if (baseline || old.reviewed_hash === hash) {
            const rule = {
                id: def.id, source_id: src.id, mode: 'curated', title: def.title, lead: def.lead, always: def.always, keywords: def.keywords,
                summary: def.summary, items: baseline ? parsed.lines : old.items, reviewed_hash: baseline ? hash : old.reviewed_hash,
            };
            if (!old || JSON.stringify({ ...old, change: undefined }) !== JSON.stringify(rule)) contentChanged = true;
            nextRules.push(rule);
            nextSources.push(source);
            nextStatus[src.id] = { status: 'ok', checked_at: stamp, hash };
            log.push(`${src.id}: ${baseline ? '已設為新基準' : '無變動'}`);
        } else {
            const key = `${src.id}:${hash}`;
            nextRules.push(old);
            nextSources.push(prevSources.get(src.id) ?? source);
            nextStatus[src.id] = { status: 'review', checked_at: oldStatus?.checked_at ?? stamp, attempted_at: stamp, hash: old.reviewed_hash, pending_hash: hash, message: '官方原文與上次人工核對的版本不同，白話摘要需要人工確認' };
            if (oldStatus?.issue_key === key) {
                nextStatus[src.id].issue_key = key;
                nextStatus[src.id].issue_url = oldStatus.issue_url;
            } else {
                issues.push({ key, sourceId: src.id, title: `[海關規則] 官方來源有變動待確認：${src.name}`, body: renderDiff(src, diffLines(old.items, parsed.lines), '白話摘要未自動更新，App 目前顯示「官方來源有變動待確認」。確認後請修改 scripts/rules/definitions.mjs 的摘要，再執行 `node scripts/rules/update.mjs --accept ' + src.id + '`。') });
                nextStatus[src.id].issue_key = key;
            }
            log.push(`${src.id}: 官方內容有變，待確認`);
        }
    }

    const rulesFile = {
        schema: 2,
        updated_at: contentChanged || !currentRules ? stamp : currentRules.updated_at,
        sources: nextSources,
        rules: nextRules,
    };
    const statusFile = { schema: 1, checked_at: stamp, sources: nextStatus };

    const e1 = validateRulesFile(rulesFile);
    const e2 = validateStatusFile(statusFile);
    if (e1.length || e2.length) throw new Error('產生的規則檔未通過結構驗證，不寫入：\n' + [...e1, ...e2].join('\n'));

    const statusChanged = JSON.stringify(stripTimes(currentStatus)) !== JSON.stringify(stripTimes(statusFile));
    return { rulesFile, statusFile, contentChanged, statusChanged, issues, log };
}

function stripTimes(s) {
    if (!s) return null;
    return JSON.stringify(s, (k, v) => (k === 'checked_at' || k === 'attempted_at' ? undefined : v));
}

function renderDiff(src, d, note) {
    const fmt = (arr) => (arr.length ? arr.map((l) => `- ${clip(l, 500)}`).join('\n') : '（無）');
    return `官方來源：${src.url}\n機關：${src.agency}\n\n${note}\n\n### 新增的官方文字\n${fmt(d.added)}\n\n### 移除的官方文字\n${fmt(d.removed)}\n\n（此 Issue 由 GitHub Actions 自動建立；請以官方網站為準。）`;
}

/** 以 GITHUB_TOKEN 開 Issue（同一個 key 已有未關閉的 Issue 就不重複開）。回傳 Issue 網址。 */
export async function openIssue({ repo, token, issue, fetchImpl = fetch }) {
    const api = `https://api.github.com/repos/${repo}`;
    const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': USER_AGENT, 'X-GitHub-Api-Version': '2022-11-28' };
    const marker = `<!-- rules-key:${issue.key} -->`;
    const list = await fetchImpl(`${api}/issues?state=open&labels=rules-review&per_page=100`, { headers });
    if (!list.ok) throw new Error(`讀取 Issue 失敗：HTTP ${list.status}`);
    const existing = (await list.json()).find((i) => (i.body ?? '').includes(marker));
    if (existing) return existing.html_url;
    const res = await fetchImpl(`${api}/issues`, { method: 'POST', headers, body: JSON.stringify({ title: issue.title, body: `${marker}\n${issue.body}`, labels: ['rules-review'] }) });
    if (!res.ok) throw new Error(`建立 Issue 失敗：HTTP ${res.status} ${clip(await res.text(), 200)}`);
    return (await res.json()).html_url;
}

// ---------- CLI ----------
async function main() {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
    const rulesPath = join(root, 'public', 'prohibited_rules.json');
    const statusPath = join(root, 'public', 'rules-status.json');
    const args = process.argv.slice(2);
    const accept = [];
    for (let i = 0; i < args.length; i++) if (args[i] === '--accept') accept.push(args[++i]);
    const init = args.includes('--init');

    const readJson = (p) => {
        if (!existsSync(p)) return null;
        try {
            return JSON.parse(readFileSync(p, 'utf8'));
        } catch {
            return null;
        }
    };
    const currentRules = init ? null : readJson(rulesPath);
    const currentStatus = init ? null : readJson(statusPath);
    if (currentRules && validateRulesFile(currentRules).length) throw new Error('現有的規則檔未通過驗證，請先修復：' + validateRulesFile(currentRules).join('；'));

    const out = await runUpdate({ currentRules, currentStatus, accept, init });
    out.log.forEach((l) => console.log(l));

    // 開 Issue（只用 GITHUB_TOKEN；本機執行沒有 token 就只列出來）
    const repo = process.env.GITHUB_REPOSITORY;
    const token = process.env.GITHUB_TOKEN;
    for (const issue of out.issues) {
        if (repo && token) {
            try {
                const url = await openIssue({ repo, token, issue });
                out.statusFile.sources[issue.sourceId].issue_url = url;
                console.log(`已開立 Issue：${url}`);
            } catch (e) {
                console.error(`開立 Issue 失敗（不影響規則檔）：${e.message}`);
                delete out.statusFile.sources[issue.sourceId].issue_key; // 下次再試
            }
        } else {
            console.log(`（本機執行，未開 Issue）${issue.title}\n${issue.body}`);
        }
    }

    const before = readJson(rulesPath) ? JSON.stringify(readJson(rulesPath)) : '';
    writeFileSync(rulesPath, JSON.stringify(out.rulesFile, null, 2) + '\n');
    writeFileSync(statusPath, JSON.stringify(out.statusFile, null, 2) + '\n');
    const contentChanged = before !== JSON.stringify(out.rulesFile);
    console.log(`content_changed=${contentChanged} status_changed=${out.statusChanged} issues=${out.issues.length}`);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `content_changed=${contentChanged}\nstatus_changed=${out.statusChanged}\nissues=${out.issues.length}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch((e) => {
        console.error(e.message);
        process.exit(1);
    });
}
