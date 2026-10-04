import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateRules, matchCustomsRules, keywordMatches } from './customs';

const real = validateRules(JSON.parse(readFileSync(resolve(process.cwd(), 'public/prohibited_rules.json'), 'utf8')));

describe('海關規則', () => {
    it('隨附的規則檔通過驗證，且不再宣稱「自動更新」', () => {
        expect(real).not.toBeNull();
        expect(JSON.stringify(real)).not.toMatch(/自動更新/);
        expect(real!.last_reviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('東京、Sapporo 與 Tokyo, Japan 命中日本規則', () => {
        for (const loc of ['Tokyo, Japan', '北海道', 'Hokkaido', 'osaka']) {
            const m = matchCustomsRules(loc, real!.rules);
            expect(m.length, loc).toBeGreaterThan(0);
            expect(m[0].message).toMatch(/日本/);
        }
    });

    it('英文縮寫必須是獨立單字：Austria、Houston、Russia 不會被當成美國', () => {
        expect(keywordMatches('Austria', 'us')).toBe(false);
        expect(keywordMatches('Houston', 'us')).toBe(false);
        expect(keywordMatches('Brussels, Belgium', 'us')).toBe(false);
        expect(keywordMatches('Salzburg, Austria', 'us')).toBe(false);
        expect(keywordMatches('New York, US', 'us')).toBe(true);
        expect(keywordMatches('us', 'us')).toBe(true);
        expect(matchCustomsRules('Austria', real!.rules).some((r) => /美國/.test(r.message))).toBe(false);
    });

    it('空地點不命中任何規則', () => {
        expect(matchCustomsRules('', real!.rules)).toEqual([]);
        expect(matchCustomsRules('   ', real!.rules)).toEqual([]);
    });

    it('格式不對的規則檔一律拒絕（不會把壞資料顯示給使用者）', () => {
        expect(validateRules(null)).toBeNull();
        expect(validateRules({})).toBeNull();
        expect(validateRules({ rules: [] })).toBeNull();
        expect(validateRules({ rules: [{ keywords: [], message: 'x' }] })).toBeNull();
        expect(validateRules({ rules: [{ keywords: ['日本'], message: '' }] })).toBeNull();
        expect(validateRules({ rules: [{ keywords: [1], message: 'x' }] })).toBeNull();
        expect(validateRules({ rules: [{ keywords: ['日本'], message: 'x'.repeat(501) }] })).toBeNull();
        expect(validateRules({ rules: [{ keywords: ['日本'], message: '提醒' }] })).not.toBeNull();
    });
});
