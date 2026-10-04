/** 只接受 http(s) 網址；其他（javascript:、data: 等）一律拒絕。回傳正規化後的網址或 null。 */
export function normalizeHttpUrl(input: string): string | null {
    const raw = input.trim();
    if (!raw) return null;
    let candidate = raw;
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
        // 已有協定：只放行 http(s)，其他（javascript:、data: 等）一律拒絕
        if (!/^https?:\/\//i.test(raw)) return null;
    } else {
        candidate = `https://${raw}`;
    }
    try {
        const u = new URL(candidate);
        if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
        if (!u.hostname.includes('.') && u.hostname !== 'localhost') return null;
        return u.toString();
    } catch {
        return null;
    }
}

export function openExternal(url: string): void {
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (w) w.opener = null;
}

export function mapsSearchUrl(query: string): string {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
