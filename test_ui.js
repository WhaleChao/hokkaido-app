import { chromium } from 'playwright';

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('LOG:', msg.text()));

    try {
        await page.goto('http://localhost:5173');
        
        console.log("Setting IndexedDB mock data...");
        await page.evaluate(async () => {
            return new Promise((resolve) => {
                const request = indexedDB.open('localforage');
                request.onsuccess = (event) => {
                    const db = event.target.result;
                    
                    try {
                        const tx = db.transaction('keyvaluepairs', 'readwrite');
                        const store = tx.objectStore('keyvaluepairs');
                        
                        // Set app_config
                        store.put({
                            title: 'Test Trip',
                            location: 'Test Location',
                            startDate: '2026-02-21',
                            endDate: '2026-02-23'
                        }, 'app_config');
                        
                        // Set itinerary
                        const dayId = crypto.randomUUID();
                        store.put([dayId], 'dayOrder');
                        store.put({
                            id: dayId,
                            date: '2026-02-21',
                            attractions: [],
                            advice: ''
                        }, dayId);
                        
                        tx.oncomplete = () => resolve();
                    } catch (e) {
                        console.error("IndexedDB inject failed:", e);
                        resolve();
                    }
                };
            });
        });

        console.log("Reloading with mock data...");
        await page.reload({ waitUntil: 'networkidle' });
        
        // Wait for Itinerary tab
        await page.waitForSelector('.itinerary-view', { timeout: 3000 });
        console.log("Itinerary view loaded");
        
        // Find Edit button
        const editBtn = page.locator('button.btn-toggle-edit', { hasText: '編輯行程' }).first();
        if (await editBtn.isVisible()) {
            console.log("Found '編輯行程' button. Clicking...");
            await editBtn.click();
            await page.waitForTimeout(500);
            
            // Now it should say "完成編輯"
            const completeBtn = page.locator('button.btn-toggle-edit', { hasText: '完成編輯' }).first();
            if (await completeBtn.isVisible()) {
                console.log("Found '完成編輯'. Clicking...");
                await completeBtn.click();
                await page.waitForTimeout(500);
                
                // Check if it toggled back to '編輯行程'
                const backBtn = page.locator('button.btn-toggle-edit', { hasText: '編輯行程' }).first();
                if (await backBtn.isVisible()) {
                    console.log("Successfully toggled back! The button works.");
                } else {
                    console.log("ERROR: Button did not toggle back to 編輯行程. It might be unresponsive.");
                }
            } else {
                console.log("ERROR: '完成編輯' button not found after clicking Edit.");
            }
        } else {
            console.log("ERROR: '編輯行程' button not found.");
        }

    } catch (e) {
        console.error("Test error:", e);
    } finally {
        await browser.close();
    }
})();
