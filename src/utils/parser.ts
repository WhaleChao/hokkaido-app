import { type DayItinerary, type Attraction } from '../data/itinerary';

export function parseSpreadsheetData(tsvData: string, existingDays: DayItinerary[]): DayItinerary[] {
    if (!tsvData || !tsvData.trim()) return existingDays;

    const rows = tsvData.split('\n').filter(r => r.trim());
    const newDays = [...existingDays];

    // Expected format: Day Number | Location/Name | Category | Remarks
    // We will loosely match these.
    rows.forEach(row => {
        const columns = row.split('\t').map(c => c.trim());

        // Ensure we have at least Day & Name
        if (columns.length < 2) return;

        let dayStr = columns[0];
        let name = columns[1];
        let category = columns.length > 2 ? columns[2] : '景點';
        let memo = columns.length > 3 ? columns[3] : '';

        // Try extracting a clean Day number from strings like "Day 1" or "第1天" or "1"
        const dayMatch = dayStr.match(/\d+/);
        if (!dayMatch) return; // Can't parse day, skip row

        const dayNum = parseInt(dayMatch[0], 10);
        const dayIndex = dayNum - 1; // "Day 1" -> index 0

        // If the day doesn't exist in our current config, maybe out of bounds
        if (dayIndex < 0 || dayIndex >= newDays.length) return;

        // Skip rows that look like Header rows
        if (name === '名稱' || name === 'Name' || name === '景點') return;

        const newAttraction: Attraction = {
            id: `attr-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            name: name,
            category: (category === '景點' || category === '食物' || category === '交通' || category === '酒店' || category === '購物' || category === '活動')
                ? (category as '食物' | '活動' | '購物' | '景點' | '酒店' | '交通')
                : '景點',
            description: memo,
            tags: [],
            mapQuery: name
        };

        newDays[dayIndex].attractions.push(newAttraction);
    });

    return newDays;
}
