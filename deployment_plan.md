# Deployment and Automation Plan for Bridge Newsletter

This plan outlines the steps to deploy your bridge newsletter generator to your NAS, automate it to run daily at 3:00 AM, and post the results to the BridgeWebs club website.

## 1. Prerequisites (NAS Setup)

Since you are copying the project to your NAS, ensure the following are installed on it:
*   **Node.js (v18+)**: Required to run the scripts.
*   **Chromium/Chrome**: Required for Puppeteer. Note: On some NAS (like Synology or QNAP Linux), you may need to install Chromium specifically or use a Docker container.
*   **Permissions**: Ensure the script has write access to the directory to save reports.

## 2. New Component: `poster.js` (The Web Admin Poster)

We need a new script to handle the login and posting process. This script will be integrated into the main automation flow.

**Logic Plan:**
1.  **Launch Browser**: Use Puppeteer (similar to the scraper).
2.  **Login**:
    *   Navigate to `https://www.bridgewebs.com/cgi-bin/bwor/bw.cgi?club=liverpool&pid=admin`.
    *   Enter the password (`Trump7!`) into the password field.
    *   Click "Login".
3.  **Navigate to News**:
    *   Find the "News" tab or link in the admin panel and click it.
4.  **Edit Session Report**:
    *   Search for an existing News Item with the header/title **"Session Report"**.
    *   Click "Edit" (pencil icon or link).
5.  **Update Content**:
    *   Switch the editor to "Source" mode (if applicable) or set the value of the main content textarea.
    *   **Content Formatting**: To meet the "click for more details" requirement, we will wrap the generated newsletter HTML in a `<details>` tag:
        ```html
        <details>
           <summary style="font-size: 1.25rem; font-weight: bold; cursor: pointer; padding: 10px; background-color: #fbbf24; color: #000; border-radius: 5px;">
              CLICK HERE for the latest Session Report
           </summary>
           <!-- Generated Newsletter HTML goes here -->
           [CONTENT]
        </details>
        ```
    *   The previous report is naturally "deleted" and replaced because we are editing the existing persistent "Session Report" news item rather than creating a new one.
6.  **Save**: Click the "Save" button.

## 3. Modify `automate.js`

We will update the `runAuto()` function in `automate.js` to:
1.  Generate the newsletter as normal.
2.  If generation is successful, call the new `postNewsletter(html)` function from `poster.js`.
3.  Log the success or failure of the posting step.

## 4. Scheduling (Cron Job)

To run this daily at 3:00 AM, you will use the system's `cron` daemon.

**Command to add to crontab:**
```bash
0 3 * * * cd /path/to/club-newsletter && /usr/local/bin/node automate.js >> /path/to/club-newsletter/logs.txt 2>&1
```

---

## Proposed Code for `src/poster.js`

You do not need to implement this yet, but here is the blueprint for the script we will create.

```javascript
/* src/poster.js Blueprint */
import puppeteer from 'puppeteer';

export async function postNewsletter(htmlContent) {
    const browser = await puppeteer.launch({ headless: true }); // Headless for NAS
    const page = await browser.newPage();

    try {
        // 1. Login
        await page.goto('https://www.bridgewebs.com/cgi-bin/bwor/bw.cgi?club=liverpool&pid=admin');
        await page.type('input[name="password"]', 'Trump7!'); // Selector to be verified
        await page.click('input[value="Login"]'); // Selector to be verified
        await page.waitForNavigation();

        // 2. Navigate to News
        // (We might need to search for the specific "News" link text)
        const newsLink = await page.$x("//a[contains(text(), 'News')]");
        if (newsLink.length > 0) {
            await newsLink[0].click();
            await page.waitForNavigation();
        }

        // 3. Find "Session Report" item and Edit
        // We look for a row containing "Session Report" and find the Edit link/button
        // ... Implementation details depend on exact HTML structure ...

        // 4. Update Content
        // We construct the HTML with the <details> wrapper
        const wrappedContent = `
            <details open="open"> <!-- Optional: start open if preferred, or closed -->
                <summary style="font-size: 1.2em; font-weight: bold; padding: 10px; background: #eee; cursor: pointer;">
                    Latest Session Report (Click to View)
                </summary>
                ${htmlContent}
            </details>
        `;
        
        // Inject into the textarea (requires identifying the textarea ID or Name)
        await page.$eval('textarea[name="news_body"]', (el, content) => el.value = content, wrappedContent);

        // 5. Save
        await page.click('input[value="Save"]');
        await page.waitForNavigation();
        
        console.log("Post successful!");

    } catch (e) {
        console.error("Posting failed:", e);
    } finally {
        await browser.close();
    }
}
```

## Next Steps
1.  **Approval**: Confirm if this plan aligns with your NAS environment and expectations.
2.  **Implementation**: I will write the actual `src/poster.js` and modify `automate.js`.
3.  **Testing**: We can test the posting script locally first (running it manually) to ensure it handles the login and navigation correctly before moving to the NAS.
