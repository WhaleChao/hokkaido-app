/**
 * 導航用的搜尋字串：標題只是「午餐」「點心」這類通用字時，改用說明第一行的店名，
 * 這樣 Google 地圖才找得到真正的店。
 */
export function getSmartMapQuery(title: string, desc: string, origMapQuery: string): string {
    const query = title.replace(/\[.*?\]\s*/, '').split('→').pop() || title;
    const genericNames = /.*(早餐|午餐|晚餐|宵夜|點心|下午茶|休息|吃飯|用餐).*/i;

    if (genericNames.test(query.trim()) && desc) {
        if (origMapQuery && origMapQuery !== title && !genericNames.test(origMapQuery.trim())) return origMapQuery;
        const lines = desc
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l);
        const first = lines[0];
        if (first) {
            const cleanDesc = first.replace(/[\u{1F300}-\u{1F9FF}]|📝|^\d+[.、．]\s*|\|.*$/gu, '').trim();
            if (cleanDesc && cleanDesc.length < 20 && cleanDesc !== query.trim()) return cleanDesc;
            if (cleanDesc && cleanDesc !== query.trim()) return cleanDesc.substring(0, 15);
        }
    }
    return origMapQuery || query;
}

