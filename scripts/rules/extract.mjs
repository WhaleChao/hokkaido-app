// HTML → 純文字行。官方頁面的版型常改，所以不依賴 CSS 選擇器，而是轉成「一行一段」的文字後，
// 用頁面上穩定的標題與結尾字樣當界線（見 sources.mjs）。
import * as cheerio from 'cheerio';

const BLOCK = 'p,div,li,tr,td,th,h1,h2,h3,h4,h5,h6,section,article,ul,ol,table,dd,dt,caption,br';

export function htmlToLines(html) {
    const $ = cheerio.load(html);
    $('script,style,noscript,template').remove();
    $('br').replaceWith('\n');
    $(BLOCK).each((_, el) => {
        $(el).append('\n');
    });
    const text = $('body').length ? $('body').text() : $.root().text();
    return text
        .replace(/[ 　\t ]+/g, ' ')
        .split(/\n+/)
        .map((l) => l.trim())
        .filter(Boolean);
}

/** 取兩個界線行之間的內容（不含界線）。start 取「最後一個」符合的行，避免抓到選單裡同名的連結。 */
export function sliceBetween(lines, startTest, endTest, { lastStart = true } = {}) {
    let end = lines.findIndex((l, i) => i > 0 && endTest(l));
    if (end < 0) return null;
    let start = -1;
    for (let i = 0; i < end; i++) if (startTest(lines[i])) start = i;
    if (!lastStart) start = lines.findIndex((l) => startTest(l));
    if (start < 0 || start >= end) return null;
    return lines.slice(start + 1, end);
}

/** 把「一、」「二、」開頭的條目合併成一條（含換行續行）。 */
export function groupNumbered(lines, re = /^[一二三四五六七八九十]+、/) {
    const out = [];
    for (const l of lines) {
        if (re.test(l) || out.length === 0) out.push(l);
        else out[out.length - 1] += l;
    }
    return out;
}
