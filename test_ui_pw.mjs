import { chromium } from 'playwright';

(async () => {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        page.on('console', msg => console.log('LOG:', msg.text()));

        await page.goto('http://localhost:5173');

        console.log("Setting DB state...");
        await page.evaluate(async () => {
            return new Promise((resolve) => {
                const req = indexedDB.open('localforage');
                req.onsuccess = (e) => {
                    const db = e.target.result;
                    const tx = db.transaction('keyvaluepairs', 'readwrite');
                    const store = tx.objectStore('keyvaluepairs');
                    store.put({
                        title: 'Test', location: 'Test', startDate: '2026-02-21', endDate: '2026-02-23'
                    }, 'app_config');
                    const dayId = crypto.randomUUID();
                    store.put([dayId], 'dayOrder');
                    store.put({
                        id: dayId, date: '2026-02-21', attractions: [], advice: ''
                    }, dayId);
                    tx.oncomplete = () => resolve();
                };
            });
        });

        console.log("Reloading...");
        await page.reload({ waitUntil: 'networkidle' });

        console.log("Looking for Itinerary View");
        await page.waitForSelector('.itinerary-view', { timeout: 3000 });

        console.log("Clicking 編輯行程...");
        await page.click('button:has-text("編輯行程")');
        await page.waitForTimeout(500);

        console.log("Checking if 完成編輯 exists and is clickable...");
        const completeBtn = page.locator('button:has-text("完成編輯")');
        if (await completeBtn.isVisible()) {
            await completeBtn.click();
            console.log("SUCCESS: Clicked 完成編輯!");
            await page.waitForTimeout(500);
        } else {
            console.log("ERROR: 完成編輯 button not visible!");
        }
    } catch (e) {
        console.error("Test failed:", e);
    } finally {
        await browser.close();
    }
})();
