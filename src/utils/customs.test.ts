import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateRulesFile, validateStatusFile, selectRules, keywordMatches, freshness, type SourceStatus } from './customs';

const load = (n: string) => JSON.parse(readFileSync(resolve(process.cwd(), 'public', n), 'utf8'));
const rules = validateRulesFile(load('prohibited_rules.json'));
const status = validateStatusFile(load('rules-status.json'));

describe('隨附的規則檔（由官方來源核對產生）', () => {
    it('通過驗證；每條規則都有官方來源網址；不含舊版的「自動更新版」', () => {
        expect(rules).not.toBeNull();
        expect(status).not.toBeNull();
        for (const r of rules!.rules) {
            const s = rules!.sources.find((x) => x.id === r.source_id);
            expect(s?.url, r.id).toMatch(/^https:\/\//);
            expect(status!.sources[r.source_id], r.id).toBeTruthy();
        }
        expect(JSON.stringify(rules)).not.toMatch(/自動更新版/);
    });

    it('回台灣的規則一律顯示；日本與新加坡規則依目的地比對', () => {
        const jp = selectRules('Sapporo, Japan', rules!.rules).map((r) => r.id);
        expect(jp.slice(0, 2)).toEqual(['jp-customs-passenger', 'jp-maff-animal']);
        expect(jp).toContain('tw-customs-prohibited');
        const none = selectRules('Paris, France', rules!.rules).map((r) => r.id);
        expect(none.every((id) => id.startsWith('tw-'))).toBe(true);
        expect(selectRules('', rules!.rules).every((r) => r.always)).toBe(true);
        expect(selectRules('新加坡', rules!.rules).some((r) => r.id === 'sg-customs-chewing-gum')).toBe(true);
    });
});

describe('比對與驗證', () => {
    it('英文縮寫必須是獨立單字：Austria 不會命中 us', () => {
        expect(keywordMatches('Salzburg, Austria', 'us')).toBe(false);
        expect(keywordMatches('Houston', 'us')).toBe(false);
        expect(keywordMatches('New York, US', 'us')).toBe(true);
        expect(keywordMatches('北海道', '北海道')).toBe(true);
    });

    it('格式不對的規則檔一律拒絕（不會把壞資料顯示給使用者）', () => {
        expect(validateRulesFile(null)).toBeNull();
        expect(validateRulesFile({})).toBeNull();
        const base = JSON.parse(JSON.stringify(rules));
        const withItems = (items: unknown) => ({ ...base, rules: base.rules.map((r: object, i: number) => (i === 0 ? { ...r, items } : r)) });
        expect(validateRulesFile(withItems([]))).toBeNull();
        expect(validateRulesFile(withItems(['ok', '']))).toBeNull();
        expect(validateRulesFile({ ...base, rules: base.rules.map((r: object, i: number) => (i === 0 ? { ...r, source_id: 'x' } : r)) })).toBeNull();
        expect(validateRulesFile({ ...base, schema: 1 })).toBeNull();
        expect(validateRulesFile({ ...base, sources: base.sources.map((s: object) => ({ ...s, url: 'http://insecure' })) })).toBeNull();
        expect(validateStatusFile({ schema: 1, checked_at: '2026-10-04', sources: { a: { status: 'weird', checked_at: '2026-10-04' } } })).toBeNull();
    });

    it('新鮮度：待確認、連線異常、超過 7 天未核對、正常', () => {
        const now = Date.parse('2026-10-20T00:00:00Z');
        const mk = (status: SourceStatus['status'], at: string): SourceStatus => ({ status, checked_at: at, hash: 'x'.repeat(64) });
        expect(freshness(mk('review', '2026-10-19'), now)).toEqual({ kind: 'review' });
        expect(freshness(mk('error', '2026-10-19'), now)).toEqual({ kind: 'error' });
        expect(freshness(mk('ok', '2026-10-01'), now)?.kind).toBe('stale');
        expect(freshness(mk('ok', '2026-10-19'), now)?.kind).toBe('ok');
        expect(freshness(undefined, now)).toBeNull();
    });
});
