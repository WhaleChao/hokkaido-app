// 升級相容性端對端測試：
//   1. 用「舊版」（既有使用者手機上跑的版本）的真實程式，在瀏覽器裡建立行程、景點、記帳、清單、相簿連結、票券
//   2. 關掉舊版，在「同一個網址、同一份瀏覽器資料」改開新版
//   3. 逐項確認資料都在、舊版寫入的每一筆 IndexedDB 紀錄內容完全沒變
// 用法：npm run build && node e2e/migration.mjs     （OLD_COMMIT 預設為改版前的 main：0091792）
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startPreview, launch, makeChecker } from './lib.mjs';
import { chromium } from 'playwright';

const root = process.cwd();
const OLD_COMMIT = process.env.OLD_COMMIT || '0091792';
const oldDir = join(root, 'node_modules', '.e2e-old-app');
const profile = join(tmpdir(), `hokkaido-e2e-profile-${Date.now()}`);
const PORT = 4188;

// --- 準備舊版 ---
if (!existsSync(join(oldDir, 'dist'))) {
    rmSync(oldDir, { recursive: true, force: true });
    mkdirSync(oldDir, { recursive: true });
    execSync(`git archive ${OLD_COMMIT} | tar -x -C "${oldDir}"`, { cwd: root, stdio: 'inherit' });
    symlinkSync(join(root, 'node_modules'), join(oldDir, 'node_modules'));
    execSync(`"${process.execPath}" "${root}/node_modules/vite/bin/vite.js" build`, { cwd: oldDir, stdio: 'inherit' });
}

const t = makeChecker();
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

async function dumpDb(page) {
    return page.evaluate(
        () =>
            new Promise((resolve, reject) => {
                const req = indexedDB.open('hokkaido_app');
                req.onerror = () => reject(req.error);
                req.onsuccess = () => {
                    const db = req.result;
                    const out = {};
                    const names = Array.from(db.objectStoreNames);
                    let pending = names.length;
                    if (!pending) resolve(out);
                    for (const n of names) {
                        const tx = db.transaction(n, 'readonly').objectStore(n);
                        const keysReq = tx.getAllKeys();
                        const valsReq = tx.getAll();
                        valsReq.onsuccess = () => {
                            const norm = (v) => (v instanceof Blob ? { __blob: true, size: v.size, type: v.type } : Array.isArray(v) ? v.map(norm) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, norm(x)])) : v);
                            out[n] = Object.fromEntries(keysReq.result.map((k, i) => [k, norm(valsReq.result[i])]));
                            if (--pending === 0) resolve(out);
                        };
                    }
                };
            }),
    );
}

// ===== 階段 1：舊版 =====
console.log(`階段 1：用舊版（${OLD_COMMIT}）建立資料`);
const oldServer = await startPreview(PORT, oldDir);
let ctx = await chromium.launchPersistentContext(profile, { channel: process.env.E2E_CHANNEL || 'chrome', viewport: { width: 390, height: 844 }, locale: 'zh-TW' });
let page = await ctx.newPage();
page.on('dialog', (d) => d.accept());
await page.route('**/open.er-api.com/**', (r) => r.fulfill({ json: { rates: { USD: 1, JPY: 150, TWD: 30, EUR: 0.9, KRW: 1300, THB: 35 } } }));
await page.route('**/*open-meteo.com/**', (r) => r.fulfill({ status: 503, body: '{}' }));
await page.route('**/*wikipedia.org/**', (r) => r.fulfill({ json: { query: { pages: {} } } }));
await page.route('**/raw.githubusercontent.com/**', (r) => r.abort());

let before;
await t.step('舊版：建立行程、設定住宿、新增景點、記帳、清單、相簿、票券', async () => {
    await page.goto(oldServer.url);
    await page.click('text=建立新的行程');
    await page.fill('input[type=text]', '升級測試之旅');
    const d = page.locator('input[type=date]');
    await d.nth(0).fill('2026-02-10');
    await d.nth(1).fill('2026-02-12');
    await page.click('button:has-text("確認開團")');
    await page.waitForSelector('text=升級測試之旅');
    const nav = (label) => page.locator('nav button', { hasText: label }).click();

    await nav('設定');
    await page.click('button:has-text("編輯旅程")');
    await page.locator('.trip-config-edit input[type=text]').nth(1).fill('Sapporo, Japan');
    await page.locator('.trip-config-edit input[type=number]').fill('2');
    await page.click('button:has-text("儲存設定")');
    await page.click('text=新增更多住宿');
    await page.fill('input[placeholder="輸入飯店或民宿名稱"]', '舊版飯店');
    await page.fill('input[placeholder^="例如: 札幌市"]', '札幌市中央區大通西1丁目');
    await page.locator('.address-card.fade-in button:has-text("儲存")').click();

    await nav('行程');
    await page.click('button:has-text("編輯行程")');
    await page.click('text=在這天新增景點');
    await page.fill('input[placeholder="例如：小樽運河"]', '舊版景點小樽運河');
    await page.fill('textarea[placeholder="輸入關於這個景點的筆記..."]', '舊版寫的備註');
    await page.click('.add-attraction-form button:has-text("儲存景點")');
    await page.waitForSelector('text=舊版景點小樽運河');

    await nav('記帳');
    await page.click('text=記一筆帳');
    await page.locator('.expense-view input[type=number]').fill('1200');
    await page.fill('input[placeholder^="如：晚餐"]', '舊版拉麵');
    await page.click('button:has-text("儲存紀錄")');
    await page.waitForSelector('text=舊版拉麵');

    await nav('清單');
    await page.waitForSelector('text=護照');
    await page.fill('input[placeholder="輸入新物品..."]', '舊版暖暖包');
    await page.click('.btn-add-checklist-item');
    await page.waitForSelector('text=舊版暖暖包');
    await page.locator('div:has(> button + span:text("舊版暖暖包")) > button').first().click(); // 勾選
    await page.waitForTimeout(300);

    await nav('相簿');
    await page.locator('button:has-text("點此貼上連結")').first().click();
    await page.fill('input.album-input', 'https://photos.app.goo.gl/oldversion');
    await page.click('button:has-text("儲存連結")');
    await page.waitForSelector('text=前往瀏覽');

    await nav('票夾');
    await page.click('text=新增車票/航班/票券');
    await page.fill('input[placeholder="如: 星宇航空 JX800"]', '舊版航班');
    await page.locator('input[type=file]').first().setInputFiles({ name: 'qr.png', mimeType: 'image/png', buffer: PNG });
    await page.click('button.btn-save:has-text("儲存")');
    await page.waitForSelector('text=舊版航班');
    await page.waitForTimeout(500);
    before = await dumpDb(page);
});
await ctx.close();
oldServer.stop();

// ===== 階段 2：新版，同一份瀏覽器資料 =====
console.log('階段 2：改開新版（同一個網址、同一份瀏覽器資料）');
const newServer = await startPreview(PORT, root);
ctx = await chromium.launchPersistentContext(profile, { channel: process.env.E2E_CHANNEL || 'chrome', viewport: { width: 390, height: 844 }, locale: 'zh-TW' });
page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.route('**/open.er-api.com/**', (r) => r.fulfill({ json: { rates: { USD: 1, JPY: 150, TWD: 30, EUR: 0.9, KRW: 1300, THB: 35 } } }));
await page.route('**/*open-meteo.com/**', (r) => r.fulfill({ status: 503, body: '{}' }));
await page.route('**/*wikipedia.org/**', (r) => r.fulfill({ json: { query: { pages: {} } } }));
const nav2 = (label) => page.getByRole('navigation', { name: '主選單' }).getByRole('button', { name: label }).click();
const panel = () => page.locator('main > section:not([hidden])');

await t.step('新版開啟後直接回到原本的行程（不是空白首頁）', async () => {
    await page.goto(newServer.url);
    await page.getByRole('heading', { name: '升級測試之旅' }).waitFor();
});
await t.step('行程：舊版新增的景點與備註還在', async () => {
    await page.getByRole('heading', { name: '舊版景點小樽運河' }).waitFor();
    await page.getByRole('button', { name: /第 3 天/ }).waitFor();
});
await t.step('住宿：舊版設定的住宿帶入日期後，新版的「返回住宿」按鈕出現', async () => {
    await page.getByRole('button', { name: /返回 舊版飯店/ }).waitFor();
});
await t.step('記帳：舊紀錄金額、總額、平分都正確（人數 2）', async () => {
    await nav2('記帳');
    await page.getByText('舊版拉麵').waitFor();
    await page.getByText('¥1,200').first().waitFor();
    await page.getByText('¥600').waitFor();
});
await t.step('清單：自己加的項目與勾選狀態保留，沒有被預設清單覆蓋', async () => {
    await nav2('清單');
    await page.getByText('舊版暖暖包').waitFor();
    const packed = await page.getByRole('checkbox', { name: /舊版暖暖包/ }).getAttribute('aria-checked');
    if (packed !== 'true') throw new Error('勾選狀態遺失：' + packed);
    await page.getByText('護照 (檢查效期過期沒)').waitFor(); // 舊版預設文字原樣保留
});
await t.step('相簿：連結還在', async () => {
    await nav2('相簿');
    const href = await panel().getByRole('link', { name: /前往相簿/ }).first().getAttribute('href');
    if (href !== 'https://photos.app.goo.gl/oldversion') throw new Error('連結不符：' + href);
});
await t.step('票夾：票券標題與私密圖片都能顯示（圖片真的解碼成功）', async () => {
    await nav2('票夾');
    await page.getByRole('heading', { name: '舊版航班' }).waitFor();
    await page.getByRole('button', { name: /放大查看/ }).waitFor();
    const ok = await page.locator('.ticket-thumb img').first().evaluate((img) => img.complete && img.naturalWidth > 0);
    if (!ok) throw new Error('票券圖片無法顯示');
});
await t.step('設定：舊版設定的地點、人數、日期都在', async () => {
    await nav2('設定');
    const need = async (label, loc) => {
        try {
            await loc.waitFor({ timeout: 5000 });
        } catch {
            throw new Error(`找不到：${label}（頁面文字：${(await panel().innerText()).replace(/\s+/g, ' ').slice(0, 300)}）`);
        }
    };
    await need('主要地點 Sapporo, Japan', panel().getByText('Sapporo, Japan'));
    await need('同行人數 2 人', panel().getByText('2 人', { exact: true }));
    await need('日期區間', panel().getByText(/2026[-/]02[-/]10\s*\S\s*2026[-/]02[-/]12/));
});
await t.step('新版開啟後，舊版寫入的每一筆資料庫紀錄內容完全沒變', async () => {
    const after = await dumpDb(page);
    const diffs = [];
    for (const [store, rows] of Object.entries(before)) {
        for (const [key, val] of Object.entries(rows)) {
            const now = after[store]?.[key];
            if (JSON.stringify(now) !== JSON.stringify(val)) diffs.push(`${store}/${key}\n  舊：${JSON.stringify(val).slice(0, 200)}\n  新：${JSON.stringify(now)?.slice(0, 200)}`);
        }
    }
    if (diffs.length) throw new Error('有舊資料被改動或遺失：\n' + diffs.join('\n'));
});
await t.step('新版寫入新資料（記一筆）後，舊資料仍然完整；重整後都還在', async () => {
    await nav2('記帳');
    await page.getByRole('button', { name: /記一筆花費/ }).click();
    await panel().getByLabel(/金額/).fill('800');
    await panel().getByLabel('說明').fill('新版便當');
    await page.getByRole('button', { name: '儲存', exact: true }).click();
    await page.getByText('新版便當').waitFor();
    await page.reload();
    await nav2('記帳');
    await page.getByText('舊版拉麵').waitFor();
    await page.getByText('新版便當').waitFor();
    await page.getByText('¥2,000').first().waitFor(); // 1200 + 800
});
await t.step('新版沒有 JavaScript 錯誤', async () => {
    if (errors.length) throw new Error(errors.join('\n'));
});

await ctx.close();
newServer.stop();
rmSync(profile, { recursive: true, force: true });
process.exit(t.done() ? 0 : 1);
