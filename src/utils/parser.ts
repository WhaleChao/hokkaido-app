import { type DayItinerary, type Attraction, type SubOption, type Category } from '../data/itinerary';
import { dayIdFor } from './tripData';

const CATEGORIES: Category[] = ['食物', '活動', '購物', '景點', '酒店', '交通'];

function newId(): string {
    return `attr-${crypto.randomUUID()}`;
}

export interface ParseResult {
    ok: boolean;
    /** 解析後的每一天（只有「表格裡有出現的天」被取代，其餘原封不動） */
    days: DayItinerary[];
    /** 表格裡出現的天數 */
    touchedDays: number;
    touchedIndexes: number[];
    parsedItems: number;
    /** 表格天數比行程多時，自動補上的天數 */
    addedDays: number;
    warnings: string[];
    error?: string;
}

// Detect and split numbered items like "1. xxx 2. yyy" or "1.xxx\n2.yyy"
// Works regardless of whether items are separated by newlines or spaces
function splitNumberedOptions(
    baseName: string,
    descStr: string,
    noteStr: string,
    category: Attraction['category'],
    timeStr: string,
    variant: string | undefined
): Attraction | null {
    // Find all numbered items: "1. xxx", "2. yyy", "3. zzz" etc.
    // This regex captures the number and everything until the next number or end of string
    const fullText = descStr.replace(/\r/g, '');
    const itemPattern = /(?:^|[\n\s])(\d+)[.、．]\s*/g;

    // Find all match positions: matchPos = where the full match starts, start = content after "N. "
    const positions: { num: number, matchPos: number, start: number }[] = [];
    let match;
    while ((match = itemPattern.exec(fullText)) !== null) {
        positions.push({
            num: parseInt(match[1]),
            matchPos: match.index,
            start: match.index + match[0].length
        });
    }

    if (positions.length < 2) return null;

    // Extract each item's text: from start to next item's matchPos
    const items: { num: number, text: string }[] = [];
    for (let i = 0; i < positions.length; i++) {
        const textEnd = i + 1 < positions.length ? positions[i + 1].matchPos : fullText.length;
        items.push({ num: positions[i].num, text: fullText.substring(positions[i].start, textEnd).trim() });
    }

    // Parse numbered notes to pair with items
    const noteText = noteStr.replace(/\r/g, '');
    const noteItems: Map<number, string> = new Map();
    const notePositions: { num: number, matchPos: number, start: number }[] = [];
    const notePattern = /(?:^|[\n\s])(\d+)[.、．]\s*/g;
    while ((match = notePattern.exec(noteText)) !== null) {
        notePositions.push({ num: parseInt(match[1]), matchPos: match.index, start: match.index + match[0].length });
    }
    for (let i = 0; i < notePositions.length; i++) {
        const textEnd = i + 1 < notePositions.length ? notePositions[i + 1].matchPos : noteText.length;
        noteItems.set(notePositions[i].num, noteText.substring(notePositions[i].start, textEnd).trim());
    }

    const variantLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const subOptions: SubOption[] = [];

    for (let idx = 0; idx < items.length; idx++) {
        const { num, text: itemName } = items[idx];
        const itemNote = noteItems.get(num) || '';
        const desc = itemNote ? `${itemName}\n📝 ${itemNote}` : itemName;
        const cleanName = itemName.replace(/（.*?）|\(.*?\)/g, '').replace(/\n/g, ' ').trim();

        subOptions.push({
            label: `${variantLabels[idx]} 方案`,
            name: itemName,
            description: desc,
            mapQuery: cleanName
        });
    }

    const displayName = timeStr ? `[${timeStr}] ${baseName}` : baseName;
    const sharedDesc = fullText.substring(0, positions[0].matchPos).trim();

    return {
        id: newId(),
        name: displayName,
        category,
        description: sharedDesc,
        tags: [],
        mapQuery: baseName,
        planVariant: variant || undefined, // preserve parent variant like 男生 if any
        subOptions
    };
}

function parseTSV(tsv: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < tsv.length; i++) {
        const char = tsv[i];

        if (inQuotes) {
            if (char === '"') {
                if (i + 1 < tsv.length && tsv[i + 1] === '"') {
                    currentCell += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                currentCell += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === '\t') {
                currentRow.push(currentCell);
                currentCell = '';
            } else if (char === '\n') {
                currentRow.push(currentCell);
                rows.push(currentRow);
                currentRow = [];
                currentCell = '';
            } else if (char === '\r') {
                // Ignore \r
            } else {
                currentCell += char;
            }
        }
    }

    if (currentCell !== '' || currentRow.length > 0) {
        currentRow.push(currentCell);
        rows.push(currentRow);
    }

    return rows;
}

function guessCategory(name: string, desc: string): '食物' | '活動' | '購物' | '景點' | '酒店' | '交通' {
    if (/餐|麵|肉|飯|鍋|壽司|咖啡|點心|早餐|Cafe|cafe/.test(name) || /餐|麵|肉|飯/.test(desc)) return '食物';
    if (/車站|機場|地鐵|捷運|→|火車|公車|巴士|航空|鐵|線|站/.test(name) || /交通/.test(desc)) return '交通';
    if (/住宿|民宿|飯店|酒店|旅館/.test(name)) return '酒店';
    if (/百貨|商店|市場|購買|免稅|店|商場/.test(name)) return '購物';
    return '景點';
}

function generateMapQuery(name: string, desc: string): string {
    let query = name.replace(/\[.*?\]\s*/, '').split('→').pop() || name;

    // 如果標題是通用的（例如：午餐、晚餐），試著從備註中提取真正的店名
    const genericNames = /^(早餐|午餐|晚餐|宵夜|點心|下午茶|休息|吃飯|用餐)$/;
    if (genericNames.test(query.trim()) && desc) {
        // 取出描述的第一行，移除常見的 Emoji 和空白
        const firstLine = desc.split('\n').map(l => l.trim()).filter(l => l)[0];
        if (firstLine) {
            const cleanDesc = firstLine.replace(/[\u{1F300}-\u{1F9FF}]|📝/gu, '').trim();
            if (cleanDesc && cleanDesc.length < 20) { // 避免把整段長文塞進去
                query = `${query} ${cleanDesc}`;
            } else if (cleanDesc) {
                // 如果很長，只切一小段
                query = `${query} ${cleanDesc.substring(0, 15)}`;
            }
        }
    }
    return query.trim();
}

function emptyResult(days: DayItinerary[], error: string): ParseResult {
    return { ok: false, days, touchedDays: 0, touchedIndexes: [], parsedItems: 0, addedDays: 0, warnings: [], error };
}

interface Block {
    timeCol: number;
    nameCol: number;
    descCol: number;
    noteCol: number;
}

function newDay(index: number, label: string): DayItinerary {
    return {
        id: dayIdFor(index),
        dayLabel: `Day ${index + 1}`,
        date: label || `Day ${index + 1}`,
        locationLabel: '',
        attractions: [],
        advice: { clothing: '', snowCondition: '' },
    };
}

/**
 * 解析從試算表貼上的內容。
 * - 一個景點都解析不出來 → ok=false，呼叫端不可改動任何資料。
 * - 只取代「表格裡有景點的天」，其他天保持原樣。
 */
export function parseSpreadsheetData(tsvData: string, existingDays: DayItinerary[]): ParseResult {
    if (!tsvData || !tsvData.trim()) return emptyResult(existingDays, '請先貼上行程表格內容');

    const rows = parseTSV(tsvData);
    const days: DayItinerary[] = existingDays.map((d) => ({ ...d, attractions: [...d.attractions] }));
    const warnings: string[] = [];
    const touched = new Set<number>();
    const fresh = new Map<number, Attraction[]>();
    let parsedItems = 0;
    let addedDays = 0;

    const push = (dayIndex: number, a: Attraction) => {
        const list = fresh.get(dayIndex) ?? [];
        list.push(a);
        fresh.set(dayIndex, list);
        touched.add(dayIndex);
        parsedItems++;
    };

    // 橫向版型：多組「時間 / 活動地點 / 簡介 / 備註」並排，每組是一天
    const dayBlocks: Block[] = [];
    let headerRowIndex = -1;
    for (let r = 0; r < Math.min(rows.length, 10); r++) {
        const cols = rows[r];
        for (let c = 0; c < cols.length; c++) {
            const val = cols[c].trim();
            // 直式表頭「天數 | 景點名稱 | 分類 | 備註」也有「景點名稱」，不能被當成橫式
            if (val === '景點名稱' && c === 1 && /^(天數|天|Day|日期)$/i.test(cols[0].trim())) continue;
            if (val === '活動地點' || val === '地點' || val === '行程' || val === '景點名稱') {
                const timeCol = c > 0 && cols[c - 1].includes('時間') ? c - 1 : -1;
                let descCol = -1;
                let noteCol = -1;
                for (let scan = c + 1; scan < cols.length && scan <= c + 5; scan++) {
                    const scanVal = cols[scan].trim();
                    if (scanVal.includes('簡介') || scanVal.includes('內容')) descCol = scan;
                    if (scanVal.includes('交通') && descCol === -1) descCol = scan;
                    if (scanVal.includes('備註') || scanVal.includes('出口')) noteCol = scan;
                }
                dayBlocks.push({ timeCol, nameCol: c, descCol, noteCol });
            }
        }
        if (dayBlocks.length > 0) {
            headerRowIndex = r;
            break;
        }
    }

    if (dayBlocks.length > 0) {
        const dateRow = rows[0] ?? [];
        while (days.length < dayBlocks.length) {
            const b = dayBlocks[days.length];
            let dateLabel = '';
            for (let c = Math.max(0, b.timeCol); c <= b.nameCol; c++) {
                if (c < dateRow.length && dateRow[c].trim()) {
                    dateLabel = dateRow[c].trim();
                    break;
                }
            }
            days.push(newDay(days.length, dateLabel));
            addedDays++;
        }

        for (let i = 0; i < dayBlocks.length; i++) {
            const b = dayBlocks[i];
            let currentVariant = '';

            for (let r = headerRowIndex + 1; r < rows.length; r++) {
                const cols = rows[r];
                const timeStr = b.timeCol !== -1 && b.timeCol < cols.length ? cols[b.timeCol].trim() : '';
                const nameStr = b.nameCol < cols.length ? cols[b.nameCol].trim() : '';
                const descStr = b.descCol !== -1 && b.descCol < cols.length ? cols[b.descCol].trim() : '';
                const noteStr = b.noteCol !== -1 && b.noteCol < cols.length ? cols[b.noteCol].trim() : '';

                // 方案分組（例如時間欄寫「男生行程」而地點欄空白）
                if (timeStr && !nameStr && !timeStr.includes(':') && !/\d/.test(timeStr)) {
                    if (timeStr !== '時間' && timeStr !== 'Date' && timeStr !== 'Day') currentVariant = timeStr;
                    continue;
                }
                if (!nameStr) continue;
                if (nameStr === '活動地點' || nameStr === '地點' || nameStr === '時間') continue;

                let mergedDesc = descStr;
                for (let scan = b.nameCol + 1; scan <= Math.max(b.descCol, b.noteCol); scan++) {
                    if (scan !== b.descCol && scan !== b.noteCol && scan < cols.length) {
                        const val = cols[scan].trim();
                        if (val && !mergedDesc.includes(val)) mergedDesc += (mergedDesc ? ' | ' : '') + val;
                    }
                }
                if (noteStr) mergedDesc += (mergedDesc ? '\n📝 ' : '📝 ') + noteStr;
                mergedDesc = mergedDesc
                    .replace(/(?:^|\n)\s*\/\s*(?:$|\n)/g, '\n')
                    .replace(/^\s*\/\s*/gm, '')
                    .replace(/\s*\/\s*$/gm, '')
                    .trim();

                const textForSplit = descStr.includes('1.') || descStr.includes('1、') ? descStr : mergedDesc;
                const split = splitNumberedOptions(nameStr, textForSplit, noteStr, guessCategory(nameStr, mergedDesc), timeStr, currentVariant || undefined);
                if (split) {
                    push(i, split);
                } else {
                    push(i, {
                        id: newId(),
                        name: timeStr ? `[${timeStr}] ${nameStr}` : nameStr,
                        category: guessCategory(nameStr, mergedDesc),
                        description: mergedDesc,
                        tags: [],
                        mapQuery: generateMapQuery(nameStr, mergedDesc).trim(),
                        planVariant: currentVariant || undefined,
                    });
                }
            }
        }
    } else {
        // 直式版型：天數 | 景點名稱 | 分類 | 備註
        let skipped = 0;
        rows.forEach((columns) => {
            if (columns.length < 2) return;
            const dayStr = columns[0].trim();
            const name = columns[1].trim();
            const catCol = columns.length > 2 ? columns[2].trim() : '';
            const memo = columns.length > 3 ? columns[3].trim() : '';
            if (!name || ['名稱', 'Name', '景點', '景點名稱'].includes(name)) return;
            const dayMatch = dayStr.match(/\d+/);
            if (!dayMatch) {
                skipped++;
                return;
            }
            const dayIndex = parseInt(dayMatch[0], 10) - 1;
            if (dayIndex < 0 || dayIndex >= days.length) {
                skipped++;
                return;
            }
            push(dayIndex, {
                id: newId(),
                name,
                category: CATEGORIES.includes(catCol as Category) ? (catCol as Category) : guessCategory(name, memo),
                description: memo,
                tags: [],
                mapQuery: generateMapQuery(name, memo),
            });
        });
        if (skipped > 0) warnings.push(`有 ${skipped} 列因為天數看不懂或超出行程天數，已略過`);
    }

    if (parsedItems === 0) {
        return emptyResult(
            existingDays,
            '沒有解析出任何景點，所以沒有改動你的行程。請確認表頭有「活動地點」（橫式），或每列為「天數、景點名稱、分類、備註」（直式）。',
        );
    }

    for (const idx of touched) {
        days[idx] = { ...days[idx], attractions: fresh.get(idx) ?? [] };
    }
    if (dayBlocks.length > 0) {
        const empty = dayBlocks.map((_, i) => i).filter((i) => !touched.has(i));
        if (empty.length > 0) warnings.push(`第 ${empty.map((i) => i + 1).join('、')} 天在表格裡沒有景點，這幾天維持原樣`);
    }

    return { ok: true, days, touchedDays: touched.size, touchedIndexes: [...touched].sort((a, b) => a - b), parsedItems, addedDays, warnings };
}
