
import puppeteer from 'puppeteer';

const CLUB_ID = process.env.CLUB_ID || 'liverpool';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const NEWS_ITEM_TITLE = 'Match Report';

export async function postNewsletter(summaryText, detailsHtml) {
    console.log("Starting Admin Login process...");
    const browser = await puppeteer.launch({
        headless: process.env.HEADLESS === 'true' ? "new" : false,
        defaultViewport: null,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
    await page.setViewport({ width: 1280, height: 800 });

    try {
        // 1. Login
        const loginUrl = `https://www.bridgewebs.com/cgi-bin/bwx/bw.cgi?pid=upload_menu&club=${CLUB_ID}`;
        console.log(`Navigating to ${loginUrl}`);
        await page.goto(loginUrl, { waitUntil: 'networkidle2' });

        const loginInput = await page.$('input[id="bridge_login"]');
        if (loginInput) {
            console.log("Login input found. Setting club ID...");
            await page.evaluate(el => el.value = '', loginInput);
            await loginInput.type(CLUB_ID, { delay: 100 });
        }

        const passwordInput = await page.$('input[id="bridge_password"]');
        if (passwordInput) {
            console.log("Password input found. Logging in...");
            await passwordInput.type(ADMIN_PASSWORD, { delay: 100 });
            await new Promise(r => setTimeout(r, 500));
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }),
                passwordInput.press('Enter')
            ]);
            console.log("Login navigation complete.");

            try {
                await page.waitForFunction(() => {
                    const links = Array.from(document.querySelectorAll('a'));
                    return links.some(a => a.innerText.includes('News'));
                }, { timeout: 20000 });
                console.log("Login Successful!");
            } catch (e) {
                throw new Error("Login failed.");
            }
        }

        // 2. Go to News List
        const listUrl = `https://www.bridgewebs.com/cgi-bin/bwx/bw.cgi?pid=upload_pages&wd=1&popt=list&club=${CLUB_ID}`;
        console.log(`Navigating to News List: ${listUrl}`);
        await page.goto(listUrl, { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 1000));

        // 3. Check if "Match Report" exists and get its ID
        console.log(`Looking for existing '${NEWS_ITEM_TITLE}'...`);

        const itemId = await page.evaluate((title) => {
            // Look for the onclick handler with the item ID
            // Pattern: pageGo ( 'item', '1770311823' )
            const html = document.body.innerHTML;
            const rows = Array.from(document.querySelectorAll('tr'));

            for (const row of rows) {
                if (row.innerText.includes(title)) {
                    // Find the onclick with pageGo and extract ID
                    const onclickEl = row.querySelector('[onclick*="pageGo"]');
                    if (onclickEl) {
                        const onclick = onclickEl.getAttribute('onclick');
                        const match = onclick.match(/pageGo\s*\(\s*'item'\s*,\s*'(\d+)'\s*\)/);
                        if (match) {
                            return match[1];
                        }
                    }
                }
            }
            return null;
        }, NEWS_ITEM_TITLE);

        if (itemId) {
            // Edit existing item - navigate directly to edit page
            console.log(`Found '${NEWS_ITEM_TITLE}' with ID ${itemId}. Opening editor...`);
            const editUrl = `https://www.bridgewebs.com/cgi-bin/bwx/bw.cgi?pid=upload_pages&wd=1&id=${itemId}&popt=item&club=${CLUB_ID}`;
            await page.goto(editUrl, { waitUntil: 'networkidle2' });
        } else {
            // Create new item
            console.log(`'${NEWS_ITEM_TITLE}' not found. Creating new item...`);

            await page.waitForFunction(() => {
                const divs = Array.from(document.querySelectorAll('div'));
                return divs.some(d => d.innerText.trim() === 'Add News Item');
            }, { timeout: 10000 });

            await page.evaluate(() => {
                const divs = Array.from(document.querySelectorAll('div'));
                const btn = divs.find(d => d.innerText.trim() === 'Add News Item');
                if (btn) btn.click();
            });

            console.log("Clicked 'Add News Item'. Waiting for editor...");
            await page.waitForNavigation({ waitUntil: 'networkidle2' });
        }

        // Wait for page to fully load
        await new Promise(r => setTimeout(r, 2000));

        // 4. Set Title (only for NEW items - existing ones keep their title)
        if (!itemId) {
            const titleSelector = 'input[name="pages_title"]';
            await page.waitForSelector(titleSelector, { timeout: 15000 });
            const titleInput = await page.$(titleSelector);
            await page.evaluate(el => el.value = '', titleInput);
            await titleInput.type(NEWS_ITEM_TITLE, { delay: 50 });
            console.log(`Set title to '${NEWS_ITEM_TITLE}'`);
        }

        // 5. Update Content
        console.log("Waiting for CKEditor...");

        const newHtml = `
            <details>
                <summary style="cursor: pointer; font-weight: bold; font-size: 1.1em; padding: 5px; background-color: #f0f0f0;">
                    ${summaryText}
                </summary>
                <div style="margin-top: 10px; padding: 10px; border: 1px solid #ddd;">
                    ${detailsHtml}
                </div>
            </details>
        `;

        // Wait for CKEditor to be ready
        await page.waitForFunction(() => {
            return typeof CKEDITOR !== 'undefined' &&
                CKEDITOR.instances &&
                CKEDITOR.instances.pages_detail &&
                CKEDITOR.instances.pages_detail.status === 'ready';
        }, { timeout: 20000 });

        console.log("CKEditor ready. Setting content...");

        const success = await page.evaluate((html) => {
            if (typeof CKEDITOR !== 'undefined' && CKEDITOR.instances.pages_detail) {
                CKEDITOR.instances.pages_detail.setData(html);
                return true;
            }
            return false;
        }, newHtml);

        if (!success) {
            throw new Error("Could not set CKEditor content.");
        }

        await new Promise(r => setTimeout(r, 500));

        // 6. Save
        console.log("Saving...");

        await page.waitForFunction(() => {
            const divs = Array.from(document.querySelectorAll('div'));
            return divs.some(d => d.innerText.trim() === 'Save');
        }, { timeout: 10000 });

        await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
            page.evaluate(() => {
                const divs = Array.from(document.querySelectorAll('div'));
                const btn = divs.find(d => d.innerText.trim() === 'Save');
                if (btn) btn.click();
            })
        ]);

        console.log("Update Posted Successfully!");

    } catch (err) {
        console.error("Error during posting:", err);
        await page.screenshot({ path: 'debug_post_failure.png' });
        throw err;
    } finally {
        await browser.close();
    }
}
