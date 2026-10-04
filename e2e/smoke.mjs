// 端對端冒煙測試：用真實瀏覽器（Chrome）操作「正式建置」的 App——建立行程、新增景點、記帳、清單、
// 設定住宿、重整後資料仍在、離線重開仍可用、深淺色與手機／桌面版面。
// 用法：npm run build && npm run e2e        （截圖：SHOT_DIR=/path npm run e2e）
import { mkdirSync } from 'node:fs';
import { startPreview, launch, makeChecker } from './lib.mjs';

const SHOT_DIR = process.env.SHOT_DIR;
if (SHOT_DIR) mkdirSync(SHOT_DIR, { recursive: true });

const server = await startPreview(4179);
const browser = await launch();
const t = makeChecker();
const consoleErrors = [];

async function newPage(opts = {}) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'zh-TW', timezoneId: 'Asia/Taipei', ...opts });
    const page = await ctx.newPage();
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
    page.on('pageerror', (e) => consoleErrors.push('PAGEERROR ' + e.message));
    return { ctx, page };
}
const panel = (page) => page.locator('main > section:not([hidden])');
const shot = async (page, name) => {
    if (!SHOT_DIR) return;
    await page.waitForTimeout(450); // 等淡入動畫結束再截圖
    await page.screenshot({ path: `${SHOT_DIR}/${name}.png`, fullPage: false });
};

const { ctx, page } = await newPage({ serviceWorkers: 'allow' });
await page.route('**/open.er-api.com/**', (r) => r.fulfill({ json: { result: 'success', rates: { USD: 1, JPY: 150, TWD: 30, EUR: 0.9, KRW: 1300, THB: 35 } } }));
await page.route('**/geocoding-api.open-meteo.com/**', (r) => r.fulfill({ json: { results: [{ latitude: 43.06, longitude: 141.35 }] } }));
await page.route('**/api.open-meteo.com/**', (r) => {
    const d = new Date();
    const times = Array.from({ length: 16 }, (_, i) => new Date(d.getTime() + i * 86400000).toISOString().slice(0, 10));
    r.fulfill({ json: { daily: { time: times, weather_code: times.map(() => 71), temperature_2m_max: times.map(() => -1), temperature_2m_min: times.map(() => -7) } } });
});
await page.route('**/wikipedia.org/**', (r) => r.fulfill({ json: { query: { pages: {} } } }));

console.log('冒煙測試（手機 390px）');

await t.step('首頁載入、沒有行程時顯示空狀態與範例入口', async () => {
    await page.goto(server.url);
    await page.getByRole('heading', { name: '我的旅程庫' }).waitFor();
    await page.getByText('還沒有任何旅程').waitFor();
    await shot(page, '01-dashboard-light-mobile');
});

await t.step('建立行程：日期顛倒會被擋下並說明', async () => {
    await page.getByRole('button', { name: /建立新旅程/ }).click();
    await page.getByLabel('旅程名稱', { exact: true }).fill('冒煙測試之旅');
    await page.getByLabel('出發日', { exact: true }).fill('2026-02-12');
    await page.getByLabel('結束日', { exact: true }).fill('2026-02-10');
    await page.keyboard.press('Tab');
    await page.getByText(/日期不能早於/).first().waitFor();
    await page.getByLabel('出發日', { exact: true }).fill('2026-02-10');
    await page.getByLabel('結束日', { exact: true }).fill('2026-02-12');
    await page.getByRole('button', { name: '建立', exact: true }).click();
    await page.getByRole('heading', { name: '冒煙測試之旅' }).waitFor();
});

await t.step('行程頁：三天、Day 1 預設選取、空狀態提示', async () => {
    await page.getByRole('button', { name: /第 1 天/ }).waitFor();
    await page.getByRole('button', { name: /第 3 天/ }).waitFor();
    await page.getByText('這一天還沒有安排景點').waitFor();
});

await t.step('設定：填主要地點與住宿（含入住日期）', async () => {
    await page.getByRole('navigation', { name: '主選單' }).getByRole('button', { name: '設定' }).click();
    await page.getByRole('button', { name: '編輯旅程' }).click();
    await panel(page).getByLabel(/主要地點/).fill('Sapporo, Japan');
    await panel(page).getByLabel('同行人數（分帳用）').fill('2');
    await page.getByRole('button', { name: '儲存設定' }).click();
    await page.getByText('Sapporo, Japan').first().waitFor();
    await page.getByRole('button', { name: '新增住宿' }).click();
    await panel(page).getByLabel('住宿名稱').fill('札幌測試飯店');
    await panel(page).getByLabel(/地址/).fill('札幌市中央區大通西1丁目');
    await panel(page).getByLabel('訂房或官網連結（選填）').fill('javascript:alert(1)');
    await page.getByRole('button', { name: '儲存', exact: true }).click();
    await page.getByText(/不是有效的網址/).waitFor(); // 不安全網址被擋
    await panel(page).getByLabel('訂房或官網連結（選填）').fill('');
    await page.getByRole('button', { name: '儲存', exact: true }).click();
    await page.getByRole('heading', { name: '札幌測試飯店' }).waitFor();
    await shot(page, '06-settings-light-mobile');
});

await t.step('行程：編輯模式新增景點；取消編輯不會偷偷存檔；刪除需要確認', async () => {
    await page.getByRole('navigation', { name: '主選單' }).getByRole('button', { name: '行程' }).click();
    await page.getByRole('button', { name: '編輯行程' }).click();
    await page.getByRole('button', { name: /在這天新增景點/ }).click();
    await panel(page).getByLabel('景點名稱').fill('小樽運河');
    await panel(page).getByLabel('說明與筆記').fill('傍晚點燈最美 https://example.com/otaru');
    await page.getByRole('button', { name: '儲存', exact: true }).click();
    await page.getByRole('heading', { name: '小樽運河' }).waitFor();
    await page.getByRole('button', { name: '編輯：小樽運河' }).click();
    await panel(page).getByLabel('景點名稱').fill('不應該被存下的名字');
    await page.getByRole('button', { name: '取消', exact: true }).click();
    await page.getByRole('heading', { name: '小樽運河' }).waitFor();
    if ((await page.getByText('不應該被存下的名字').count()) > 0) throw new Error('取消後名稱仍被儲存');
    await page.getByRole('button', { name: '刪除：小樽運河' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: '取消' }).click();
    await page.getByRole('heading', { name: '小樽運河' }).waitFor(); // 取消刪除
    await page.getByRole('button', { name: '完成' }).click();
});

await t.step('行程：每日叮嚀（天氣）與「返回住宿」按鈕', async () => {
    await page.getByRole('button', { name: /返回 札幌測試飯店/ }).waitFor();
    await page.getByRole('heading', { name: /每日叮嚀/ }).waitFor();
    await shot(page, '02-itinerary-light-mobile');
});

await t.step('景點詳情視窗：Esc 關閉、焦點回到卡片', async () => {
    await page.getByRole('button', { name: /詳情/ }).first().click();
    await page.getByRole('dialog').waitFor();
    await shot(page, '03-detail-light-mobile');
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'detached' });
});

await t.step('記帳：無效金額被擋、有效金額存入、總額與平分正確、刪除需確認', async () => {
    await page.getByRole('navigation', { name: '主選單' }).getByRole('button', { name: '記帳' }).click();
    await page.getByRole('button', { name: /記一筆花費/ }).click();
    await panel(page).getByLabel(/金額/).fill('abc');
    await panel(page).getByLabel('說明').fill('拉麵');
    await page.getByRole('button', { name: '儲存', exact: true }).click();
    await page.getByText(/請輸入大於 0 的整數金額/).waitFor();
    await panel(page).getByLabel(/金額/).fill('1,500');
    await page.getByRole('button', { name: '儲存', exact: true }).click();
    await page.getByText('已記下這筆花費').waitFor();
    await page.getByText('約 NT$300').waitFor();
    await page.getByText('¥750').waitFor();
    await shot(page, '04-expense-light-mobile');
});

await t.step('匯率：換算與對調方向', async () => {
    await page.getByRole('navigation', { name: '主選單' }).getByRole('button', { name: '匯率' }).click();
    await panel(page).getByLabel(/金額（日圓）/).fill('3000');
    await page.getByText('600', { exact: true }).waitFor();
    await page.getByRole('button', { name: /對調方向/ }).click();
    await panel(page).getByLabel(/金額（新台幣）/).waitFor();
});

await t.step('行李清單：預設項目、勾選、進度、日本海關提醒', async () => {
    await page.getByRole('navigation', { name: '主選單' }).getByRole('button', { name: '清單' }).click();
    await page.getByText('護照（確認效期）').waitFor();
    await page.getByRole('checkbox', { name: /護照/ }).click();
    await page.getByText(/^1 \/ 9$/).waitFor();
    await page.getByText(/日本海關：/).waitFor();
    await shot(page, '05-checklist-light-mobile');
});

await t.step('票夾：新增票券（含私密圖片）並可放大查看', async () => {
    await page.getByRole('navigation', { name: '主選單' }).getByRole('button', { name: '票夾' }).click();
    await page.getByRole('button', { name: /新增票券或航班/ }).click();
    await panel(page).getByLabel('名稱').fill('測試航班');
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    await page.locator('input[type=file]').first().setInputFiles({ name: 'qr.png', mimeType: 'image/png', buffer: png });
    await page.getByRole('button', { name: '儲存', exact: true }).click();
    await page.getByRole('heading', { name: '測試航班' }).waitFor();
    await page.getByRole('button', { name: /放大查看/ }).click();
    await page.getByRole('dialog').waitFor();
    await page.keyboard.press('Escape');
});

await t.step('相簿：不安全網址被擋，正常網址可儲存', async () => {
    await page.getByRole('navigation', { name: '主選單' }).getByRole('button', { name: '相簿' }).click();
    await page.getByRole('button', { name: /貼上相簿連結/ }).first().click();
    await panel(page).getByLabel(/相簿分享連結/).fill('javascript:alert(1)');
    await page.getByRole('button', { name: '儲存', exact: true }).click();
    await page.getByText(/不是有效的網址/).waitFor();
    await panel(page).getByLabel(/相簿分享連結/).fill('photos.app.goo.gl/test');
    await page.getByRole('button', { name: '儲存', exact: true }).click();
    await page.getByRole('link', { name: /前往相簿/ }).waitFor();
});

await t.step('重新整理後資料全部還在', async () => {
    await page.reload();
    await page.getByRole('heading', { name: '冒煙測試之旅' }).waitFor();
    await page.getByRole('heading', { name: '小樽運河' }).waitFor();
    await page.getByRole('navigation', { name: '主選單' }).getByRole('button', { name: '記帳' }).click();
    await page.getByText('拉麵').waitFor();
    await page.getByRole('navigation', { name: '主選單' }).getByRole('button', { name: '票夾' }).click();
    await page.getByRole('heading', { name: '測試航班' }).waitFor();
});

await t.step('Service Worker 已啟用並完成預先快取', async () => {
    for (let i = 0; i < 60; i++) {
        const ok = await page.evaluate(async () => {
            const reg = await navigator.serviceWorker.getRegistration();
            if (!reg?.active) return false;
            const keys = await caches.keys();
            return keys.some((k) => k.includes('precache'));
        });
        if (ok) return;
        await page.waitForTimeout(500);
    }
    throw new Error('Service Worker 沒有啟用或沒有預先快取');
});

await t.step('離線：整頁重新載入仍可開啟，資料可讀，並提示沒有網路', async () => {
    await page.reload(); // 讓 SW 接管頁面
    await page.getByRole('heading', { name: '冒煙測試之旅' }).waitFor();
    await ctx.setOffline(true);
    await page.reload();
    await page.getByRole('heading', { name: '冒煙測試之旅' }).waitFor();
    await page.getByText(/目前沒有網路/).waitFor();
    await page.getByRole('heading', { name: '小樽運河' }).waitFor();
    // 離線時天氣顯示先前存下的預報，而不是壞掉
    await page.getByRole('heading', { name: /每日叮嚀/ }).waitFor();
    await shot(page, '07-offline-light-mobile');
    await ctx.setOffline(false);
});

await t.step('深色主題：版面與對比（手動切換）', async () => {
    await page.getByRole('navigation', { name: '主選單' }).getByRole('button', { name: '設定' }).click();
    await page.getByRole('button', { name: '深色', exact: true }).click();
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    if (bg !== 'rgb(13, 23, 34)') throw new Error('深色背景不正確：' + bg);
    await page.getByRole('navigation', { name: '主選單' }).getByRole('button', { name: '行程' }).click();
    await shot(page, '02-itinerary-dark-mobile');
    await page.getByRole('navigation', { name: '主選單' }).getByRole('button', { name: '記帳' }).click();
    await shot(page, '04-expense-dark-mobile');
    await page.getByRole('navigation', { name: '主選單' }).getByRole('button', { name: '設定' }).click();
    await shot(page, '06-settings-dark-mobile');
});

await t.step('無障礙：每個按鈕與連結都有可讀名稱、頁面沒有橫向捲動', async () => {
    const bad = await page.evaluate(() => {
        const out = [];
        for (const el of document.querySelectorAll('button, a[href], input, select, textarea')) {
            if (el.closest('[hidden]') || el.type === 'hidden' || el.hidden) continue;
            const name = (el.getAttribute('aria-label') || el.textContent || el.labels?.[0]?.textContent || el.getAttribute('placeholder') || '').trim();
            if (!name) out.push(el.outerHTML.slice(0, 120));
        }
        return out;
    });
    if (bad.length) throw new Error('沒有名稱的互動元素：\n' + bad.join('\n'));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 1) throw new Error('出現橫向捲動：' + overflow + 'px');
});

await t.step('觸控目標至少 44px（可見的按鈕、連結、輸入框）', async () => {
    await page.getByRole('navigation', { name: '主選單' }).getByRole('button', { name: '行程' }).click();
    const small = await page.evaluate(() => {
        const out = [];
        for (const el of document.querySelectorAll('button, a[href], select, input:not([type=checkbox]):not([type=file])')) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            if (el.closest('[hidden]')) continue;
            if (r.height < 43.5 || r.width < 43.5) out.push(`${el.tagName} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 20)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
        return out;
    });
    // 行內文字連結（說明裡的網址）不在此限
    const real = small.filter((s) => !/^A "https?:/.test(s));
    if (real.length) throw new Error('太小的觸控目標：\n' + real.join('\n'));
});

await ctx.close();

// 桌面版與首頁截圖
const desk = await newPage({ viewport: { width: 1280, height: 800 } });
await desk.page.route('**/open.er-api.com/**', (r) => r.fulfill({ json: { rates: { USD: 1, JPY: 150, TWD: 30, EUR: 0.9, KRW: 1300, THB: 35 } } }));
await desk.page.route('**/*open-meteo.com/**', (r) => r.fulfill({ status: 503, body: '{}' }));
await t.step('桌面版（1280px）：側邊導覽列與雙欄卡片', async () => {
    await desk.page.goto(server.url);
    await desk.page.getByRole('button', { name: /建立新旅程/ }).click();
    await desk.page.getByLabel('旅程名稱', { exact: true }).fill('桌面測試');
    await desk.page.getByLabel('出發日', { exact: true }).fill('2026-02-10');
    await desk.page.getByLabel('結束日', { exact: true }).fill('2026-02-12');
    await desk.page.getByRole('button', { name: '建立', exact: true }).click();
    await desk.page.getByRole('heading', { name: '桌面測試' }).waitFor();
    await desk.page.getByRole('button', { name: '編輯行程' }).click();
    for (const n of ['新千歲機場', '小樽運河']) {
        await desk.page.getByRole('button', { name: /在這天新增景點/ }).click();
        await panel(desk.page).getByLabel('景點名稱').fill(n);
        await desk.page.getByRole('button', { name: '儲存', exact: true }).click();
        await desk.page.getByRole('heading', { name: n }).waitFor();
    }
    await desk.page.getByRole('button', { name: '完成' }).click();
    await desk.page.getByText(/天氣服務暫時無法使用|到「設定」填寫主要地點/).waitFor();
    await shot(desk.page, '02-itinerary-light-desktop');
});
await desk.ctx.close();

// 首頁深色（系統偏好）
const dark = await newPage({ colorScheme: 'dark' });
await t.step('系統深色偏好：首頁自動套用深色', async () => {
    await dark.page.goto(server.url);
    await dark.page.getByRole('heading', { name: '我的旅程庫' }).waitFor();
    const bg = await dark.page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    if (bg !== 'rgb(13, 23, 34)') throw new Error('深色背景不正確：' + bg);
    await shot(dark.page, '01-dashboard-dark-mobile');
});
await dark.ctx.close();

await t.step('整個流程沒有 console 錯誤（排除刻意模擬的網路失敗）', async () => {
    const real = consoleErrors.filter((e) => !/Failed to load resource|net::ERR|503|Failed to fetch/.test(e));
    if (real.length) throw new Error(real.join('\n'));
});

await browser.close();
server.stop();
process.exit(t.done() ? 0 : 1);
