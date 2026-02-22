import { useState, useEffect } from 'react';

// Keep a simple memory cache to avoid thrashing Wikipedia APIs on re-renders
const imageCache: Record<string, string> = {};

export function useWikipediaImage(query: string) {
    const [imageUrl, setImageUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!query) return;

        if (imageCache[query]) {
            setImageUrl(imageCache[query]);
            return;
        }

        let isMounted = true;

        const fetchImage = async () => {
            try {
                // First attempt: Chinese Wikipedia
                const res = await fetch(`https://zh.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=1&prop=pageimages&pithumbsize=600&format=json&origin=*`);
                const data = await res.json();

                if (data.query && data.query.pages) {
                    const pages = Object.values(data.query.pages) as any[];
                    if (pages.length > 0 && pages[0].thumbnail) {
                        const url = pages[0].thumbnail.source;
                        imageCache[query] = url;
                        if (isMounted) setImageUrl(url);
                        return;
                    }
                }

                // Fallback attempt: English Wikipedia
                const enRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=1&prop=pageimages&pithumbsize=600&format=json&origin=*`);
                const enData = await enRes.json();
                if (enData.query && enData.query.pages) {
                    const pages = Object.values(enData.query.pages) as any[];
                    if (pages.length > 0 && pages[0].thumbnail) {
                        const url = pages[0].thumbnail.source;
                        imageCache[query] = url;
                        if (isMounted) setImageUrl(url);
                    }
                }
            } catch (e) {
                console.error('Failed to fetch Wikipedia image', e);
            }
        };

        fetchImage();

        return () => {
            isMounted = false;
        };
    }, [query]);

    return imageUrl;
}
