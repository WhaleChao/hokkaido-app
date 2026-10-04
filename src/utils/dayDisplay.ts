import { type DayItinerary } from '../data/itinerary';
import { addDaysISO, formatMD, weekdayZh, isValidISODate } from './date';

/** 日期以「設定的出發日 + 第幾天」推算，改了出發日不用再改每一天的標籤。 */
export function dayDisplay(day: DayItinerary, index: number, startDate?: string): { date: string; weekday: string; iso: string | null } {
    const iso = startDate && isValidISODate(startDate) ? addDaysISO(startDate, index) : null;
    if (iso) return { date: formatMD(iso), weekday: weekdayZh(iso), iso };
    return { date: day.date, weekday: '', iso: null };
}

