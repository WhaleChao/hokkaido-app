import { chromium } from 'playwright';

(async () => {
    console.log("Starting Multi-Trip Vault Automation Test...");
    const browser = await chromium.launch({ headless: true });
    
    try {
        const page = await browser.newPage();
        page.on('console', msg => console.log('LOG:', msg.text()));
        page.on('pageerror', err => console.log('ERROR:', err.toString()));
        
        await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
        console.log("App Loaded!");

        // The app might load into legacy migration automatically if DB is empty, or show dashboard.
        // Wait 1 second to see what we hit
        await page.waitForTimeout(1000);

        // 1. Check if we are in Dashboard or Tabs. If in tabs, exit.
        const dashboardTitle = await page.locator('h1:has-text("我的行程庫")').isVisible();
        if (!dashboardTitle) {
            console.log("Legacy DB auto-migrated. Exiting back to Dashboard...");
            // Click the back chevron button in Header
            await page.click('header button');
            await page.waitForTimeout(1000);
        }

        const isDashboard = await page.locator('h1:has-text("我的行程庫")').isVisible();
        if (!isDashboard) throw new Error("Dashboard did not mount correctly after back navigation.");
        console.log("TEST 1 PASSED: Dashboard mounted securely.");

        // 2. Create a new trip
        await page.click('button:has-text("建立新的行程")');
        await page.waitForTimeout(500);
        await page.fill('input[placeholder="例如：2025 大阪五星爆吃之旅"]', 'Sapporo Snow Festival');
        await page.click('button:has-text("確認開團")');
        await page.waitForTimeout(1000);
        console.log("TEST 2 PASSED: Trip Created. Checking Routing...");

        // After creation, it should route us inside the trip
        const isItinerary = await page.locator('.itinerary-view').isVisible();
        if (!isItinerary) throw new Error("Did not route to Itinerary tab after trip creation.");
        console.log("TEST 3 PASSED: Dynamic Routing engaged properly.");

        // Edit Config to give it some data footprints
        await page.click('button:has-text("周邊")'); // Settings Tab
        await page.waitForTimeout(500);
        await page.click('button:has-text("編輯旅程")');
        await page.fill('input[placeholder="例如：我的日本自由行"]', 'Sapporo 2026');
        await page.click('button:has-text("儲存設定")');
        await page.waitForTimeout(1000);

        // 3. Go back to dashboard
        await page.click('header button');
        await page.waitForTimeout(1000);

        // Verify it appears in the list
        const tripNamesText = await page.locator('.trip-grid').textContent();
        if (!tripNamesText.includes('Sapporo Snow Festival')) {
            throw new Error("Just-created trip not visible into Dashboard list.");
        }
        console.log("TEST 4 PASSED: Created Trip listed in Dashboard Vault.");

        console.log("ALL TESTS VALIDATED. Trip Namespace switching is robust and clean.");

    } catch (e) {
        console.error("Test Failed!", e);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
