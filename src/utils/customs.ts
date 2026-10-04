export interface CustomsRule {
    keywords: string[];
    message: string;
}

export interface CustomsRules {
    rules: CustomsRule[];
    last_reviewed?: string;
    sources?: { name: string; url: string }[];
}

/** 驗證規則檔：格式不對就回傳 null，絕不把壞資料顯示給使用者。 */
export function validateRules(data: unknown): CustomsRules | null {
    if (!data || typeof data !== 'object') return null;
    const d = data as Record<string, unknown>;
    if (!Array.isArray(d.rules) || d.rules.length === 0) return null;
    const rules: CustomsRule[] = [];
    for (const r of d.rules) {
        if (!r || typeof r !== 'object') return null;
        const { keywords, message } = r as Record<string, unknown>;
        if (!Array.isArray(keywords) || keywords.length === 0) return null;
        if (!keywords.every((k) => typeof k === 'string' && k.trim().length > 0 && k.length <= 40)) return null;
        if (typeof message !== 'string' || message.trim().length === 0 || message.length > 500) return null;
        rules.push({ keywords: keywords as string[], message });
    }
    const out: CustomsRules = { rules };
    if (typeof d.last_reviewed === 'string') out.last_reviewed = d.last_reviewed;
    if (Array.isArray(d.sources)) {
        out.sources = d.sources.filter(
            (s): s is { name: string; url: string } =>
                !!s && typeof (s as { name?: unknown }).name === 'string' && /^https:\/\//.test(String((s as { url?: unknown }).url)),
        );
    }
    return out;
}

function escapeRe(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 英文關鍵字（us、uk、jp…）必須是獨立單字才算命中，
 * 否則 "Austria"、"Houston" 會被誤判成美國。中文關鍵字用包含比對。
 */
export function keywordMatches(location: string, keyword: string): boolean {
    const kw = keyword.trim().toLowerCase();
    const loc = location.toLowerCase();
    if (!kw) return false;
    if (/^[a-z0-9 .'-]+$/.test(kw)) {
        return new RegExp(`(^|[^a-z0-9])${escapeRe(kw)}($|[^a-z0-9])`).test(loc);
    }
    return loc.includes(kw);
}

export function matchCustomsRules(location: string, rules: CustomsRule[]): CustomsRule[] {
    if (!location.trim()) return [];
    return rules.filter((r) => r.keywords.some((k) => keywordMatches(location, k)));
}
