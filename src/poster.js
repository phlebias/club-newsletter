
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getLatestReports } from './firestore.js';

const CLUB_ID = 'liverpool';
const ADMIN_PASSWORD = 'Trump7!';
const NEWS_ITEM_TITLE = 'Match Report';

/**
 * Find the Chrome executable path for the current platform.
 */
function findChromePath() {
    try {
        const detected = puppeteer.executablePath();
        if (detected && fs.existsSync(detected)) {
            console.log(`Using Chrome at: ${detected}`);
            return detected;
        }
    } catch (e) { /* fall through */ }

    const platform = os.platform();
    const candidates = platform === 'darwin'
        ? [
            '/Users/billburrows/.puppeteer-cache/chrome/mac_arm-144.0.7559.96/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          ]
        : [
            `${os.homedir()}/.cache/puppeteer/chrome/linux-144.0.7559.96/chrome-linux64/chrome`,
            '/usr/bin/google-chrome',
            '/usr/bin/chromium-browser',
          ];

    for (const p of candidates) {
        if (fs.existsSync(p)) {
            console.log(`Using Chrome at: ${p}`);
            return p;
        }
    }
    return undefined;
}

export async function postNewsletter(summaryText, detailsHtml) {
    console.log("Starting Admin Login process...");
    const chromePath = findChromePath();
    const launchOptions = {
        headless: "new",
        defaultViewport: null,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    };
    if (chromePath) launchOptions.executablePath = chromePath;
    const browser = await puppeteer.launch(launchOptions);
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
        console.log(`Looking for existing '${NEWS_ITEM_TITLE}' items...`);
        
        const foundItems = await page.evaluate((title) => {
            const rows = Array.from(document.querySelectorAll('tr'));
            const matches = [];
            for (const row of rows) {
                if (row.innerText.includes(title)) {
                    const onclickEl = row.querySelector('[onclick*="pageGo"]');
                    if (onclickEl) {
                        const onclick = onclickEl.getAttribute('onclick');
                        const match = onclick.match(/pageGo\s*\(\s*'item'\s*,\s*'(\d+)'\s*\)/);
                        if (match) {
                            matches.push({ title: row.innerText.trim().split('\n')[0], id: match[1] });
                        }
                    }
                }
            }
            return matches;
        }, NEWS_ITEM_TITLE);

        console.log("Found Match Report items:", JSON.stringify(foundItems, null, 2));

        let itemId = null;
        if (foundItems.length > 0) {
            // Take the first one for now, but log if there are more
            itemId = foundItems[0].id;
            if (foundItems.length > 1) {
                console.warn(`WARNING: Found ${foundItems.length} items with title '${NEWS_ITEM_TITLE}'!`);
            }
            console.log(`Opening editor for ID ${itemId}...`);
            const editUrl = `https://www.bridgewebs.com/cgi-bin/bwx/bw.cgi?pid=upload_pages&wd=1&id=${itemId}&popt=item&club=${CLUB_ID}`;
            await page.goto(editUrl, { waitUntil: 'networkidle2' });
        } else {
            console.log(`'${NEWS_ITEM_TITLE}' not found. Creating new item...`);
            await page.evaluate(() => {
                const divs = Array.from(document.querySelectorAll('div'));
                const btn = divs.find(d => d.innerText.trim() === 'Add News Item');
                if (btn) btn.click();
            });
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

        const latestReports = await getLatestReports();
        console.log(`[Poster] Building multi-report HTML for ${latestReports.length} reports...`);

        // Find shuffle.mp3 in possible locations
        const possiblePaths = [
            path.join(process.cwd(), 'public', 'audio', 'shuffle.mp3'),
            path.join(process.cwd(), 'shuffle.mp3'),
            path.resolve('shuffle.mp3')
        ];
        
        let mp3Path = null;
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                mp3Path = p;
                console.log(`[Poster] Found shuffle.mp3 at: ${p}`);
                break;
            }
        }

        let audioSrc = '';
        if (mp3Path) {
            try {
                const audioBuffer = fs.readFileSync(mp3Path);
                audioSrc = `data:audio/mp3;base64,${audioBuffer.toString('base64')}`;
            } catch (e) {
                console.error('Error reading shuffle.mp3:', e);
            }
        } else {
            console.warn('[Poster] shuffle.mp3 not found in any of the expected locations:', possiblePaths);
        }

        // Build the nested details for each report
        const reportsHtml = latestReports.map((report, index) => {
            const isLatest = index === 0;
            const reportDateRaw = report.sessionDate || '00000000';
            const reportType = report.targetType || 'Session';
            
            // Reformat YYYYMMDD to DD-MM-YYYY
            const day = reportDateRaw.slice(6, 8);
            const month = reportDateRaw.slice(4, 6);
            const year = reportDateRaw.slice(0, 4);
            const formattedDate = `${day}-${month}-${year}`;
            
            const title = `📊 ${reportType} Session - ${formattedDate}`;
            
            return `
                <details style="margin-bottom: 15px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                    <summary 
                        style="cursor: pointer; font-weight: bold; font-size: 1.1em; padding: 12px 15px; background-color: ${isLatest ? '#f8fafc' : '#ffffff'}; border-bottom: ${isLatest ? '1px solid #e2e8f0' : 'none'}; list-style: none; display: flex; align-items: center; justify-content: space-between;"
                        onclick="this.getElementsByTagName('audio')[0]?.play()"
                    >
                        <span>${title} ${isLatest ? '<span style="color: #fbbf24; font-size: 0.8em; margin-left: 10px;">[NEWEST]</span>' : ''}</span>
                        <audio src="${audioSrc}" preload="auto" style="display:none;"></audio>
                    </summary>
                    <div style="background-color: #1e293b; padding: 0;">
                        ${report.html}
                    </div>
                </details>
            `;
        }).join('');

        const newHtml = `
            <div style="font-family: 'Inter', system-ui, sans-serif; max-width: 900px; margin: 0 auto;">
                <h3 style="margin-bottom: 20px; color: #1e293b; border-bottom: 2px solid #fbbf24; padding-bottom: 8px;">Latest Match Reports</h3>
                ${reportsHtml}
                <p style="font-size: 0.85em; color: #64748b; margin-top: 20px; text-align: center;">
                    Showing the last ${latestReports.length} reports. Click the results box above for full detail
                </p>
            </div>
        `;

        // 5. Wait for editor (CKEditor or plain Textarea)
        console.log("Waiting for editor to be ready...");
        await page.waitForFunction(() => {
            const ckready = typeof CKEDITOR !== 'undefined' &&
                CKEDITOR.instances &&
                CKEDITOR.instances.pages_detail &&
                CKEDITOR.instances.pages_detail.status === 'ready';
            const textarea = document.querySelector('textarea[name="pages_detail"]');
            return ckready || !!textarea;
        }, { timeout: 30000 });

        console.log("CKEditor ready. Setting content...");

        const success = await page.evaluate((html) => {
            if (typeof CKEDITOR !== 'undefined' && CKEDITOR.instances.pages_detail) {
                console.log("Using CKEditor...");
                // Attempt to disable content filtering to allow onclick
                try {
                    CKEDITOR.config.allowedContent = true;
                    CKEDITOR.instances.pages_detail.config.allowedContent = true;
                } catch (e) { console.log("Could not set allowedContent", e); }

                CKEDITOR.instances.pages_detail.setData(html);
                return true;
            } else {
                console.log("CKEditor not found, using plain textarea...");
                const textarea = document.querySelector('textarea[name="pages_detail"]');
                if (textarea) {
                    textarea.value = html;
                    return true;
                }
            }
            return false;
        }, newHtml);

        if (!success) {
            throw new Error("Could not set CKEditor content.");
        }

        await new Promise(r => setTimeout(r, 1000));
        await page.screenshot({ path: 'debug_news_editor.png' });
        console.log("Screenshot saved as debug_news_editor.png");

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
