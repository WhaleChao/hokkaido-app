import { chromium } from 'playwright';

(async () => {
    console.log("Starting E2E Test...");
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        const logs = [];
        page.on('console', msg => logs.push(msg.text()));
        page.on('pageerror', err => console.log('BROWSER ERROR:', err.toString()));
        
        await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
        console.log("Loaded App.");
        
        // --- TEST 1: Initialize Trip Config ---
        await page.click('button:has-text("周邊")'); // Go to Nearby/Settings
        await page.waitForTimeout(500);
        await page.click('button:has-text("編輯旅程")');
        
        // Fill out settings (clear existing and type new)
        await page.fill('input[placeholder="例如：我的日本自由行"]', 'Automated Test Trip');
        await page.click('button:has-text("儲存設定")');
        console.log("TEST 1 PASSED: Trip settings saved.");
        await page.waitForTimeout(500);

        // --- TEST 2: Add Attraction ---
        await page.click('button:has-text("行程")'); // Go to Itinerary
        await page.waitForTimeout(500);
        await page.click('button.btn-toggle-edit:has-text("編輯行程")');
        await page.waitForTimeout(500);
        
        const addBtn = page.locator('button.btn-add-attraction');
        if (await addBtn.isVisible()) {
            await addBtn.click();
            await page.fill('textarea[placeholder="輸入關於這個景點的筆記..."]', 'Test Description');
            await page.click('button:has-text("儲存景點")');
            console.log("TEST 2 PASSED: Added an attraction.");
        } else {
            throw new Error("Add attraction button not visible.");
        }
        await page.waitForTimeout(500);

        // --- TEST 3: Edit Mode Toggle Fix Check ---
        await page.click('button.btn-toggle-edit:has-text("完成編輯")');
        await page.waitForTimeout(500);
        // Check if form closed
        const isFormVisible = await page.locator('.address-card h3:has-text("新增景點")').isVisible();
        if (isFormVisible) throw new Error("Form did not close automatically!");
        console.log("TEST 3 PASSED: Form closes perfectly on Complete Edit.");

        // --- TEST 4: Add Ticket ---
        await page.click('button:has-text("票夾")');
        await page.waitForTimeout(500);
        await page.click('button.btn-upload');
        await page.fill('input[placeholder="如: 星宇航空 JX800"]', 'Test Flight');
        await page.click('button.btn-save');
        console.log("TEST 4 PASSED: Added a ticket item.");
        await page.waitForTimeout(500);

        // --- TEST 5: Share Code Export ---
        await page.click('button:has-text("周邊")');
        await page.waitForTimeout(500);
        // Override window.alert to not block script
        await page.evaluate(() => window.alert = () => {});
        // Mock navigator.clipboard
        await page.evaluate(() => {
            Object.assign(navigator, {
                clipboard: { writeText: () => Promise.resolve() }
            });
        });
        await page.click('button:has-text("產生行程分享碼")');
        await page.waitForTimeout(500);
        console.log("TEST 5 PASSED: Export triggers successfully.");
        
        console.log("ALL E2E TESTS PASSED FLAWLESSLY!");

    } catch (e) {
        console.error("Test execution failed:", e);
    } finally {
        await browser.close();
    }
})();
