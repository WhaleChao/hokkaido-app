import { type DayItinerary, type Attraction } from '../data/itinerary';

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
    const subOptions: import('../data/itinerary').SubOption[] = [];

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
        id: `attr-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
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

export function parseSpreadsheetData(tsvData: string, existingDays: DayItinerary[]): DayItinerary[] {
    if (!tsvData || !tsvData.trim()) return existingDays;

    const rows = parseTSV(tsvData);
    // Clear existing attractions — fresh import replaces old data
    const newDays = [...existingDays.map(d => ({ ...d, attractions: [] as Attraction[] }))];

    // Detect horizontal layout (Multiple columns of "活動地點", "地點", "Name")
    let dayBlocks: { timeCol: number, nameCol: number, descCol: number, noteCol: number }[] = [];
    let headerRowIndex = -1;

    for (let r = 0; r < Math.min(rows.length, 10); r++) {
        const cols = rows[r];
        for (let c = 0; c < cols.length; c++) {
            const val = cols[c].trim();
            if (val === '活動地點' || val === '地點' || val === '行程' || val === '景點名稱') {
                let timeCol = c > 0 && cols[c - 1].includes('時間') ? c - 1 : -1;

                let descCol = -1;
                let noteCol = -1;
                for (let scan = c + 1; scan < cols.length && scan <= c + 5; scan++) {
                    const scanVal = cols[scan].trim();
                    if (scanVal.includes('簡介') || scanVal.includes('內容')) descCol = scan;
                    if (scanVal.includes('交通') && descCol === -1) descCol = scan; // only fallback if no 簡介 found
                    if (scanVal.includes('備註') || scanVal.includes('出口')) {
                        noteCol = scan; // keep overriding to get the furthest column like '備註'
                    }
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
        // Auto-create missing days from spreadsheet date headers (first row)
        const dateRow = rows.length > 0 ? rows[0] : [];
        while (newDays.length < dayBlocks.length) {
            const blockIdx = newDays.length;
            const b = dayBlocks[blockIdx];
            // Try to extract date label from first row at the block's column range
            let dateLabel = '';
            for (let c = Math.max(0, b.timeCol); c <= b.nameCol; c++) {
                if (c >= 0 && c < dateRow.length && dateRow[c].trim()) {
                    dateLabel = dateRow[c].trim();
                    break;
                }
            }
            newDays.push({
                id: `day${newDays.length + 1}`,
                dayLabel: `Day ${newDays.length + 1}`,
                date: dateLabel || `Day ${newDays.length + 1}`,
                locationLabel: '',
                attractions: [],
                advice: { clothing: '', snowCondition: '' }
            });
        }

        // Horizontal parsing mode
        for (let i = 0; i < dayBlocks.length; i++) {
            const b = dayBlocks[i];
            let currentVariant = '';

            for (let r = headerRowIndex + 1; r < rows.length; r++) {
                const cols = rows[r];
                let timeStr = b.timeCol !== -1 && b.timeCol < cols.length ? cols[b.timeCol].trim() : '';
                let nameStr = b.nameCol < cols.length ? cols[b.nameCol].trim() : '';
                let descStr = b.descCol !== -1 && b.descCol < cols.length ? cols[b.descCol].trim() : '';
                let noteStr = b.noteCol !== -1 && b.noteCol < cols.length ? cols[b.noteCol].trim() : '';

                // Variant detection (e.g. "男生行程" in time or location column without a real time)
                if (timeStr && !nameStr && !timeStr.includes(':') && !/\d/.test(timeStr)) {
                    if (timeStr !== '時間' && timeStr !== 'Date' && timeStr !== 'Day') {
                        currentVariant = timeStr;
                    }
                    continue;
                }

                if (!nameStr) continue;
                if (nameStr === '活動地點' || nameStr === '地點' || nameStr === '時間') continue;

                let mergedDesc = descStr;
                // Add all columns between name and note as description if we missed them
                for (let scan = b.nameCol + 1; scan <= Math.max(b.descCol, b.noteCol); scan++) {
                    if (scan !== b.descCol && scan !== b.noteCol && scan < cols.length) {
                        const val = cols[scan].trim();
                        if (val && !mergedDesc.includes(val)) mergedDesc += (mergedDesc ? ' | ' : '') + val;
                    }
                }

                if (noteStr) mergedDesc += (mergedDesc ? '\n📝 ' : '📝 ') + noteStr;

                // Clean orphan slashes (/ with no text on one side)
                mergedDesc = mergedDesc.replace(/(?:^|\n)\s*\/\s*(?:$|\n)/g, '\n').replace(/^\s*\/\s*/gm, '').replace(/\s*\/\s*$/gm, '').trim();

                const mapQueryStr = generateMapQuery(nameStr, mergedDesc);
                let finalName = timeStr ? `[${timeStr}] ${nameStr}` : nameStr;

                // Try splitting numbered options (e.g. "1. 咖浬\n2. 松屋")
                // Use descStr for numbered detection, but also check mergedDesc in case columns shifted
                const textForSplit = descStr.includes('1.') || descStr.includes('1、') ? descStr : mergedDesc;
                const splitResult = splitNumberedOptions(
                    nameStr, textForSplit, noteStr,
                    guessCategory(nameStr, mergedDesc),
                    timeStr,
                    currentVariant || undefined
                );

                if (splitResult) {
                    // Numbered options detected — add as a single mapped attraction with subOptions
                    newDays[i].attractions.push(splitResult);
                } else {
                    // Single attraction — normal behavior
                    const newAttraction: Attraction = {
                        id: `attr-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                        name: finalName,
                        category: guessCategory(nameStr, mergedDesc),
                        description: mergedDesc,
                        tags: [],
                        mapQuery: mapQueryStr.trim(),
                        planVariant: currentVariant || undefined
                    };
                    newDays[i].attractions.push(newAttraction);
                }
            }
        }
        return newDays;
    }

    // Fallback: Vertical parsing mode (Simple 4-column)
    rows.forEach(columns => {
        if (columns.length < 2) return;

        let dayStr = columns[0].trim();
        let name = columns[1].trim();
        let memo = columns.length > 3 ? columns[3].trim() : '';

        const dayMatch = dayStr.match(/\d+/);
        if (!dayMatch) return;

        const dayNum = parseInt(dayMatch[0], 10);
        const dayIndex = dayNum - 1;

        if (dayIndex < 0 || dayIndex >= newDays.length) return;
        if (name === '名稱' || name === 'Name' || name === '景點' || name === '景點名稱') return;

        const newAttraction: Attraction = {
            id: `attr-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            name: name,
            category: guessCategory(name, memo),
            description: memo,
            tags: [],
            mapQuery: generateMapQuery(name, memo)
        };

        newDays[dayIndex].attractions.push(newAttraction);
    });

    return newDays;
}
