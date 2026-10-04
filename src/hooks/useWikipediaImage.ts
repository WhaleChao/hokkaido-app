import { useState, useEffect } from 'react';

// 景點背景圖：用地名去 Wikipedia 找縮圖。查不到或離線就不顯示（純裝飾，不影響功能）。
// 結果只放在記憶體；瀏覽器／Service Worker 會快取圖片本身。
const imageCache = new Map<string, string | null>();

async function lookup(host: 'zh' | 'en', query: string, signal: AbortSignal): Promise<string | null> {
    const res = await fetch(
        `https://${host}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=1&prop=pageimages&pithumbsize=600&format=json&origin=*`,
        { signal },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { query?: { pages?: Record<string, { thumbnail?: { source?: string } }> } };
    const pages = Object.values(data.query?.pages ?? {});
    const src = pages[0]?.thumbnail?.source;
    return typeof src === 'string' && src.startsWith('https://') ? src : null;
}

export function useWikipediaImage(query: string): string | null {
    const [fetched, setFetched] = useState<{ q: string; url: string | null } | null>(null);
    const cached = imageCache.get(query);

    useEffect(() => {
        if (!query || imageCache.has(query) || !navigator.onLine) return;
        const ctrl = new AbortController();
        (async () => {
            try {
                const url = (await lookup('zh', query, ctrl.signal)) ?? (await lookup('en', query, ctrl.signal));
                imageCache.set(query, url);
                setFetched({ q: query, url });
            } catch {
                /* 離線或被中止：保持沒有背景圖，不顯示錯誤（純裝飾） */
            }
        })();
        return () => ctrl.abort();
    }, [query]);

    if (cached !== undefined) return cached;
    return fetched && fetched.q === query ? fetched.url : null;
}
