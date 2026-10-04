import { type Accommodation } from '../data/config';

/** 附近搜尋要用哪一間：今天住的那間，沒有就用第一間。 */
export function pickAccommodation(accs: Accommodation[], today: string): Accommodation | null {
    if (accs.length === 0) return null;
    const hit = accs.find((a) => a.checkIn && a.checkOut && today >= a.checkIn && today <= a.checkOut);
    return hit ?? accs[0];
}

