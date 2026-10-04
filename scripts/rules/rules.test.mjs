import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SOURCES, ParseError } from './sources.mjs';
import { DEFINITIONS } from './definitions.mjs';
import { htmlToLines, sliceBetween, groupNumbered } from './extract.mjs';
import { runUpdate, openIssue, hashLines, diffLines } from './update.mjs';
import { validateRulesFile, validateStatusFile } from './schema.mjs';

const fx = (id) => readFileSync(resolve(process.cwd(), 'scripts/rules/fixtures', `${id}.html`), 'utf8');
const NOW = new Date('2026-10-05T03:17:00Z');

/** 以快照當成「官方網站」的假 fetch；overrides 可替換某個來源的回應。 */
function fakeFetch(overrides = {}) {
    const calls = [];
    const f = async (url, opts) => {
        calls.push({ url, ua: opts?.headers?.['User-Agent'] });
        const src = SOURCES.find((s) => s.url === url);
        if (!src) throw new Error('未知網址 ' + url);
        const o = overrides[src.id];
        if (o instanceof Error) throw o;
        if (typeof o === 'object' && o && 'status' in o) return new Response('x', { status: o.status });
        return new Response(typeof o === 'string' ? o : fx(src.id), { status: 200 });
    };
    f.calls = calls;
    return f;
}
const run = (o = {}) => runUpdate({ now: NOW, delayMs: 0, retryDelayMs: 0, ...o });

describe('解析器（以官方頁面快照為 fixture）', () => {
    for (const s of SOURCES) {
        it(`${s.id}：解析出合理的條目`, () => {
            const r = s.parse(fx(s.id));
            expect(r.lines.length).toBeGreaterThan(0);
            expect(r.lines.every((l) => typeof l === 'string' && l.trim().length > 0)).toBe(true);
        });
    }

    it('海關「禁止攜帶」：六條、含毒品與槍砲，並讀出頁面發布日期', () => {
        const r = SOURCES[0].parse(fx('tw-customs-prohibited'));
        expect(r.lines).toHaveLength(6);
        expect(r.lines[0]).toMatch(/^一、.*毒品/);
        expect(r.lines[1]).toMatch(/^二、.*槍砲/);
        expect(r.published).toBe('2026-08-24');
    });

    it('防檢署：抓到「不得攜帶」清單，含鮮果實與非洲豬瘟', () => {
        const r = SOURCES.find((s) => s.id === 'tw-aphia-traveler').parse(fx('tw-aphia-traveler'));
        expect(r.lines.join('\n')).toMatch(/鮮果實[\s\S]*非洲豬瘟/);
    });

    it('日本海關：含 Prohibited 與 Restricted 兩段；日本動檢：兩個關鍵事實句；新加坡：只取第一句', () => {
        const jp = SOURCES.find((s) => s.id === 'jp-customs-passenger').parse(fx('jp-customs-passenger')).lines;
        expect(jp[0]).toBe('Prohibited Articles');
        expect(jp).toContain('Restricted Articles');
        const aqs = SOURCES.find((s) => s.id === 'jp-maff-animal').parse(fx('jp-maff-animal')).lines;
        expect(aqs).toHaveLength(2);
        expect(aqs[1]).toMatch(/three million yen/);
        const sg = SOURCES.find((s) => s.id === 'sg-customs-chewing-gum').parse(fx('sg-customs-chewing-gum')).lines;
        expect(sg).toHaveLength(1);
        expect(sg[0]).toMatch(/absolutely prohibited/);
        expect(sg[0]).not.toMatch(/trader/);
    });

    it('頁面改版或內容被換掉時丟出 ParseError，絕不回傳殘缺資料', () => {
        for (const s of SOURCES) {
            expect(() => s.parse('<html><body><p>首頁維護中</p></body></html>'), s.id).toThrow(ParseError);
            expect(() => s.parse(''), s.id).toThrow(ParseError);
        }
        // 條目被刪到只剩 2 條
        const broken = fx('tw-customs-prohibited').replace(/三、[\s\S]*?(?=財政部關務署臺北關稽查組)/, '');
        expect(() => SOURCES[0].parse(broken)).toThrow(ParseError);
    });

    it('所有來源都是官方網域、https，且每條規則都對應到來源', () => {
        const hosts = SOURCES.map((s) => new URL(s.url).hostname);
        expect(hosts.every((h) => /(^|\.)(gov\.tw|go\.jp|gov\.sg)$/.test(h))).toBe(true);
        expect(SOURCES.every((s) => s.url.startsWith('https://'))).toBe(true);
        for (const d of DEFINITIONS) expect(SOURCES.some((s) => s.id === d.source_id)).toBe(true);
        expect(new Set(SOURCES.map((s) => s.id)).size).toBe(SOURCES.length);
    });

    it('extract 工具：區段界線與條目合併', () => {
        const lines = htmlToLines('<div>選單<a>禁止攜帶</a></div><h1>禁止攜帶</h1><p>一、甲</p><p>續行</p><p>二、乙</p><p>結尾 X</p>');
        const body = sliceBetween(lines, (l) => l === '禁止攜帶', (l) => l.startsWith('結尾'));
        expect(groupNumbered(body)).toEqual(['一、甲續行', '二、乙']);
    });
});

describe('自動更新流程', () => {
    it('初次建立：產生合法的規則檔與狀態檔，每條規則都有來源網址，並且只用公開頁面、帶可辨識的 User-Agent', async () => {
        const f = fakeFetch();
        const out = await run({ fetchImpl: f, init: true });
        expect(validateRulesFile(out.rulesFile)).toEqual([]);
        expect(validateStatusFile(out.statusFile)).toEqual([]);
        expect(out.rulesFile.rules).toHaveLength(DEFINITIONS.length);
        expect(out.rulesFile.rules.every((r) => out.rulesFile.sources.find((s) => s.id === r.source_id)?.url.startsWith('https://'))).toBe(true);
        expect(f.calls).toHaveLength(SOURCES.length); // 每個來源只請求一次
        expect(f.calls.every((c) => /hokkaido-app-rules-checker/.test(c.ua))).toBe(true);
        expect(out.issues).toHaveLength(0);
    });

    async function baseline() {
        const out = await run({ fetchImpl: fakeFetch(), init: true });
        return { rules: out.rulesFile, status: out.statusFile };
    }

    it('內容沒變：規則檔完全不動，只更新核對時間（狀態檔）', async () => {
        const { rules, status } = await baseline();
        const later = new Date('2026-10-06T03:17:00Z');
        const out = await runUpdate({ currentRules: rules, currentStatus: status, fetchImpl: fakeFetch(), now: later, delayMs: 0, retryDelayMs: 0 });
        expect(out.contentChanged).toBe(false);
        expect(JSON.stringify(out.rulesFile)).toBe(JSON.stringify(rules));
        expect(out.statusFile.checked_at).toBe(later.toISOString());
        expect(Object.values(out.statusFile.sources).filter((s) => !s.manual).every((s) => s.status === 'ok' && s.checked_at === later.toISOString())).toBe(true); // 人工核對項目保持上次人工核對的時間
        expect(out.statusChanged).toBe(false); // 只有時間不同，不算「狀態變動」（不會觸發無意義的部署）
        expect(out.issues).toHaveLength(0);
    });

    it('中文官方原文（verbatim）有可靠的變動：自動更新並記錄變更摘要', async () => {
        const { rules, status } = await baseline();
        const changed = fx('tw-customs-prohibited').replace('偽造或變造之貨幣、有價證券及印製偽幣印模', '偽造或變造之貨幣與新增測試條目甲乙丙丁戊己庚辛壬癸');
        const out = await run({ currentRules: rules, currentStatus: status, fetchImpl: fakeFetch({ 'tw-customs-prohibited': changed }) });
        expect(out.contentChanged).toBe(true);
        const r = out.rulesFile.rules.find((x) => x.id === 'tw-customs-prohibited');
        expect(r.items.join('')).toContain('新增測試條目');
        expect(r.change.at).toBe('2026-10-05');
        expect(r.change.summary).toBe('新增 1 條、移除 1 條');
        expect(r.change.added[0]).toContain('新增測試條目');
        expect(out.statusFile.sources['tw-customs-prohibited'].status).toBe('ok');
        expect(out.issues).toHaveLength(0);
        expect(validateRulesFile(out.rulesFile)).toEqual([]);
    });

    it('英文官方頁（curated）有變動：不覆蓋白話摘要，標為待確認並產生帶差異與來源連結的 Issue', async () => {
        const { rules, status } = await baseline();
        const changed = fx('jp-customs-passenger').replace('There are quantity restrictions on the import of medicine and cosmetics.', 'There are NEW quantity restrictions on the import of medicine and cosmetics.');
        const out = await run({ currentRules: rules, currentStatus: status, fetchImpl: fakeFetch({ 'jp-customs-passenger': changed }) });
        const rule = out.rulesFile.rules.find((r) => r.id === 'jp-customs-passenger');
        const before = rules.rules.find((r) => r.id === 'jp-customs-passenger');
        expect(rule).toEqual(before); // 摘要與原文基準完全沒被覆蓋
        expect(out.statusFile.sources['jp-customs-passenger'].status).toBe('review');
        expect(out.statusFile.sources['jp-customs-passenger'].pending_hash).toMatch(/^[0-9a-f]{64}$/);
        expect(out.issues).toHaveLength(1);
        expect(out.issues[0].body).toContain('https://www.customs.go.jp/english/summary/passenger.htm');
        expect(out.issues[0].body).toContain('NEW quantity restrictions');
        expect(out.contentChanged).toBe(false);
    });

    it('同一個待確認的變動隔天再跑，不會重複開 Issue', async () => {
        const { rules, status } = await baseline();
        const changed = fx('jp-customs-passenger').replace('2 months', '3 months');
        const f = () => fakeFetch({ 'jp-customs-passenger': changed });
        const day1 = await run({ currentRules: rules, currentStatus: status, fetchImpl: f() });
        day1.statusFile.sources['jp-customs-passenger'].issue_url = 'https://github.com/x/y/issues/1';
        const day2 = await runUpdate({ currentRules: day1.rulesFile, currentStatus: day1.statusFile, fetchImpl: f(), now: new Date('2026-10-06T03:17:00Z'), delayMs: 0, retryDelayMs: 0 });
        expect(day2.issues).toHaveLength(0);
        expect(day2.statusFile.sources['jp-customs-passenger'].issue_url).toBe('https://github.com/x/y/issues/1');
        expect(day2.statusFile.sources['jp-customs-passenger'].status).toBe('review');
    });

    it('人工確認後（--accept）把新版官方原文設為基準，狀態回到正常', async () => {
        const { rules, status } = await baseline();
        const changed = fx('jp-customs-passenger').replace('2 months', '3 months');
        const out = await run({ currentRules: rules, currentStatus: status, fetchImpl: fakeFetch({ 'jp-customs-passenger': changed }), accept: ['jp-customs-passenger'] });
        expect(out.statusFile.sources['jp-customs-passenger'].status).toBe('ok');
        expect(out.rulesFile.rules.find((r) => r.id === 'jp-customs-passenger').items.join(' ')).toContain('3 months');
    });

    it('解析失敗（官方改版）：不覆蓋現有規則、標為待確認並開 Issue', async () => {
        const { rules, status } = await baseline();
        const out = await run({ currentRules: rules, currentStatus: status, fetchImpl: fakeFetch({ 'tw-customs-food': '<html><body>新版面</body></html>' }) });
        expect(out.rulesFile.rules.find((r) => r.id === 'tw-customs-food')).toEqual(rules.rules.find((r) => r.id === 'tw-customs-food'));
        const st = out.statusFile.sources['tw-customs-food'];
        expect(st.status).toBe('review');
        expect(st.message).toMatch(/結構有變/);
        expect(out.issues).toHaveLength(1);
        expect(out.issues[0].body).toContain('https://web.customs.gov.tw/');
        expect(validateRulesFile(out.rulesFile)).toEqual([]);
    });

    it('網路暫時失敗：沿用舊規則，標為 error；連續 3 天才開 Issue', async () => {
        let cur = await baseline();
        let issues = 0;
        for (let day = 0; day < 3; day++) {
            const out = await runUpdate({ currentRules: cur.rules, currentStatus: cur.status, fetchImpl: fakeFetch({ 'tw-customs-medicine': { status: 503 } }), now: new Date(NOW.getTime() + day * 86400000), delayMs: 0, retryDelayMs: 0 });
            expect(out.statusFile.sources['tw-customs-medicine'].status).toBe('error');
            expect(out.statusFile.sources['tw-customs-medicine'].checked_at).toBe(cur.status.sources['tw-customs-medicine'].checked_at); // 最後成功核對時間不變
            issues += out.issues.length;
            if (day < 2) expect(out.issues).toHaveLength(0);
            cur = { rules: out.rulesFile, status: out.statusFile };
        }
        expect(issues).toBe(1);
    });

    it('官方內容條目突然腰斬：視為無法可靠判讀，不自動更新', async () => {
        const { rules, status } = await baseline();
        // 只剩 2 條符合解析下限之外的情況：用能通過 parse 的最小版本模擬（food 頁）
        const r = rules.rules.find((x) => x.id === 'tw-customs-medicine');
        const fewer = { ...rules, rules: rules.rules.map((x) => (x.id === r.id ? { ...x, items: [...x.items, ...x.items, ...x.items] } : x)) }; // 舊的比新的多三倍
        const out = await run({ currentRules: fewer, currentStatus: status, fetchImpl: fakeFetch() });
        expect(out.statusFile.sources['tw-customs-medicine'].status).toBe('review');
        expect(out.rulesFile.rules.find((x) => x.id === r.id).items).toHaveLength(r.items.length * 3);
        expect(out.issues).toHaveLength(1);
    });

    it('第一次建立時有來源失敗：直接丟錯，不產生殘缺規則檔', async () => {
        await expect(run({ fetchImpl: fakeFetch({ 'jp-maff-animal': { status: 500 } }), init: true })).rejects.toThrow(/第一次建立/);
    });

    it('產生的規則若結構不合法（例如空白條目）會被拒絕寫入', async () => {
        const bad = { ...(await baseline()).rules };
        bad.rules = bad.rules.map((r, i) => (i === 0 ? { ...r, items: [''] } : r));
        expect(validateRulesFile(bad).join()).toMatch(/items/);
        bad.rules = bad.rules.map((r, i) => (i === 0 ? { ...r, source_id: 'nope' } : r));
        expect(validateRulesFile(bad).join()).toMatch(/來源/);
    });

    it('hash 與差異工具', () => {
        expect(hashLines(['a', 'b'])).toBe(hashLines(['a', 'b']));
        expect(hashLines(['a', 'b'])).not.toBe(hashLines(['b', 'a']));
        expect(diffLines(['a', 'b'], ['b', 'c'])).toEqual({ added: ['c'], removed: ['a'] });
    });
});

describe('開 Issue（只用 GITHUB_TOKEN）', () => {
    const issue = { key: 'jp:abc', title: 't', body: 'b' };
    it('沒有重複時建立，帶 rules-review 標籤與去重標記', async () => {
        const calls = [];
        const f = async (url, o) => {
            calls.push({ url, o });
            if (!o?.method) return new Response('[]', { status: 200 });
            return new Response(JSON.stringify({ html_url: 'https://github.com/o/r/issues/9' }), { status: 201 });
        };
        const url = await openIssue({ repo: 'o/r', token: 'TOKEN', issue, fetchImpl: f });
        expect(url).toBe('https://github.com/o/r/issues/9');
        const post = JSON.parse(calls[1].o.body);
        expect(post.labels).toEqual(['rules-review']);
        expect(post.body).toContain('<!-- rules-key:jp:abc -->');
        expect(calls[1].o.headers.Authorization).toBe('Bearer TOKEN');
    });
    it('已有同 key 的未關閉 Issue 就不再建立', async () => {
        const f = async (url, o) => {
            if (o?.method === 'POST') throw new Error('不該建立');
            return new Response(JSON.stringify([{ html_url: 'https://github.com/o/r/issues/3', body: '<!-- rules-key:jp:abc -->\nx' }]), { status: 200 });
        };
        expect(await openIssue({ repo: 'o/r', token: 't', issue, fetchImpl: f })).toBe('https://github.com/o/r/issues/3');
    });
    it('API 失敗會丟錯（由呼叫端處理，不影響規則檔）', async () => {
        await expect(openIssue({ repo: 'o/r', token: 't', issue, fetchImpl: async () => new Response('no', { status: 403 }) })).rejects.toThrow(/403/);
    });
});

describe('人工核對的來源（機器連不上的官方網站）', () => {
    it('自動流程不會連線也不會改動；本機以 --manual 才會核對', async () => {
        const base = await run({ fetchImpl: fakeFetch(), init: true });
        const f = fakeFetch({ 'tw-aphia-traveler': new Error('逾時') });
        const out = await run({ currentRules: base.rulesFile, currentStatus: base.statusFile, fetchImpl: f });
        expect(f.calls.some((c) => c.url.includes('aphia.gov.tw'))).toBe(false);
        expect(out.statusFile.sources['tw-aphia-traveler']).toEqual({ ...base.statusFile.sources['tw-aphia-traveler'], manual: true });
        expect(out.statusFile.sources['tw-aphia-traveler'].status).toBe('ok');
        expect(out.issues).toHaveLength(0);
        const manual = await run({ currentRules: base.rulesFile, currentStatus: base.statusFile, fetchImpl: fakeFetch(), includeManual: true, now: new Date('2026-11-01T00:00:00Z') });
        expect(manual.statusFile.sources['tw-aphia-traveler'].checked_at).toBe('2026-11-01T00:00:00.000Z');
        expect(manual.rulesFile.sources.find((s) => s.id === 'tw-aphia-traveler').manual).toBe(true);
    });
});
