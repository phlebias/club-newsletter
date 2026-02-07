
import puppeteer from 'puppeteer';

const CLUB_ID = 'liverpool';
const ADMIN_PASSWORD = 'Trump7!';

async function debugLogin() {
    console.log("Launching Browser for VISUAL DEBUGGING...");
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    try {
        const loginUrl = `https://www.bridgewebs.com/cgi-bin/bwor/bw.cgi?club=${CLUB_ID}&pid=admin`;
        console.log(`Navigating to ${loginUrl}`);
        await page.goto(loginUrl, { waitUntil: 'networkidle2' });

        console.log("Waiting 3 seconds before acting...");
        await new Promise(r => setTimeout(r, 3000));

        // CLUB CODE
        const loginInput = await page.$('input[name="bridge_login"]');
        if (loginInput) {
            const currentVal = await page.evaluate(el => el.value, loginInput);
            console.log(`Current Club Code: '${currentVal}'`);

            // Only type if empty or wrong
            if (currentVal !== CLUB_ID) {
                console.log("Updating Club Code...");
                await page.evaluate(el => el.value = '', loginInput);
                await loginInput.type(CLUB_ID, { delay: 100 });
            } else {
                console.log("Club Code is already correct. Skipping typing.");
            }
        }

        // PASSWORD
        const passwordInput = await page.$('input[name="bridge_password"]');
        if (passwordInput) {
            console.log("Typing Password...");
            await passwordInput.click(); // Focus
            await new Promise(r => setTimeout(r, 500));
            await passwordInput.type(ADMIN_PASSWORD, { delay: 150 });
        }

        console.log("Waiting 2 seconds before clicking Login...");
        await new Promise(r => setTimeout(r, 2000));

        // CLICK LOGIN
        const loginBtn = await page.$('button[name="bridge_button"]');
        if (loginBtn) {
            console.log("Clicking Login Button...");
            await loginBtn.click();
        } else {
            console.error("Login button not found!");
        }

        console.log("--- WAITING 60 SECONDS ---");
        console.log("Please look at the browser window.");
        console.log("Do you see an error message? ('Invalid Password', etc)");
        console.log("Did it log in successfully?");

        await new Promise(r => setTimeout(r, 60000));

    } catch (err) {
        console.error("Debug Script Error:", err);
    } finally {
        await browser.close();
    }
}

debugLogin();
