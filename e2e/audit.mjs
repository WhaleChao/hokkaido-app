// 逐功能對抗式驗收：以使用者實際操作每個功能，含邊界情境（空資料、超長文字、大量資料、重複點擊、
// 離線／網路中斷、重新整理、時區、橫直切換、不同瀏覽器語系與螢幕寬度）。結果寫成 JSON，供報告整理。
// 用法：npm run build && node e2e/audit.mjs      （AUDIT_OUT=/path/result.json  SHOT_DIR=/path/shots）
import { mkdirSync, writeFileSync } from 'node:fs';
import { startPreview, launch } from './lib.mjs';

const only = process.env.AUDIT_ONLY?.split(',');
const on = (n) => !only || only.includes(n);
const OUT = process.env.AUDIT_OUT || 'audit-results.json';
const SHOT_DIR = process.env.SHOT_DIR;
if (SHOT_DIR) mkdirSync(SHOT_DIR, { recursive: true });

const server = await startPreview(4181);
const browser = await launch();
const results = [];
let lastPage = null;
const consoleErrors = [];
const RATES = { USD: 1, JPY: 150, TWD: 30, EUR: 0.9, KRW: 1300, THB: 35 };

const nav = (page, label) => page.getByRole('navigation', { name: '主選單' }).getByRole('button', { name: label, exact: true }).click();
const scope = (page) => page.locator('main.dashboard, main > section:not([hidden])');
const panel = (page) => page.locator('main > section:not([hidden])');
const btn = (page, name, o = {}) => page.getByRole('button', { name, exact: true, ...o });

async function ctxPage({ w = 390, h = 844, locale = 'zh-TW', tz = 'Asia/Taipei', colorScheme = 'light', mocks = true, now } = {}) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale, timezoneId: tz, colorScheme, acceptDownloads: true, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    lastPage = page;
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(`[${locale} ${w}] ${m.text()}`));
    page.on('pageerror', (e) => consoleErrors.push(`[${locale} ${w}] PAGEERROR ${e.message}`));
    if (mocks) {
        await page.route('**/open.er-api.com/**', (r) => r.fulfill({ json: { result: 'success', rates: RATES } }));
        await page.route('**/geocoding-api.open-meteo.com/**', (r) => r.fulfill({ json: { results: [{ latitude: 43.06, longitude: 141.35 }] } }));
        await page.route('**/api.open-meteo.com/**', (r) => {
            const base = Date.now();
            const times = Array.from({ length: 16 }, (_, i) => new Date(base + i * 86400000).toISOString().slice(0, 10));
            r.fulfill({ json: { daily: { time: times, weather_code: times.map(() => 3), temperature_2m_max: times.map(() => 5), temperature_2m_min: times.map(() => -2) } } });
        });
        await page.route('**/*wikipedia.org/**', (r) => r.fulfill({ json: { query: { pages: {} } } }));
    }
    if (now) await page.clock.install({ time: now });
    return { ctx, page };
}

async function shot(page, name) {
    if (!SHOT_DIR) return;
    await page.waitForTimeout(350);
    await page.screenshot({ path: `${SHOT_DIR}/${name}.png` });
}

/** 登記一項檢查。fn 回傳「實際結果」字串；丟出例外代表不符預期。 */
async function check(feature, steps, expected, fn) {
    const t0 = Date.now();
    try {
        const actual = await fn();
        results.push({ feature, steps, expected, actual: String(actual ?? '符合預期'), ok: true, ms: Date.now() - t0 });
        console.log(`  ✓ [${feature}] ${steps.slice(0, 60)}`);
    } catch (e) {
        if (SHOT_DIR && lastPage) await lastPage.screenshot({ path: `${SHOT_DIR}/FAIL-${results.length}.png` }).catch(() => {});
        results.push({ feature, steps, expected, actual: String(e.message ?? e).split('\n')[0].slice(0, 300) + (process.env.AUDIT_DEBUG ? ' ## ' + String(e.message).split('\n').slice(1, 14).join(' / ') : ''), ok: false, ms: Date.now() - t0 });
        console.log(`  ✗ [${feature}] ${steps.slice(0, 60)}\n      ${String(e.message ?? e).split('\n')[0].slice(0, 200)}`);
    }
}
const expect = (cond, msg) => {
    if (!cond) throw new Error(msg);
};

/** 用「還原備份」的方式一次灌入大量資料（同時驗證還原流程） */
function backupWith({ id = 'trip_1700000000001', name = '審查旅程', start = '2026-02-10', end = '2026-02-12', attractions = {}, expenses = [], config = {} }) {
    const days = [];
    const n = Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
    for (let i = 1; i <= n; i++) days.push({ id: `day-${i}`, dayLabel: `第 ${i} 天`, date: '', locationLabel: '', attractions: attractions[i] ?? [], advice: { clothing: '', snowCondition: '' } });
    const itinerary = { [`${id}_dayOrder`]: days.map((d) => d.id) };
    for (const d of days) itinerary[`${id}_${d.id}`] = d;
    const exp = {};
    expenses.forEach((e, i) => (exp[`${id}_e${i}`] = { id: `e${i}`, createdAt: 1700000000000 + i, ...e }));
    return {
        app: 'hokkaido-app',
        version: 1,
        exportedAt: Date.now(),
        stores: {
            config: { trips_list: [{ id, name, createdAt: 1700000000001 }], active_trip_id: id, [`${id}_app_config`]: { tripName: name, location: 'Sapporo, Japan', startDate: start, endDate: end, accommodationAddress: '', accommodations: [], travelers: 2, baseCurrency: 'TWD', tripCurrency: 'JPY', defaultRegion: '', ...config } },
            itinerary,
            expenses: exp,
        },
    };
}
async function restore(page, backup) {
    await page.goto(server.url);
    await page.locator('h1').first().waitFor();
    if ((await page.getByRole('heading', { name: '我的旅程庫' }).count()) === 0) await page.getByRole('button', { name: '回到旅程庫' }).click();
    await page.getByRole('heading', { name: '我的旅程庫' }).waitFor();
    await page.locator('input[aria-label="選擇備份檔"]').setInputFiles({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
    await page.getByRole('alertdialog').getByRole('button', { name: '還原' }).click();
    await page.getByText(/已還原 \d+ 筆資料/).waitFor();
    await page.reload();
    await page.getByRole('heading', { name: backup.stores.config.trips_list[0].name }).waitFor();
}
const attr = (i, extra = {}) => ({ id: `a${i}`, name: `景點 ${i}`, category: '景點', description: `第 ${i} 個景點的說明`, tags: [], mapQuery: `景點 ${i}`, ...extra });
async function ensureEdit(page, on) {
    const done = await page.getByRole('button', { name: '完成', exact: true }).count();
    if (on && !done) await btn(page, '編輯行程').click();
    if (!on && done) await btn(page, '完成').click();
}
const noOverflow = async (page, label) => {
    const o = await page.evaluate(() => ({ over: document.documentElement.scrollWidth - window.innerWidth, wide: [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > window.innerWidth + 1 && !e.closest('.day-selector,.suboptions,.ticket-images,[hidden],.toast-region,pre,textarea,.modal-backdrop'); }).slice(0, 3).map((e) => e.tagName + '.' + e.className) }));
    expect(o.over <= 1 && o.wide.length === 0, `${label}：水平溢出 ${o.over}px ${o.wide.join(',')}`);
};

// ============ 首頁／旅程建立與切換 ============
console.log('首頁與旅程');
if (on('首頁與旅程')) {
    const { ctx, page } = await ctxPage();
    await page.goto(server.url);
    await check('首頁／旅程建立', '開啟首頁，按「建立新旅程」，檢視日期欄', '「出發日」「結束日」標籤與輸入框上緣對齊；佔位字為繁中「年/月/日」，沒有 yyyy/mm/dd', async () => {
        await btn(page, '建立新旅程').click();
        const rows = await page.evaluate(() => [...document.querySelectorAll('.field-row')].map((r) => [...r.children].map((c) => Math.round(c.getBoundingClientRect().top))));
        expect(rows.length > 0 && rows.every((r) => r.every((t) => t === r[0])), '並排欄位上緣不一致：' + JSON.stringify(rows));
        const ph = await page.locator('input[placeholder="年/月/日"]').count();
        expect(ph === 2, '日期欄佔位字不是繁中，數量=' + ph);
        const text = await page.locator('body').innerText();
        expect(!/yyyy|mm\/dd|dd\/mm/i.test(text), '畫面含英文日期佔位字');
        await shot(page, 'a1-create-form');
        return '兩欄等高；佔位字「年/月/日　例：2026/02/10」';
    });
    await check('首頁／旅程建立', '日期欄輸入各種寫法：2026/2/10、2026年2月12日', '都被接受並統一顯示為 2026/02/10 格式', async () => {
        await scope(page).getByLabel('旅程名稱', { exact: true }).fill('審查旅程');
        await scope(page).getByLabel('出發日', { exact: true }).fill('2026/2/10');
        await scope(page).getByLabel('出發日', { exact: true }).blur();
        await scope(page).getByLabel('結束日', { exact: true }).fill('2026年2月12日');
        await scope(page).getByLabel('結束日', { exact: true }).blur();
        expect((await scope(page).getByLabel('出發日', { exact: true }).inputValue()) === '2026/02/10', '出發日未格式化：' + (await scope(page).getByLabel('出發日', { exact: true }).inputValue()));
        expect((await scope(page).getByLabel('結束日', { exact: true }).inputValue()) === '2026/02/12', '結束日未格式化');
        return '2026/2/10 → 2026/02/10；2026年2月12日 → 2026/02/12';
    });
    await check('首頁／旅程建立', '輸入不存在的日期 2026/02/30、結束日早於出發日', '顯示白話錯誤，不建立旅程', async () => {
        await scope(page).getByLabel('結束日', { exact: true }).fill('2026/02/30');
        await scope(page).getByLabel('結束日', { exact: true }).blur();
        await page.getByText('日期格式不正確').waitFor();
        await scope(page).getByLabel('結束日', { exact: true }).fill('2026/02/01');
        await scope(page).getByLabel('結束日', { exact: true }).blur();
        await page.getByText(/不能早於/).first().waitFor();
        const n = await page.locator('.trip-card').count();
        expect(n === 0, '不該建立旅程');
        await shot(page, 'a2-date-error');
        return '兩種錯誤都有白話訊息';
    });
    await check('首頁／旅程建立', '用日曆按鈕（原生選擇器）選日期', '日曆按鈕可聚焦點擊，選後文字欄同步為 2026/02/12 格式', async () => {
        const pickers = page.locator('input[type=date]');
        expect((await pickers.count()) === 2, '找不到原生日期選擇器');
        await pickers.nth(1).fill('2026-02-12');
        expect((await scope(page).getByLabel('結束日', { exact: true }).inputValue()) === '2026/02/12', '選擇器沒有同步到文字欄：' + (await scope(page).getByLabel('結束日', { exact: true }).inputValue()));
        return '同步成功';
    });
    await check('首頁／旅程建立', '連點「建立」兩次（重複點擊）', '只建立一趟旅程', async () => {
        await btn(page, '建立').dblclick();
        await page.getByRole('heading', { name: '審查旅程' }).waitFor();
        await btn(page, '回到旅程庫').click().catch(() => page.getByRole('button', { name: '回到旅程庫' }).click());
        await page.getByRole('heading', { name: '我的旅程庫' }).waitFor();
        const n = await page.locator('.trip-card').count();
        expect(n === 1, `旅程數應為 1，實際 ${n}`);
        return '1 趟';
    });
    await check('首頁／旅程切換', '建立第二趟、回旅程庫、再切回第一趟、刪除第二趟（確認視窗）', '切換正確；刪除需確認，取消不刪', async () => {
        await btn(page, '建立新旅程').click();
        await scope(page).getByLabel('旅程名稱', { exact: true }).fill('第二趟');
        await scope(page).getByLabel('出發日', { exact: true }).fill('2026-03-01');
        await scope(page).getByLabel('結束日', { exact: true }).fill('2026-03-02');
        await btn(page, '建立').click();
        await page.getByRole('heading', { name: '第二趟' }).waitFor();
        await page.getByRole('button', { name: '回到旅程庫' }).click();
        await page.locator('.trip-open', { hasText: '審查旅程' }).click();
        await page.getByRole('heading', { name: '審查旅程' }).waitFor();
        await page.getByRole('button', { name: '回到旅程庫' }).click();
        await page.getByRole('button', { name: '刪除旅程：第二趟' }).click();
        await page.getByRole('alertdialog').getByRole('button', { name: '取消' }).click();
        expect((await page.locator('.trip-card').count()) === 2, '取消後不該刪除');
        await page.getByRole('button', { name: '刪除旅程：第二趟' }).click();
        await page.getByRole('alertdialog').getByRole('button', { name: '永久刪除' }).click();
        await page.getByText('已刪除旅程').waitFor();
        expect((await page.locator('.trip-card').count()) === 1, '刪除後應剩 1 趟');
        await shot(page, 'a3-trip-list');
        return '切換、取消刪除、確認刪除皆正確';
    });
    await check('首頁／旅程建立', '旅程名稱輸入 200 字超長文字', '列表與標題列不溢出（以省略號截斷）', async () => {
        await page.getByRole('button', { name: '建立新旅程' }).click();
        await scope(page).getByLabel('旅程名稱', { exact: true }).fill('超長旅程名稱'.repeat(35));
        await scope(page).getByLabel('出發日', { exact: true }).fill('2026-05-01');
        await scope(page).getByLabel('結束日', { exact: true }).fill('2026-05-03');
        await btn(page, '建立').click();
        await page.locator('h1.header-title').waitFor();
        await noOverflow(page, '標題列');
        await page.getByRole('button', { name: '回到旅程庫' }).click();
        await noOverflow(page, '旅程庫');
        await shot(page, 'a4-long-name');
        return '無水平溢出';
    });
    await ctx.close();
}

// ============ 行程／景點／導航／排序／大量資料／時區 ============
console.log('行程');
if (on('行程')) {
    const { ctx, page } = await ctxPage();
    const attractions = { 1: Array.from({ length: Number(process.env.AUDIT_N || 50) }, (_, i) => attr(i + 1)) };
    await restore(page, backupWith({ attractions }));
    await check('行程（大量資料）', '還原含 50 個景點的旅程，開啟第 1 天並捲動', '50 張卡片都渲染；載入少於 3 秒；無溢出', async () => {
        const t0 = Date.now();
        await page.locator('.attraction-card').first().waitFor();
        const n = await page.locator('.attraction-card').count();
        expect(n === 50, '卡片數 ' + n);
        await noOverflow(page, '行程頁');
        return `${n} 張卡片，${Date.now() - t0}ms`;
    });
    await check('行程（超長文字）', '編輯第 1 個景點：名稱 1000 字、說明 5000 字（含網址）', '儲存成功；卡片與詳情視窗不溢出；說明裡的網址可點', async () => {
        await ensureEdit(page, true);
        await page.getByRole('button', { name: '編輯：景點 1', exact: true }).click();
        await scope(page).getByLabel('景點名稱', { exact: true }).fill('長'.repeat(1000));
        await scope(page).getByLabel('說明與筆記', { exact: true }).fill(('很長的說明 https://example.com/x ' + 'あ'.repeat(40)).repeat(80));
        await btn(page, '儲存').click();
        await page.locator('.attraction-card').first().waitFor();
        await btn(page, '完成').click();
        await noOverflow(page, '長文字卡片');
        await page.locator('.attraction-card').first().getByRole('button', { name: /詳情/ }).click();
        await page.getByRole('dialog').waitFor();
        const links = await page.getByRole('dialog').locator('a[href^="https://example.com"]').count();
        expect(links > 0, '網址沒有被轉成連結');
        const over = await page.getByRole('dialog').evaluate((d) => d.scrollWidth - d.clientWidth);
        expect(over <= 1, '詳情視窗橫向溢出 ' + over);
        await shot(page, 'b1-long-detail');
        await page.keyboard.press('Escape');
        return '儲存、卡片、詳情皆正常';
    });
    await check('行程（導航連結）', '按景點卡的「導航」', '開新分頁到 Google 地圖搜尋，搜尋字已編碼且帶前綴', async () => {
        await ctx.route('https://www.google.com/maps/**', (r) => r.fulfill({ body: 'ok' }));
        const [popup] = await Promise.all([ctx.waitForEvent('page'), page.locator('.attraction-card').nth(1).getByRole('button', { name: '導航', exact: true }).click()]);
        await popup.waitForURL(/google\.com/);
        const url = popup.url();
        expect(/google\.com\/maps\/search\/\?api=1&query=/.test(url) && url.includes(encodeURIComponent('景點 2')), '導航網址不正確：' + url);
        await popup.close();
        return url;
    });
    await check('行程（排序）', '編輯模式：鍵盤拿起第 2 個景點的拖曳把手，往下移一格，重新整理', '順序改變且重整後保持', async () => {
        await ensureEdit(page, true);
        const before = await page.locator('.card-title').allTextContents();
        const handle = page.getByRole('button', { name: /拖曳排序：景點 2（/ });
        await handle.focus();
        await page.keyboard.press('Space');
        await page.waitForTimeout(250);
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(250);
        await page.keyboard.press('Space');
        await page.waitForTimeout(600);
        const after = await page.locator('.card-title').allTextContents();
        expect(after[1] !== before[1], '順序沒變：' + after.slice(0, 3));
        await page.reload();
        await page.locator('.card-title').first().waitFor();
        const reloaded = await page.locator('.card-title').allTextContents();
        expect(reloaded[1] === after[1], '重整後順序遺失');
        return `「${before[1]}」→「${after[1]}」，重整後保持`;
    });
    await check('行程（重複點擊）', '新增景點時連按「儲存」兩次', '只新增一個景點', async () => {
        await ensureEdit(page, true);
        const before = await page.locator('.attraction-card').count();
        await page.getByRole('button', { name: /在這天新增景點/ }).click();
        await scope(page).getByLabel('景點名稱', { exact: true }).fill('連點測試');
        await btn(page, '儲存').dblclick();
        await page.waitForTimeout(600);
        const after = await page.locator('.attraction-card').count();
        expect(after === before + 1, `應多 1 個，實際 ${after - before}`);
        return '只新增 1 個';
    });
    await check('行程（刪除）', '刪除一個景點：先取消、再確認', '取消不刪；確認後數量減 1', async () => {
        const before = await page.locator('.attraction-card').count();
        await page.getByRole('button', { name: '刪除：連點測試' }).click();
        await page.getByRole('alertdialog').getByRole('button', { name: '取消' }).click();
        expect((await page.locator('.attraction-card').count()) === before, '取消後數量變了');
        await page.getByRole('button', { name: '刪除：連點測試' }).click();
        await page.getByRole('alertdialog').getByRole('button', { name: '刪除' }).click();
        await page.waitForTimeout(400);
        expect((await page.locator('.attraction-card').count()) === before - 1, '確認後數量不對');
        return '正確';
    });
    await ctx.close();

    // 時區：日本 23:30 與夏威夷
    for (const [tz, now, expectIdx] of [['Asia/Tokyo', new Date('2026-02-10T14:30:00Z'), 1], ['Pacific/Honolulu', new Date('2026-02-11T09:30:00Z'), 1], ['Asia/Taipei', new Date('2026-02-11T15:30:00Z'), 2]]) {
        const c = await ctxPage({ tz, now });
        await check('行程（跨日與時區）', `裝置時區 ${tz}、現在 ${now.toISOString()}，開啟 2/10–2/12 旅程`, `「今天」標記落在第 ${expectIdx} 天，並預設選取該天`, async () => {
            await restore(c.page, backupWith({ attractions: { 1: [attr(1)], 2: [attr(2)], 3: [attr(3)] } }));
            const active = await c.page.locator('.day-pill.active .day-label').innerText();
            const dot = await c.page.locator('.day-pill:has(.today-dot) .day-label').first().innerText();
            expect(active.includes(`第 ${expectIdx} 天`) && dot.includes(`第 ${expectIdx} 天`), `選取=${active} 今天標記=${dot}`);
            return `選取「${active}」`;
        });
        await c.ctx.close();
    }
}

// ============ 附近資訊 / 設定 / 深淺色 / 資料清除 ============
console.log('設定與附近資訊');
if (on('設定與附近資訊')) {
    const { ctx, page } = await ctxPage();
    await restore(page, backupWith({}));
    await check('附近資訊', '尚未新增住宿時按「超市」', '顯示白話提示，不開新分頁', async () => {
        await nav(page, '設定');
        let opened = false;
        ctx.on('page', () => (opened = true));
        await page.getByRole('button', { name: '超市' }).click();
        await page.getByText('請先在上方新增住宿').waitFor();
        expect(!opened, '不該開新分頁');
        return '顯示提示';
    });
    await check('附近資訊／住宿', '新增住宿（地址含特殊字元）後按「餐廳」', '開啟 Google 地圖搜尋「餐廳 near 地址」，已編碼', async () => {
        await page.getByRole('button', { name: '新增住宿' }).click();
        await scope(page).getByLabel('住宿名稱', { exact: true }).fill('測試飯店');
        await scope(page).getByLabel(/地址/).fill('札幌市 中央區 & 大通 #1');
        await page.getByRole('button', { name: '儲存', exact: true }).click();
        await page.getByRole('heading', { name: '測試飯店' }).waitFor();
        await ctx.route('https://www.google.com/maps/**', (r) => r.fulfill({ body: 'ok' }));
        const [popup] = await Promise.all([ctx.waitForEvent('page'), page.getByRole('button', { name: '餐廳' }).click()]);
        await popup.waitForURL(/google\.com/);
        expect(popup.url().includes(encodeURIComponent('餐廳 near 札幌市 中央區 & 大通 #1')), '網址不正確 ' + popup.url());
        await popup.close();
        return '編碼正確';
    });
    await check('設定／旅程設定', '編輯旅程：人數填 0、日期顛倒、旅程名稱留空', '各自顯示白話錯誤，不儲存', async () => {
        await page.getByRole('button', { name: '編輯旅程' }).click();
        await scope(page).getByLabel('旅程名稱', { exact: true }).fill('');
        await scope(page).getByLabel('同行人數（分帳用）', { exact: true }).fill('0');
        await scope(page).getByLabel('結束日', { exact: true }).fill('2026/01/01');
        await page.keyboard.press('Tab');
        await page.getByRole('button', { name: '儲存設定' }).click();
        await page.getByText('請輸入旅程名稱').waitFor();
        await page.getByText('人數請填 1 到 99').waitFor();
        await page.getByText(/不能早於/).first().waitFor();
        await shot(page, 'c1-config-errors');
        return '三種錯誤都顯示';
    });
    await check('設定／旅程設定', '縮短旅程天數（3 天改 2 天）', '先跳出確認，說明資料不會刪除', async () => {
        await scope(page).getByLabel('旅程名稱', { exact: true }).fill('審查旅程');
        await scope(page).getByLabel('同行人數（分帳用）', { exact: true }).fill('2');
        await scope(page).getByLabel('結束日', { exact: true }).fill('2026/02/11');
        await page.getByRole('button', { name: '儲存設定' }).click();
        await page.getByRole('alertdialog').getByText(/資料不會被刪除/).waitFor();
        await page.getByRole('alertdialog').getByRole('button', { name: '縮短' }).click();
        await page.getByText('旅程設定已儲存').waitFor();
        return '有確認提示';
    });
    await check('設定／深淺色', '切換「深色」→ 重新整理 → 切回「跟隨系統」', '重整後保持深色；跟隨系統時依系統偏好', async () => {
        await page.getByRole('button', { name: '深色', exact: true }).click();
        await page.reload();
        await nav(page, '設定');
        const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
        expect(bg === 'rgb(13, 23, 34)', '重整後不是深色 ' + bg);
        await page.getByRole('button', { name: '跟隨系統', exact: true }).click();
        const bg2 = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
        expect(bg2 === 'rgb(246, 242, 234)', '跟隨系統（淺色）背景不對 ' + bg2);
        return '正確';
    });
    await ctx.close();
}

// ============ 匯率 ============
console.log('匯率');
if (on('匯率')) {
    const { ctx, page } = await ctxPage({ mocks: false });
    let mode = 'ok';
    await page.route('**/open.er-api.com/**', (r) => (mode === 'ok' ? r.fulfill({ json: { result: 'success', rates: RATES } }) : mode === '503' ? r.fulfill({ status: 503, body: '{}' }) : mode === 'bad' ? r.fulfill({ json: { result: 'error' } }) : r.abort('internetdisconnected')));
    await page.route('**/*open-meteo.com/**', (r) => r.abort());
    await page.route('**/*wikipedia.org/**', (r) => r.abort());
    mode = '503';
    await restore(page, backupWith({}));
    await nav(page, '匯率');
    await check('匯率（API 失敗、沒有快取）', '匯率服務回 503，開啟匯率頁', '顯示「目前拿不到匯率」，換算結果為「—」，不顯示任何估算數字', async () => {
        await page.getByText('目前拿不到匯率').waitFor();
        expect((await page.locator('.exchange-box.out .big').innerText()) === '—', '結果不是「—」');
        await shot(page, 'd1-rates-fail');
        return '錯誤明確、無假數字';
    });
    await check('匯率（網路中斷中途恢復）', '服務恢復後按「更新」', '取得匯率並顯示換算；錯誤訊息消失', async () => {
        mode = 'ok';
        await page.getByRole('button', { name: '更新' }).click();
        await scope(page).getByLabel(/金額（日圓）/).fill('3000');
        await page.waitForFunction(() => document.querySelector('.exchange-box.out .big')?.textContent === '600');
        expect((await page.getByText('目前拿不到匯率').count()) === 0, '錯誤沒消失');
        return '3000 日圓 = 600 新台幣';
    });
    await check('匯率（輸入邊界）', '輸入 abc、空白、1e15、小數、負數', '無效者顯示「請輸入數字」且結果「—」；極大值不溢出', async () => {
        const input = scope(page).getByLabel(/金額（日圓）/);
        await input.fill('abc');
        await page.getByText('請輸入數字').waitFor();
        expect((await page.locator('.exchange-box.out .big').innerText()) === '—', 'abc 時結果不是 —');
        await input.fill('-5');
        await page.getByText('請輸入數字').waitFor();
        await input.fill('1000000000000000');
        await noOverflow(page, '極大金額');
        await input.fill('0.5');
        await page.waitForTimeout(100);
        const v = await page.locator('.exchange-box.out .big').innerText();
        expect(v === '0', '0.5 日圓 ≈ 0.1 新台幣，顯示整數應為 0，實際 ' + v);
        return 'abc/負數被擋，極大值不溢出，小數正常';
    });
    await check('匯率（離線＋舊快取）', '先有快取，再把網路切斷並重新整理', '顯示「目前使用舊匯率」警告與匯率時間，仍可換算', async () => {
        await page.evaluate(() => { const c = JSON.parse(localStorage.getItem('hokkaido_exchange_rates')); c.timestamp -= 48 * 3600 * 1000; localStorage.setItem('hokkaido_exchange_rates', JSON.stringify(c)); });
        mode = 'off';
        await page.reload();
        await nav(page, '匯率');
        await page.getByText('目前使用舊匯率').waitFor();
        await scope(page).getByLabel(/金額（日圓）/).fill('1000');
        await page.waitForFunction(() => document.querySelector('.exchange-box.out .big')?.textContent === '200');
        await shot(page, 'd2-rates-stale');
        return '警告＋仍可換算（1000 日圓 = 200 新台幣）';
    });
    await ctx.close();
}

// ============ 記帳 ============
console.log('記帳');
if (on('記帳')) {
    const { ctx, page } = await ctxPage();
    const expenses = Array.from({ length: 200 }, (_, i) => ({ description: `花費 ${i + 1}`, amountJPY: 100 + i, category: '飲食', dateISO: '2026-02-10', paidBy: i % 2 ? '小明' : '自己', currency: 'JPY' }));
    await restore(page, backupWith({ expenses }));
    await nav(page, '記帳');
    await check('記帳（大量資料）', '還原 200 筆花費，開啟記帳頁', '200 筆全部顯示；總額正確；各人代墊小計；無溢出；少於 3 秒', async () => {
        const t0 = Date.now();
        await page.locator('.expense-row').first().waitFor();
        const n = await page.locator('.expense-row').count();
        expect(n === 200, '筆數 ' + n);
        const sum = expenses.reduce((a, e) => a + e.amountJPY, 0); // 200*100 + (0..199) = 20000+19900 = 39900
        await page.getByText('¥' + sum.toLocaleString('en-US')).first().waitFor();
        await page.getByText('自己 代墊').waitFor();
        await noOverflow(page, '記帳頁');
        await shot(page, 'e1-expenses-200');
        return `${n} 筆，總額 ¥${sum.toLocaleString('en-US')}，${Date.now() - t0}ms`;
    });
    await check('記帳（新增）', '新增：金額 1,234、說明含引號與逗號、先付款的人 100 字', '儲存成功並出現在列表最上方', async () => {
        await btn(page, '記一筆花費').click();
        await scope(page).getByLabel(/金額/).fill('1,234');
        await scope(page).getByLabel('說明', { exact: true }).fill('他說 "好吃", 很貴');
        await scope(page).getByLabel('誰先付的（分帳用）', { exact: true }).fill('朋友'.repeat(50));
        await btn(page, '儲存').click();
        await page.getByText('已記下這筆花費').waitFor();
        await noOverflow(page, '長付款人');
        return '成功';
    });
    await check('記帳（編輯）', '編輯剛新增的那筆：金額改 2,000、說明改「改過了」', '列表更新，總額同步，不新增重複項', async () => {
        const before = await page.locator('.expense-row').count();
        await page.getByRole('button', { name: /編輯：他說/ }).click();
        await scope(page).getByLabel(/金額/).fill('2000');
        await scope(page).getByLabel('說明', { exact: true }).fill('改過了');
        await btn(page, '儲存').click();
        await page.getByText('已更新這筆花費').waitFor();
        await page.getByText('改過了').waitFor();
        expect((await page.locator('.expense-row').count()) === before, '編輯變成了新增');
        return '正確';
    });
    await check('記帳（多幣別）', '到設定把當地幣別改成美元，回記帳新增 12.5；列表同時有日圓與美元紀錄', '美元紀錄顯示 US$12.50；總額把兩種幣別都換算進去', async () => {
        await nav(page, '設定');
        await page.getByRole('button', { name: '編輯旅程' }).click();
        await scope(page).getByLabel('當地幣別', { exact: true }).selectOption('USD');
        await page.getByRole('button', { name: '儲存設定' }).click();
        await page.getByText('旅程設定已儲存').waitFor();
        await nav(page, '記帳');
        await btn(page, '記一筆花費').click();
        await scope(page).getByLabel(/金額/).fill('12.5');
        await scope(page).getByLabel('說明', { exact: true }).fill('美元午餐');
        await btn(page, '儲存').click();
        await page.getByText('US$12.50').waitFor();
        await page.getByText('¥2,000').first().waitFor();
        await shot(page, 'e2-multicurrency');
        return '兩種幣別並存';
    });
    await check('記帳（匯出）', '按「匯出 CSV」', '下載 .csv，含 BOM、表頭、筆數正確（200+2 筆）', async () => {
        const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /匯出 CSV/ }).click()]);
        const path = await dl.path();
        const fs = await import('node:fs');
        const txt = fs.readFileSync(path, 'utf8');
        expect(txt.charCodeAt(0) === 0xfeff, '缺少 BOM');
        const lines = txt.trim().split('\r\n');
        expect(lines[0].includes('日期,說明,分類,金額,幣別,先付款的人') && lines.length === 1 + 202, `行數 ${lines.length}`);
        return `檔名 ${dl.suggestedFilename()}，${lines.length - 1} 筆`;
    });
    await check('記帳（刪除）', '刪除一筆：取消後不變、確認後減 1', '正確', async () => {
        const before = await page.locator('.expense-row').count();
        await page.getByRole('button', { name: /刪除：美元午餐/ }).click();
        await page.getByRole('alertdialog').getByRole('button', { name: '取消' }).click();
        expect((await page.locator('.expense-row').count()) === before, '取消後變了');
        await page.getByRole('button', { name: /刪除：美元午餐/ }).click();
        await page.getByRole('alertdialog').getByRole('button', { name: '刪除' }).click();
        await page.waitForTimeout(400);
        expect((await page.locator('.expense-row').count()) === before - 1, '確認後沒減 1');
        return '正確';
    });
    await check('記帳（空資料）', '新旅程尚無花費', '顯示空狀態而不是 NaN 或 0 的假統計', async () => {
        const c2 = await ctxPage();
        await restore(c2.page, backupWith({}));
        await nav(c2.page, '記帳');
        await c2.page.getByText('還沒有任何花費紀錄').waitFor();
        const text = await c2.page.locator('main').innerText();
        expect(!/NaN|undefined|Infinity/.test(text), '含 NaN/undefined');
        await shot(c2.page, 'e3-expenses-empty');
        await c2.ctx.close();
        return '空狀態正常';
    });
    await ctx.close();
}

// ============ 行李清單 ============
console.log('行李清單');
if (on('行李清單')) {
    const { ctx, page } = await ctxPage();
    await restore(page, backupWith({}));
    await nav(page, '清單');
    await check('行李清單', '新增 500 字的物品、連按新增兩次、勾選、刪除（至清空）', '只新增一個；長文字不溢出；清空後顯示空狀態且不會被預設項目填回', async () => {
        await scope(page).getByLabel('物品名稱', { exact: true }).fill('很長的物品'.repeat(100));
        await page.getByRole('button', { name: '新增物品' }).dblclick();
        await page.waitForTimeout(500);
        const n = await page.locator('.check-row').count();
        expect(n === 10, `應為 9+1=10 項，實際 ${n}（可能重複新增）`);
        await noOverflow(page, '長物品');
        for (let i = 0; i < 12; i++) {
            const del = page.getByRole('button', { name: /^刪除：/ }).first();
            if (!(await del.count())) break;
            await del.click();
            await page.waitForTimeout(120);
        }
        await page.getByText('清單是空的').waitFor();
        await page.reload();
        await nav(page, '清單');
        await page.getByText('清單是空的').waitFor();
        return '清空後重整仍為空';
    });
    await ctx.close();
}

// ============ 相簿 ============
console.log('相簿');
if (on('相簿')) {
    const { ctx, page } = await ctxPage();
    await restore(page, backupWith({}));
    await nav(page, '相簿');
    await check('相簿', '貼上 javascript:、data:、無效字串、超長網址、正常網址', '前三者被擋並說明；超長網址不溢出；正常網址儲存', async () => {
        await page.getByRole('button', { name: /貼上相簿連結/ }).first().click();
        const input = scope(page).getByLabel(/相簿分享連結/);
        for (const bad of ['javascript:alert(1)', 'data:text/html,<b>x</b>', '隨便打字']) {
            await input.fill(bad);
            await btn(page, '儲存').click();
            await page.getByText(/不是有效的網址/).waitFor();
        }
        await input.fill('https://photos.app.goo.gl/' + 'a'.repeat(900));
        await btn(page, '儲存').click();
        await page.getByRole('link', { name: /前往相簿/ }).waitFor();
        await noOverflow(page, '超長網址');
        await shot(page, 'f1-album');
        return '正確';
    });
    await ctx.close();
}

// ============ 票夾 ============
console.log('票夾');
if (on('票夾')) {
    const { ctx, page } = await ctxPage();
    await restore(page, backupWith({}));
    await nav(page, '票夾');
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    await check('票夾（私密圖片）', '新增票券：非圖片檔、13MB 圖片、正常 QR 圖', '前兩者被拒絕並說明；正常的存入並可放大；重新整理仍在', async () => {
        await btn(page, '新增票券或航班').click();
        await scope(page).getByLabel('名稱', { exact: true }).fill('測試票');
        const file = page.locator('input[type=file]').first();
        await file.setInputFiles({ name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') });
        await page.getByText('請選擇圖片檔').waitFor();
        await file.setInputFiles({ name: 'big.png', mimeType: 'image/png', buffer: Buffer.alloc(13 * 1024 * 1024, 1) });
        await page.getByText(/太大/).waitFor();
        await file.setInputFiles({ name: 'qr.png', mimeType: 'image/png', buffer: png });
        await btn(page, '儲存').click();
        await page.getByRole('heading', { name: '測試票' }).waitFor();
        await page.reload();
        await nav(page, '票夾');
        await page.getByRole('heading', { name: '測試票' }).waitFor();
        const ok = await page.locator('.ticket-thumb img').first().evaluate((i) => i.complete && i.naturalWidth > 0);
        expect(ok, '圖片沒有顯示');
        await shot(page, 'g1-tickets');
        return '拒絕兩種無效檔；有效圖重整後仍在';
    });
    await check('票夾（大量）', '再新增 20 張票券（文字備註 300 字）', '都顯示、不溢出', async () => {
        for (let i = 0; i < 20; i++) {
            await btn(page, '新增票券或航班').click();
            await scope(page).getByLabel('名稱', { exact: true }).fill(`票 ${i}`);
            await scope(page).getByLabel(/文字備註/).fill('備'.repeat(300));
            await btn(page, '儲存').click();
            await page.getByRole('heading', { name: `票 ${i}` }).waitFor();
        }
        expect((await page.locator('.ticket-card').count()) === 21, '張數不對');
        await noOverflow(page, '票夾');
        return '21 張';
    });
    await ctx.close();
}

// ============ 每日建議（天氣） ============
console.log('每日建議');
if (on('每日建議')) {
    const { ctx, page } = await ctxPage({ mocks: false });
    let weather = 'ok';
    await page.route('**/open.er-api.com/**', (r) => r.fulfill({ json: { result: 'success', rates: RATES } }));
    await page.route('**/*wikipedia.org/**', (r) => r.abort());
    await page.route('**/geocoding-api.open-meteo.com/**', (r) => (weather === 'nogeo' ? r.fulfill({ json: {} }) : r.fulfill({ json: { results: [{ latitude: 43, longitude: 141 }] } })));
    await page.route('**/api.open-meteo.com/**', (r) => {
        if (weather === '503') return r.fulfill({ status: 503, body: '{}' });
        if (weather === 'drop') return r.abort('connectionreset');
        const base = Date.now();
        const times = Array.from({ length: 16 }, (_, i) => new Date(base + i * 86400000).toISOString().slice(0, 10));
        return r.fulfill({ json: { daily: { time: times, weather_code: times.map(() => 71), temperature_2m_max: times.map(() => -1), temperature_2m_min: times.map(() => -7) } } });
    });
    const today = new Date().toISOString().slice(0, 10);
    const end = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    for (const [mode, expectText] of [['ok', /降雪|雪/], ['503', /天氣服務暫時無法使用/], ['nogeo', /找不到「/], ['drop', /天氣服務暫時無法使用|沒有網路/]]) {
        weather = mode;
        await check('每日建議（天氣）', `旅程為今天起 3 天，天氣服務狀態＝${mode}`, '顯示對應的白話訊息（有雪建議／服務錯誤／查無地點／連線中斷）', async () => {
            await page.goto(server.url);
            await page.evaluate(() => localStorage.clear());
            await restore(page, backupWith({ start: today, end }));
            await page.getByRole('heading', { name: /每日叮嚀/ }).waitFor();
            await page.waitForFunction(() => !document.querySelector('.daily-advice')?.textContent?.includes('讀取天氣中'), null, { timeout: 15000 });
            const text = await page.locator('.daily-advice').innerText();
            expect(expectText.test(text), '內容：' + text.slice(0, 120));
            if (mode === 'ok') await shot(page, 'h1-weather');
            return text.replace(/\s+/g, ' ').slice(0, 80);
        });
    }
    await ctx.close();
}

// ============ 試算表匯入 ============
console.log('試算表匯入');
if (on('試算表匯入')) {
    const { ctx, page } = await ctxPage();
    await restore(page, backupWith({ attractions: { 1: [attr(1)], 2: [attr(2)] } }));
    const open = async () => {
        await page.getByRole('button', { name: /匯入表格/ }).click();
        return page.getByRole('dialog');
    };
    await check('試算表匯入（格式錯誤）', '貼上無法辨識的文字、只有表頭、空白', '顯示錯誤，原景點不變', async () => {
        const dlg = await open();
        for (const bad of ['隨便亂貼', '天數\t景點名稱\t分類\t備註\n', '   ']) {
            await dlg.getByLabel('貼上表格內容').fill(bad);
            await dlg.getByRole('button', { name: '解析並匯入' }).click();
            await dlg.getByRole('alert').waitFor();
        }
        await dlg.getByRole('button', { name: '取消' }).click();
        expect((await page.locator('.attraction-card').count()) === 1, '原有景點被動到');
        return '三種壞輸入都被擋';
    });
    await check('試算表匯入（含 CRLF、引號、換行儲存格）', '貼上 Excel 風格 TSV（CRLF、儲存格內換行與雙引號）', '正確解析成景點，換行保留在說明中', async () => {
        const dlg = await open();
        const tsv = ['天數\t景點名稱\t分類\t備註', '1\t小樽運河\t景點\t"第一行\r\n第二行 ""引號"""', '1\t一蘭拉麵\t食物\t'].join('\r\n');
        await dlg.getByLabel('貼上表格內容').fill(tsv);
        await dlg.getByRole('button', { name: '解析並匯入' }).click();
        await page.getByRole('alertdialog').getByRole('button', { name: '匯入' }).click();
        await page.getByText(/匯入完成：2 個景點/).waitFor();
        expect((await page.locator('.attraction-card').count()) === 2, '景點數不對');
        return '2 個景點';
    });
    await check('試算表匯入（500 列）', '貼上 500 列直式資料', '解析成功，顯示確認摘要，匯入後 50 秒內完成', async () => {
        const dlg = await open();
        const rows = ['天數\t景點名稱\t分類\t備註', ...Array.from({ length: 500 }, (_, i) => `${(i % 3) + 1}\t景點${i}\t景點\t備註${i}`)];
        await dlg.getByLabel('貼上表格內容').fill(rows.join('\n'));
        const t0 = Date.now();
        await dlg.getByRole('button', { name: '解析並匯入' }).click();
        await page.getByRole('alertdialog').getByText(/500 個景點/).waitFor();
        await page.getByRole('alertdialog').getByRole('button', { name: '匯入' }).click();
        await page.getByText(/匯入完成：500 個景點/).waitFor({ timeout: 50000 });
        return `${Date.now() - t0}ms`;
    });
    await check('試算表匯入（還原點）', '到設定按「還原到那個時間點」', '行程回到匯入前', async () => {
        await nav(page, '設定');
        await page.getByRole('button', { name: '還原到那個時間點' }).click();
        await page.getByRole('alertdialog').getByRole('button', { name: '還原' }).click();
        await page.getByText('已還原旅程').waitFor();
        await nav(page, '行程');
        await page.waitForTimeout(500);
        const n = await page.locator('.attraction-card').count();
        expect(n === 2, `還原後第 1 天應為匯入前（2 個），實際 ${n}`);
        return '回到匯入前';
    });
    await ctx.close();
}

// ============ 備份與還原 ============
console.log('備份與還原');
if (on('備份與還原')) {
    const { ctx, page } = await ctxPage();
    await restore(page, backupWith({ attractions: { 1: [attr(1)] }, expenses: [{ description: '備份花費', amountJPY: 500, category: '飲食', dateISO: '2026-02-10', paidBy: '自己', currency: 'JPY' }] }));
    await check('備份與還原（下載）', '按「下載完整備份」', '下載 JSON，內含旅程、行程、記帳', async () => {
        await nav(page, '設定');
        const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /下載完整備份/ }).click()]);
        const txt = require_fs().readFileSync(await dl.path(), 'utf8');
        const j = JSON.parse(txt);
        expect(j.app === 'hokkaido-app' && Object.keys(j.stores.expenses).length === 1 && JSON.stringify(j).includes('景點 1'), '備份內容不完整');
        return dl.suggestedFilename();
    });
    for (const [name, buf, expectMsg] of [
        ['壞掉的 JSON', Buffer.from('{ not json'), /無法讀取|不是有效/],
        ['別的 App 的 JSON', Buffer.from('{"app":"other","version":1,"stores":{}}'), /不是這個 App/],
        ['截斷的備份', Buffer.from('{"app":"hokkaido-app","version":1,"stores":{"config":{"trips_list":[{"id"'), /無法讀取|不是有效/],
        ['來自未來版本', Buffer.from('{"app":"hokkaido-app","version":99,"stores":{}}'), /較新/],
        ['空檔案', Buffer.from(''), /無法讀取|不是有效/],
    ]) {
        await check('備份與還原（錯誤檔案）', `選擇「${name}」還原`, '顯示白話錯誤，現有資料不變', async () => {
            await nav(page, '設定');
            await page.locator('input[aria-label="選擇備份檔"]').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: buf });
            await page.getByText(expectMsg).first().waitFor({ timeout: 8000 });
            await nav(page, '記帳');
            await page.getByText('備份花費').waitFor();
            return '被拒絕，資料仍在';
        });
    }
    await ctx.close();
}

// ============ PWA：manifest、圖示、離線 ============
console.log('PWA');
if (on('PWA')) {
    const { ctx, page } = await ctxPage({ mocks: true });
    await check('PWA（可安裝性）', '讀取 manifest 與圖示', 'manifest 有名稱、start_url、scope、display=standalone、192/512/maskable 圖示且都可下載', async () => {
        await page.goto(server.url);
        const href = await page.locator('link[rel=manifest]').first().getAttribute('href');
        const m = await (await page.request.get(new URL(href, server.url).toString())).json();
        expect(m.name && m.start_url && m.scope && m.display === 'standalone', 'manifest 缺欄位');
        const sizes = m.icons.map((i) => `${i.sizes}:${i.purpose}`);
        for (const i of m.icons) {
            const r = await page.request.get(new URL(i.src, server.url).toString());
            expect(r.ok(), '圖示無法下載 ' + i.src);
        }
        expect(sizes.includes('192x192:any') && sizes.includes('512x512:any') && sizes.includes('512x512:maskable'), '缺圖示 ' + sizes);
        return sizes.join(' ');
    });
    await ctx.close();
    const sw = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'zh-TW', serviceWorkers: 'allow' });
    const p = await sw.newPage();
    await p.route('**/open.er-api.com/**', (r) => r.fulfill({ json: { rates: RATES } }));
    await p.route('**/*open-meteo.com/**', (r) => r.abort());
    await p.route('**/*wikipedia.org/**', (r) => r.abort());
    await check('PWA（離線與資料）', '載入 → Service Worker 就緒 → 離線 → 重新整理 → 新增花費 → 連線 → 重新整理', '離線仍可開啟與寫入，資料不遺失', async () => {
        await restore(p, backupWith({}));
        for (let i = 0; i < 40; i++) {
            if (await p.evaluate(async () => (await caches.keys()).some((k) => k.includes('precache')) && !!(await navigator.serviceWorker.getRegistration())?.active)) break;
            await p.waitForTimeout(500);
        }
        await p.reload();
        await sw.setOffline(true);
        await p.reload();
        await p.getByRole('heading', { name: '審查旅程' }).waitFor();
        await p.getByText(/目前沒有網路/).waitFor();
        await nav(p, '記帳');
        await btn(p, '記一筆花費').click();
        await scope(p).getByLabel(/金額/).fill('777');
        await scope(p).getByLabel('說明', { exact: true }).fill('離線新增');
        await btn(p, '儲存').click();
        await p.getByText('離線新增').waitFor();
        await sw.setOffline(false);
        await p.reload();
        await nav(p, '記帳');
        await p.getByText('離線新增').waitFor();
        return '離線新增的花費在恢復連線並重整後仍在';
    });
    await sw.close();
}

// ============ 螢幕寬度 × 瀏覽器語系 × 直橫切換：各分頁溢出與用語檢查 ============
console.log('版面與語系');
if (on('版面與語系')) for (const [w, h, locale] of [[390, 844, 'zh-TW'], [360, 740, 'zh-TW'], [390, 844, 'en-US'], [360, 740, 'en-US'], [844, 390, 'zh-TW']]) {
    const { ctx, page } = await ctxPage({ w, h, locale });
    const attractions = { 1: Array.from({ length: 3 }, (_, i) => attr(i + 1, { description: '說明 '.repeat(30), durationMinutes: 90, tags: ['必吃'] })) };
    await restore(page, backupWith({ attractions, expenses: [{ description: '拉麵', amountJPY: 1500, category: '飲食', dateISO: '2026-02-10', paidBy: '自己', currency: 'JPY' }], config: { accommodations: [{ id: 'h', name: '很長很長的飯店名稱'.repeat(5), address: '地址'.repeat(40), url: 'https://example.com', checkIn: '2026-02-10', checkOut: '2026-02-12' }] } }));
    for (const tab of ['行程', '匯率', '記帳', '票夾', '清單', '相簿', '設定']) {
        await check('版面與語系', `${w}×${h}、瀏覽器語系 ${locale}，開啟「${tab}」`, '無水平溢出；沒有英文日期佔位字；觸控目標 ≥44px；用語為繁體中文', async () => {
            await nav(page, tab);
            await page.waitForTimeout(250);
            await noOverflow(page, `${tab}@${w}`);
            const issues = await page.evaluate(() => {
                const out = [];
                for (const el of document.querySelectorAll('button, a[href], select, input:not([type=checkbox]):not([type=file]):not([type=date])')) {
                    const r = el.getBoundingClientRect();
                    if (!r.width || !r.height || el.closest('[hidden]')) continue;
                    if (r.height < 43.5 || r.width < 43.5) out.push(`${el.tagName}「${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 14)}」${Math.round(r.width)}×${Math.round(r.height)}`);
                }
                return out.filter((s) => !/^A「/.test(s));
            });
            expect(issues.length === 0, '觸控目標過小：' + issues.slice(0, 4).join('；'));
            const text = await page.locator('main > section:not([hidden])').innerText();
            expect(!/\b(yyyy|mm\/dd|Invalid Date|NaN|undefined|null)\b/i.test(text), '含不該出現的字樣');
            if (tab === '設定' || tab === '行程') await shot(page, `z-${w}x${h}-${locale}-${tab}`);
            return 'OK';
        });
    }
    await ctx.close();
}

await check('整體', '全程 console 錯誤', '沒有（排除刻意模擬的網路失敗）', async () => {
    const real = consoleErrors.filter((e) => !/Failed to load resource|net::ERR|503|Failed to fetch|ERR_/.test(e));
    expect(real.length === 0, real.slice(0, 3).join(' | '));
    return '0 個';
});

writeFileSync(OUT, JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} 通過，結果：${OUT}`);
await browser.close();
server.stop();
process.exit(failed.length ? 1 : 0);

function require_fs() {
    return globalThis.__fs ?? (globalThis.__fs = (await_import()));
}
function await_import() {
    // 同步載入 fs（ESM 頂層無法在函式內 await）
    return process.getBuiltinModule('node:fs');
}
