import { describe, it, expect } from 'vitest';
import { normalizeHttpUrl, mapsSearchUrl } from './url';

describe('網址檢查', () => {
    it('補上 https，保留 http(s)', () => {
        expect(normalizeHttpUrl('photos.app.goo.gl/abc')).toBe('https://photos.app.goo.gl/abc');
        expect(normalizeHttpUrl('https://example.com/a')).toBe('https://example.com/a');
        expect(normalizeHttpUrl('http://example.com')).toBe('http://example.com/');
    });
    it('拒絕 javascript:、data:、file: 與亂打的文字', () => {
        expect(normalizeHttpUrl('javascript:alert(1)')).toBeNull();
        expect(normalizeHttpUrl('data:text/html,<b>x</b>')).toBeNull();
        expect(normalizeHttpUrl('file:///etc/passwd')).toBeNull();
        expect(normalizeHttpUrl('隨便打')).toBeNull();
        expect(normalizeHttpUrl('   ')).toBeNull();
    });
    it('地圖搜尋網址會編碼', () => {
        expect(mapsSearchUrl('札幌 拉麵 & 咖啡')).toContain(encodeURIComponent('札幌 拉麵 & 咖啡'));
    });
});
