import { chromium } from 'playwright';

(async () => {
    console.log("Starting Phase 9 Integration Test...");
    const browser = await chromium.launch({ headless: true });
    
    try {
        const page = await browser.newPage();
        await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
        
        // Wait for legacy DB migration or dashboard
        await page.waitForTimeout(1000);

        // Enter a trip if we are in Dashboard
        const isDashboard = await page.locator('h1:has-text("我的行程庫")').isVisible();
        if (isDashboard) {
            // Click the first card
            await page.click('.address-card');
            await page.waitForTimeout(500);
        }

        // Test 1: Expense Tracker
        console.log("Testing Expense Tracker...");
        await page.click('button:has-text("記帳")');
        await page.waitForTimeout(500);
        await page.click('button:has-text("記一筆帳")');
        
        // Fill out Expense
        await page.fill('input[type="number"]', '5000');
        await page.fill('input[placeholder="如：晚餐拉麵、免稅藥妝"]', 'Sapporo Beer');
        // Let's change the category to 飲食 normally, it defaults to that but we can select another
        await page.selectOption('select', '購物');
        await page.click('button:has-text("儲存紀錄")');
        await page.waitForTimeout(1000);

        const expenseText = await page.locator('.expense-view').textContent();
        if (!expenseText.includes('Sapporo Beer') || !expenseText.includes('5,000')) {
            throw new Error("Expense Tracker did not save or strictly render the record.");
        }
        console.log("TEST 1 PASSED: Expense Tracker (Added Sapporo Beer).");

        // Test 2: Packing Checklist
        console.log("Testing Packing Checklist...");
        await page.click('button:has-text("清單")');
        await page.waitForTimeout(500);

        // Check if pre-seeded DB loaded
        const checklistText = await page.locator('.checklist-view').textContent();
        if (!checklistText.includes('護照')) {
             throw new Error("Packing Checklist did not pre-seed defaults correctly.");
        }

        // Add a new item
        await page.fill('input[placeholder="輸入新物品..."]', 'Nintendo Switch');
        
        // Target the precise button
        await page.click('.btn-add-checklist-item');
        await page.waitForTimeout(1000);

        const newChecklistText = await page.locator('.checklist-view').textContent();
        if (!newChecklistText.includes('Nintendo Switch')) {
            throw new Error("Packing Checklist failed to organically add items.");
        }
        console.log("TEST 2 PASSED: Packing Checklist is dynamic and seeded (Added Nintendo Switch).");

        // Test 3: Duration / Overpack Logic
        console.log("Testing Duration Schedule Engine...");
        await page.click('button:has-text("行程")');
        await page.waitForTimeout(500);
        
        // Click edit toggle (it's the button with the label 編輯行程)
        await page.click('button:has-text("編輯行程")');
        await page.waitForTimeout(500);
        
        await page.click('button:has-text("在這天新增景點")');
        await page.waitForTimeout(500);

        // Fill an attraction with 8 hours
        await page.fill('.add-attraction-form input[type="text"]', 'Universal Studios');
        // select option with value "480"
        await page.selectOption('.add-attraction-form select[style*="width: 100%"]', '480'); 
        await page.click('button:has-text("確定新增")');
        await page.waitForTimeout(500);

        // Add another 8 hour one to trigger Overpack
        await page.click('button:has-text("在這天新增景點")');
        await page.waitForTimeout(500);
        await page.fill('.add-attraction-form input[type="text"]', 'Disney Sea');
        await page.selectOption('.add-attraction-form select[style*="width: 100%"]', '480'); // 8 hours
        await page.click('button:has-text("確定新增")');
        await page.waitForTimeout(1000);

        // Finish edit
        await page.click('button:has-text("完成編輯")');
        await page.waitForTimeout(500);

        const itineraryText = await page.locator('.itinerary-view').textContent();
        if (!itineraryText.includes('超過 12 小時') && !itineraryText.includes('警告')) {
             throw new Error("Overpacking safety boundaries did not visually alert the user.");
        }
        console.log("TEST 3 PASSED: Mathematical overpack warning works perfectly (16 Hours Logged).");

        console.log("===============");
        console.log("PHASE 9 CLEARED");
        console.log("===============");

    } catch (e) {
        console.error("Test Failed!", e);
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
