// 規則定義：每條規則對應一個官方來源。
// verbatim 規則的內容完全來自官方頁面（自動更新）；curated 規則的白話摘要（summary）是人工整理的，
// 只對應 reviewed_hash 那一版官方原文，官方內容一變就不會自動改寫，而是開 Issue 請人確認後再更新。
export const DEFINITIONS = [
    {
        id: 'tw-customs-prohibited',
        source_id: 'tw-customs-prohibited',
        title: '回台灣：禁止攜帶的物品',
        lead: '以下是海關公告的禁止攜帶物品（官方原文）。',
        always: true,
        keywords: [],
    },
    {
        id: 'tw-aphia-traveler',
        source_id: 'tw-aphia-traveler',
        title: '回台灣：動植物及其產品',
        lead: '防檢署公告旅客不得攜帶的動植物項目（官方原文）。',
        always: true,
        keywords: [],
    },
    {
        id: 'tw-customs-food',
        source_id: 'tw-customs-food',
        title: '回台灣：農畜水產品與食品的限量與檢驗',
        lead: '海關公告的檢疫、限量與食品檢驗規定（官方原文）。',
        always: true,
        keywords: [],
    },
    {
        id: 'tw-customs-medicine',
        source_id: 'tw-customs-medicine',
        title: '回台灣：自用藥物的攜帶限量',
        lead: '海關公告的自用藥物限量規定（官方原文）。',
        always: true,
        keywords: [],
    },
    {
        id: 'jp-customs-passenger',
        source_id: 'jp-customs-passenger',
        title: '日本入境：禁止與限制的物品',
        lead: '依日本海關公告整理（官方原文為英文，可展開查看）。',
        always: false,
        keywords: ['日本', '東京', '大阪', '北海道', '札幌', '京都', '沖繩', '福岡', '名古屋', 'japan', 'tokyo', 'osaka', 'hokkaido', 'sapporo', 'kyoto', 'okinawa', 'fukuoka', 'nagoya'],
        summary: [
            '毒品（含興奮劑、精神藥物）、槍砲彈藥、爆裂物、偽造的貨幣與信用卡、猥褻物品與兒童色情、侵害智慧財產權的物品，禁止帶進日本。',
            '動物與植物（含其產品）必須先接受動植物檢疫，不能直接通關。',
            '藥品與化妝品有數量限制；官方舉例：藥品以兩個月用量為限、化妝品以 24 次的量為限。詳情請看日本厚生勞動省網站。',
            '沒有許可不能攜帶獵槍、氣槍、刀劍入境。',
        ],
    },
    {
        id: 'jp-maff-animal',
        source_id: 'jp-maff-animal',
        title: '日本入境：肉類與肉製品',
        lead: '依日本動物檢疫所的旅客 Q&A 整理（官方原文為英文，可展開查看）。',
        always: false,
        keywords: ['日本', '東京', '大阪', '北海道', '札幌', '京都', '沖繩', '福岡', '名古屋', 'japan', 'tokyo', 'osaka', 'hokkaido', 'sapporo', 'kyoto', 'okinawa', 'fukuoka', 'nagoya'],
        summary: [
            '生肉、火腿、香腸、臘肉、肉乾等肉製品，以及只含一點肉的食品（肉包、餃子、火腿三明治、機上餐的剩食），都屬於動物檢疫的對象，請不要帶進日本。',
            '未申報而被認定為惡意，可能遭警方逮捕，罰款最高 300 萬日圓或最長三年有期徒刑。',
        ],
    },
    {
        id: 'sg-customs-chewing-gum',
        source_id: 'sg-customs-chewing-gum',
        title: '新加坡入境：口香糖',
        lead: '依新加坡海關公告整理（官方原文為英文，可展開查看）。',
        always: false,
        keywords: ['新加坡', 'singapore'],
        summary: ['新加坡海關公告：口香糖（HS 1704.10）禁止進口。官方列出的例外只針對貿易商在自由貿易區內再出口，不是給一般旅客的。請勿攜帶，出發前可向新加坡海關確認。'],
    },
];
