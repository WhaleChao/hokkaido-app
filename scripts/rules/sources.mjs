// 官方來源登錄表。只收政府機關自己的公開網頁；每個來源有：
//   - url        人可以打開核對的官方網址（也是 App 顯示的來源連結）
//   - mode       verbatim＝官方中文原文，解析成功且有變動就自動更新；
//                curated＝英／日文官方頁，App 顯示人工整理的白話摘要，官方內容有變動時不自動改寫，只開 Issue 請人確認
//   - parse(html)→{ lines, published? }，失敗或不符預期要丟錯（絕不回傳殘缺資料）
import { htmlToLines, sliceBetween, groupNumbered } from './extract.mjs';

export class ParseError extends Error {}

function need(cond, msg) {
    if (!cond) throw new ParseError(msg);
}
function includesAll(lines, words, what) {
    const joined = lines.join('\n');
    for (const w of words) need(joined.includes(w), `${what}：找不到預期字樣「${w}」，頁面結構可能已改變`);
}
function published(lines) {
    for (const l of lines) {
        const m = /發布日期[：:]\s*(\d{4}-\d{2}-\d{2})/.exec(l);
        if (m) return m[1];
    }
    return undefined;
}

const customsEnd = (l) => l.startsWith('財政部關務署臺北關稽查組');

export const SOURCES = [
    {
        id: 'tw-customs-prohibited',
        mode: 'verbatim',
        agency: '財政部關務署（臺北關）',
        name: '入境旅客：禁止攜帶',
        url: 'https://web.customs.gov.tw/taipei/singlehtml/3392?cntId=cus2_3392_3392_1342',
        lang: 'zh',
        parse(html) {
            const all = htmlToLines(html);
            const body = sliceBetween(all, (l) => l === '禁止攜帶', customsEnd);
            need(body, '禁止攜帶：找不到內容區段');
            const items = groupNumbered(body);
            need(items.length >= 5 && items.length <= 12, `禁止攜帶：條目數量異常（${items.length}）`);
            includesAll(items, ['毒品', '槍砲'], '禁止攜帶');
            return { lines: items, published: published(all) };
        },
    },
    {
        id: 'tw-customs-medicine',
        mode: 'verbatim',
        agency: '財政部關務署（臺北關）',
        name: '入境旅客：藥物及醫療器材（自用藥物限量）',
        url: 'https://web.customs.gov.tw/taipei/singlehtml/3392?cntId=cus2_3392_3392_1347',
        lang: 'zh',
        parse(html) {
            const all = htmlToLines(html);
            const start = all.findIndex((l) => l === '一、自用藥物');
            const end = all.findIndex((l) => l === '二、醫療器材');
            need(start >= 0 && end > start, '自用藥物：找不到內容區段');
            const lines = all.slice(start + 1, end).filter((l) => l.length >= 10 && !l.startsWith('♦') && !/^※下表所定/.test(l));
            need(lines.length >= 8 && lines.length <= 60, `自用藥物：行數異常（${lines.length}）`);
            includesAll(lines, ['非處方藥', '處方', '12', '36'], '自用藥物');
            return { lines, published: published(all) };
        },
    },
    {
        id: 'tw-customs-food',
        mode: 'verbatim',
        agency: '財政部關務署（臺北關）',
        name: '入境旅客：農畜水產品及食品',
        url: 'https://web.customs.gov.tw/taipei/singlehtml/3392?cntId=cus2_3392_3392_1351',
        lang: 'zh',
        parse(html) {
            const all = htmlToLines(html);
            const start = all.findIndex((l) => l.startsWith('※每位旅客攜帶農畜水產或食品類入境'));
            const end = all.findIndex((l) => l.startsWith('四、動植物保育'));
            need(start >= 0 && end > start, '農畜水產品及食品：找不到內容區段');
            const lines = all
                .slice(start, end)
                .filter((l) => l.length >= 8 && !l.startsWith('♦') && !/信箱$/.test(l))
                .filter((l) => !/^\s*[一二三四五]、\s*(動植物檢疫|限量|食品檢驗|動植物保育)\s*$/.test(l));
            need(lines.length >= 10 && lines.length <= 80, `農畜水產品及食品：行數異常（${lines.length}）`);
            includesAll(lines, ['6公斤', '非洲豬瘟', '1,000美元'], '農畜水產品及食品');
            return { lines, published: published(all) };
        },
    },
    {
        id: 'tw-aphia-traveler',
        mode: 'verbatim',
        agency: '農業部動植物防疫檢疫署',
        name: '入境旅客專區（出國必看不買清單）',
        url: 'https://www.aphia.gov.tw/ws.php?id=4502',
        lang: 'zh',
        parse(html) {
            const all = htmlToLines(html);
            const start = all.findIndex((l) => l.startsWith('入境旅客攜帶動植物或其產品'));
            const end = all.findIndex((l, i) => i > start && l === '動物及動物產品檢疫');
            need(start >= 0 && end > start, '入境旅客專區：找不到內容區段');
            const lines = all.slice(start, end);
            need(lines.length >= 5 && lines.length <= 20, `入境旅客專區：行數異常（${lines.length}）`);
            includesAll(lines, ['鮮果實', '非洲豬瘟'], '入境旅客專區');
            return { lines };
        },
    },
    {
        id: 'jp-customs-passenger',
        mode: 'curated',
        agency: '日本財務省關稅局（Japan Customs）',
        name: 'Passenger（旅客攜帶品：禁止與限制物品）',
        url: 'https://www.customs.go.jp/english/summary/passenger.htm',
        lang: 'en',
        parse(html) {
            const all = htmlToLines(html);
            const start = all.findIndex((l) => l === 'Prohibited Articles');
            const end = all.findIndex((l, i) => i > start && l === 'Purchase of Tax-Free Goods');
            need(start >= 0 && end > start, 'Japan Customs：找不到 Prohibited／Restricted 區段');
            const lines = all.slice(start, end).filter((l) => !/^\*?Click here/i.test(l));
            need(lines.length >= 8 && lines.length <= 60, `Japan Customs：行數異常（${lines.length}）`);
            includesAll(lines, ['Heroin', 'Restricted Articles', 'medicine'], 'Japan Customs');
            return { lines };
        },
    },
    {
        id: 'jp-maff-animal',
        mode: 'curated',
        agency: '日本農林水產省動物檢疫所（MAFF AQS）',
        name: 'Q&A for travelers：攜帶畜產品入境',
        url: 'https://www.maff.go.jp/e/policies/ap_health/animal/240904.html',
        lang: 'en',
        parse(html) {
            const all = htmlToLines(html);
            // 只監看兩個關鍵事實句（範圍與罰則），頁面其餘 Q&A 的改版不會觸發誤報
            const scope = all.find((l) => l.includes('cured ham') && l.includes('sausage'));
            const penalty = all.find((l) => l.includes('three million yen'));
            need(scope, 'MAFF 動物檢疫：找不到畜產品範圍說明句');
            need(penalty, 'MAFF 動物檢疫：找不到罰則說明句');
            return { lines: [scope, penalty] };
        },
    },
    {
        id: 'sg-customs-chewing-gum',
        mode: 'curated',
        agency: '新加坡海關（Singapore Customs）',
        name: 'Chewing Gum (HS Code 17041000)',
        url: 'https://customs.gov.sg/businesses/national-single-window/tradenet/competent-authorities-requirements/chewing-gum',
        lang: 'en',
        parse(html) {
            const all = htmlToLines(html);
            const line = all.find((l) => l.startsWith('The import of chewing gum'));
            need(line, '新加坡海關：找不到口香糖進口規定句');
            need(/prohibited/i.test(line), '新加坡海關：規定句不含 prohibited，內容可能已改變');
            // 只監看第一句（禁止進口的本文）；後面關於貿易商再出口的條件不影響旅客，不納入以免誤報
            const first = line.split(/\.\s+However/)[0].replace(/\.?$/, '.');
            return { lines: [first] };
        },
    },
];

export function sourceById(id) {
    return SOURCES.find((s) => s.id === id);
}
