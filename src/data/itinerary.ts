export type Category = '食物' | '活動' | '購物' | '景點' | '酒店' | '交通';
export type TimeSlot = '早餐' | '午餐' | '晚餐' | '無' | ''; // Added time slots specifically for meals
export type Tag = '必吃' | '必買' | '必拍' | '正選' | '備選';

export interface TransitDetails {
    mode?: string;
    line?: string;
    platform?: string;
    exit?: string;
    cost?: string;
}

export interface Attraction {
    id: string;
    name: string;
    category: Category;
    timeSlot?: TimeSlot; // Optional time grouping (mostly for meals)
    startTime?: string; // Optional exact time marker (e.g. 10:30)
    planVariant?: string; // Dynamic plan branching (e.g. A, B, C, 雨天)
    isBackup?: boolean; // True if it's strictly a Fallback
    durationMinutes?: number; // Optional duration estimate for the itinerary schedule
    description: string;
    tags: Tag[];
    mapQuery: string;
    parkingInfo?: string;
    gasInfo?: string;
    photoTip?: string;
    hasPhotoUpload?: boolean;
    transitDetails?: TransitDetails; // Exclusive to category === '交通'
}

export interface DailyAdvice {
    clothing: string;
    snowCondition: string;
}

export interface DayItinerary {
    id: string;
    dayLabel: string;
    date: string;
    locationLabel: string;
    attractions: Attraction[];
    advice: DailyAdvice;
}

export const itineraryData: DayItinerary[] = [
    {
        id: 'day1',
        dayLabel: 'Day 1',
        date: '2/10',
        locationLabel: '新千歲 ➔ 札幌',
        advice: {
            clothing: '洋蔥式穿法（室內暖氣強），防風外套必備。',
            snowCondition: '市區可能有些積雪，請穿防滑靴。',
        },
        attractions: [
            {
                id: '1-1',
                name: '新千歲機場',
                category: '交通',
                description: '抵達北海道。機場內有許多美食與伴手禮可先逛逛。',
                tags: [],
                mapQuery: '新千歲機場',
            },
            {
                id: '1-2',
                name: '成吉思汗烤肉 だるま',
                category: '食物',
                description: '札幌著名的成吉思汗烤肉，晚上來吃最棒！',
                tags: ['必吃'],
                mapQuery: '成吉思汗 だるま',
                hasPhotoUpload: true,
            }
        ],
    },
    {
        id: 'day2',
        dayLabel: 'Day 2',
        date: '2/11',
        locationLabel: '札幌 ➔ 小樽 ➔ 札幌',
        advice: {
            clothing: '海風大，建議佩戴毛帽、圍巾與手套。',
            snowCondition: '小樽運河沿岸可能結冰較滑，步行請留意。',
        },
        attractions: [
            {
                id: '2-1',
                name: '小樽運河',
                category: '景點',
                description: '冬季限定的白雪覆蓋運河，極具浪漫氛圍。',
                tags: ['必拍'],
                mapQuery: '小樽運河',
                parkingInfo: '運河周邊有付費停車場 500円/小時',
                hasPhotoUpload: true,
            },
            {
                id: '2-2',
                name: '北一硝子 三號館',
                category: '購物',
                description: '歷史悠久的玻璃工藝品店，星空咖啡館氣氛絕佳。',
                tags: ['必拍', '必買'],
                mapQuery: '北一硝子三号館',
                photoTip: '必拍煤油燈！建議使用較低的曝光補償來捕捉微光氣氛。',
                hasPhotoUpload: true,
            },
            {
                id: '2-3',
                name: '小樽壽司屋通',
                category: '食物',
                description: '新鮮的海鮮丼與握壽司，午餐推薦。',
                tags: ['必吃'],
                mapQuery: '小樽寿司屋通り',
            }
        ],
    },
    {
        id: 'day3',
        dayLabel: 'Day 3',
        date: '2/12',
        locationLabel: '札幌 ➔ 美瑛/富良野',
        advice: {
            clothing: '郊區溫度極低，請備妥極地禦寒裝備與暖暖包。',
            snowCondition: '道路易積雪，自駕請注意打滑，與前車保持距離。',
        },
        attractions: [
            {
                id: '3-1',
                name: '白金青池 (冬季點燈)',
                category: '景點',
                description: '冬季晚上的青池點燈非常夢幻。',
                tags: ['必拍'],
                mapQuery: '白金青池',
                parkingInfo: '冬季免費停車場開放',
                gasInfo: '美瑛市區加油站營業至18:00，請先加滿油再前往。',
                hasPhotoUpload: true,
            }
        ]
    }
];
