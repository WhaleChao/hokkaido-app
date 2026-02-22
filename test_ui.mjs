import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    // Catch console errors
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));

    try {
        await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
        console.log("Navigated to app");
        
        // Ensure we are in the itinerary tab (should be default)
        
        // Wait for the tab placeholder or the itinerary view
        await page.waitForSelector('.itinerary-view', { timeout: 5000 }).catch(() => console.log("itinerary-view not found, maybe empty?"));
        
        // Wait a bit to ensure it's rendered
        await new Promise(r => setTimeout(r, 1000));

        // Let's check if the '編輯行程' button exists
        const editBtns = await page.$$('.btn-toggle-edit');
        if(editBtns.length === 0) {
            console.log("No toggle edit buttons found! Empty itinerary state active.");
            // We need to go to Nearby tab to set the config first to populate days
            // Let's find Nearby tab button (it's the 3rd one maybe? Maps icon or '周邊')
            const navButtons = await page.$$('.nav-btn');
            for(let b of navButtons) {
                const text = await page.evaluate(el => el.textContent, b);
                if (text && text.includes('周邊')) {
                    await b.click();
                    console.log("Clicked Nearby tab");
                    break;
                }
            }
            await new Promise(r => setTimeout(r, 1000));
            // Let's click "編輯旅程"
            const btnEdits = await page.$$('.btn-edit');
            for(let b of btnEdits) {
                const text = await page.evaluate(el => el.textContent, b);
                if (text && text.includes('編輯旅程')) {
                    await b.click();
                    console.log("Clicked Edit Trip Config");
                    break;
                }
            }
            
            await new Promise(r => setTimeout(r, 500));
            // Click "儲存設定"
            const saveBtns = await page.$$('.btn-save');
            for(let b of saveBtns) {
                const text = await page.evaluate(el => el.textContent, b);
                if (text && text.includes('儲存設定')) {
                    await b.click();
                    console.log("Clicked Save Trip Config to seed Initial DB");
                    break;
                }
            }
            await new Promise(r => setTimeout(r, 1000));
            
            // Go back to itinerary tab
            for(let b of navButtons) {
                const text = await page.evaluate(el => el.textContent, b);
                if (text && text.includes('行程')) {
                    await b.click();
                    console.log("Clicked Itinerary tab again");
                    break;
                }
            }
            await new Promise(r => setTimeout(r, 1000));
        }
        
        // 1. Click "編輯行程"
        console.log("Clicking '編輯行程'...");
        await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('.btn-toggle-edit'));
            const b = btns.find(el => el.textContent.includes('編輯行程'));
            if(b) b.click();
        });
        await new Promise(r => setTimeout(r, 500));

        // 2. Click "在這天新增景點"
        console.log("Clicking '在這天新增景點'...");
        await page.evaluate(() => {
            const btn = document.querySelector('.btn-add-attraction');
            if(btn) btn.click();
        });
        await new Promise(r => setTimeout(r, 500));
        
        // 3. Fill out the form
        console.log("Filling form...");
        await page.evaluate(() => {
            const inputs = document.querySelectorAll('input');
            if(inputs.length > 0) {
                inputs[0].value = 'Test Location';
                inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
        
        // 4. Click "儲存景點"
        console.log("Clicking '儲存景點'...");
        await page.evaluate(() => {
            const saveBtn = document.querySelector('.btn-submit');
            if(saveBtn) saveBtn.click();
        });
        await new Promise(r => setTimeout(r, 500));
        
        // 5. Click "完成編輯" (the 'Complete' button user had trouble with)
        console.log("Clicking '完成編輯'...");
        let success = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('.btn-toggle-edit'));
            const currentObj = btns.find(el => el.textContent.includes('完成編輯'));
            if(currentObj) {
                currentObj.click();
                return true;
            }
            return false;
        });
        
        if (success) {
            console.log("Successfully clicked '完成編輯'. Checked state.");
        } else {
            console.log("FAILED to find or click '完成編輯'.");
        }

    } catch (e) {
        console.error("Test failed:", e);
    } finally {
        await browser.close();
    }
})();
