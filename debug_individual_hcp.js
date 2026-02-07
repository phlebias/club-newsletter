
import { getSessionData } from './scraper.js';
import puppeteer from 'puppeteer';
import fs from 'fs';

async function testScorecard() {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Use a known event URL or navigate
    // Let's use the archive link found previously:
    // https://www.bridgewebs.com/cgi-bin/bwor/bw.cgi?club=liverpool&pid=display_rank&event=20260120_1
    // And try to click a pair.
    // Or construct a scorecard URL directly.
    // Scorecard URL pattern: ...&pid=display_scor&event=20260120_1&pair=1

    // Using the 20th Jan Tuesday Afternoon event
    const eventId = '20260120_1';
    const clubId = 'liverpool';
    const pairId = '1'; // Test Pair 1

    const url = `https://www.bridgewebs.com/cgi-bin/bwor/bw.cgi?club=${clubId}&pid=display_scor&event=${eventId}&session=1&pair=${pairId}`;

    console.log("Navigating to scorecard:", url);
    await page.goto(url, { waitUntil: 'networkidle0' });

    // Dump HTML
    const html = await page.content();
    fs.writeFileSync('debug_scorecard_pair1.html', html);

    // Take screenshot
    await page.screenshot({ path: 'debug_scorecard_pair1.png' });

    // Try to extract Names and HCP
    // Usually names are in header: "Score Card for John Smith & Jane Doe (Pair 1)"
    // Or in separate fields "North: ... South: ..."
    // HCP might be in the table columns.

    const data = await page.evaluate(() => {
        const bodyText = document.body.innerText;
        const tables = Array.from(document.querySelectorAll('table'));

        let nName = "", sName = "";
        // Look for "North" and "South" labels

        // Return table headers and rows sample
        const tableSamples = tables.map((t, i) => {
            const rows = Array.from(t.rows);
            if (rows.length < 2) return null;
            return {
                index: i,
                header: rows[0].innerText,
                row1: rows[1] ? rows[1].innerText : "N/A"
            };
        }).filter(Boolean);

        return {
            title: document.title,
            bodyPreview: bodyText.slice(0, 500),
            tables: tableSamples
        };
    });

    console.log("Extracted Data:", JSON.stringify(data, null, 2));

    await browser.close();
}

testScorecard();
