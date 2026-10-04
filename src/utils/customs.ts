// 海關／檢疫規則：資料由 GitHub Actions 每天從官方網頁核對（scripts/rules/）。
// 這裡只負責「驗證」與「比對目的地」，壞資料一律不顯示。

export interface RuleSource {
    id: string;
    agency: string;
    name: string;
    url: string;
    lang: 'zh' | 'en' | 'ja';
    mode: 'verbatim' | 'curated';
    published?: string;
    /** 機器連不上該機關網站，由人工定期核對 */
    manual?: boolean;
}

export interface CustomsRule {
    id: string;
    source_id: string;
    mode: 'verbatim' | 'curated';
    title: string;
    lead: string;
    always: boolean;
    keywords: string[];
    items: string[];
    summary?: string[];
    reviewed_hash?: string;
    change?: { at: string; summary: string; added?: string[]; removed?: string[] };
}

export interface RulesFile {
    schema: 2;
    updated_at: string;
    sources: RuleSource[];
    rules: CustomsRule[];
}

export type SourceStatusKind = 'ok' | 'review' | 'error';

export interface SourceStatus {
    status: SourceStatusKind;
    checked_at: string;
    attempted_at?: string;
    hash: string;
    message?: string;
    issue_url?: string;
    manual?: boolean;
}

export interface StatusFile {
    schema: 1;
    checked_at: string;
    sources: Record<string, SourceStatus>;
}

const isStr = (v: unknown, max = 4000): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v);

/** 驗證規則檔，任何一項不符就整份拒絕（回傳 null），不顯示殘缺資料。 */
export function validateRulesFile(d: unknown): RulesFile | null {
    if (!d || typeof d !== 'object') return null;
    const x = d as Record<string, unknown>;
    if (x.schema !== 2 || !isDate(x.updated_at) || !Array.isArray(x.sources) || !Array.isArray(x.rules) || x.rules.length === 0) return null;
    const ids = new Set<string>();
    for (const s of x.sources as Record<string, unknown>[]) {
        if (!s || !isStr(s.id, 80) || !isStr(s.name, 200) || !isStr(s.agency, 200) || !/^https:\/\//.test(String(s.url)) || !['zh', 'en', 'ja'].includes(String(s.lang)) || !['verbatim', 'curated'].includes(String(s.mode))) return null;
        ids.add(s.id as string);
    }
    for (const r of x.rules as Record<string, unknown>[]) {
        if (!r || !isStr(r.id, 80) || !ids.has(String(r.source_id)) || !isStr(r.title, 120) || !isStr(r.lead, 300)) return null;
        if (!['verbatim', 'curated'].includes(String(r.mode)) || typeof r.always !== 'boolean') return null;
        if (!Array.isArray(r.keywords) || !r.keywords.every((k) => isStr(k, 40)) || (!r.always && r.keywords.length === 0)) return null;
        if (!Array.isArray(r.items) || r.items.length === 0 || !r.items.every((i) => isStr(i))) return null;
        if (r.mode === 'curated' && (!Array.isArray(r.summary) || r.summary.length === 0 || !r.summary.every((i) => isStr(i)))) return null;
        if (r.change !== undefined && (!r.change || !isDate((r.change as Record<string, unknown>).at) || !isStr((r.change as Record<string, unknown>).summary, 400))) return null;
    }
    return d as RulesFile;
}

export function validateStatusFile(d: unknown): StatusFile | null {
    if (!d || typeof d !== 'object') return null;
    const x = d as Record<string, unknown>;
    if (x.schema !== 1 || !isDate(x.checked_at) || !x.sources || typeof x.sources !== 'object') return null;
    for (const s of Object.values(x.sources as Record<string, Record<string, unknown>>)) {
        if (!s || !['ok', 'review', 'error'].includes(String(s.status)) || !isDate(s.checked_at)) return null;
    }
    return d as StatusFile;
}

function escapeRe(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 英文關鍵字必須是獨立單字（避免 Austria 命中 us）；中文關鍵字用包含比對。 */
export function keywordMatches(location: string, keyword: string): boolean {
    const kw = keyword.trim().toLowerCase();
    const loc = location.toLowerCase();
    if (!kw) return false;
    if (/^[a-z0-9 .'-]+$/.test(kw)) return new RegExp(`(^|[^a-z0-9])${escapeRe(kw)}($|[^a-z0-9])`).test(loc);
    return loc.includes(kw);
}

/** 依目的地挑出規則：always（例如回台灣的入境規定）一律顯示；其餘用關鍵字比對。目的地規則排在前面。 */
export function selectRules(location: string, rules: CustomsRule[]): CustomsRule[] {
    const dest = location.trim() ? rules.filter((r) => !r.always && r.keywords.some((k) => keywordMatches(location, k))) : [];
    return [...dest, ...rules.filter((r) => r.always)];
}

export type Freshness = { kind: 'ok'; days: number } | { kind: 'stale'; days: number } | { kind: 'review' } | { kind: 'error' };

const DAY = 86400000;

/** 單一來源的狀態：待確認、連線異常、太久沒核對（超過 7 天）或正常。 */
export function freshness(status: SourceStatus | undefined, now: number): Freshness | null {
    const limit = status?.manual ? 45 : 7;
    if (!status) return null;
    if (status.status === 'review') return { kind: 'review' };
    const days = Math.floor((now - Date.parse(status.checked_at)) / DAY);
    if (status.status === 'error') return { kind: 'error' };
    return days > limit ? { kind: 'stale', days } : { kind: 'ok', days: Math.max(0, days) };
}
