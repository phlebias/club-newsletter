import fs from 'fs';
import path from 'path';
import { getSessionData } from './scraper.js';
import { generateNewsletter } from './src/generator.js';

/**
 * SIMULATED TEST - Does NOT post to website
 * Tests the scraping and newsletter generation without actually posting
 */
async function runSimulatedTest() {
    console.log("=".repeat(60));
    console.log("SIMULATED TEST MODE - NO ACTUAL POSTING");
    console.log("=".repeat(60));

    const today = process.env.TEST_DATE ? new Date(process.env.TEST_DATE) : new Date();
    const day = today.getDay();

    let targetType = process.env.TEST_TYPE || '';
    let targetOffset = -1;

    if (day === 2) { targetType = targetType || 'Evening'; targetOffset = -1; }
    else if (day === 3) { targetType = targetType || 'Afternoon'; targetOffset = -1; }
    else if (day === 4) { targetType = targetType || 'Evening'; targetOffset = -1; }
    else if (day === 5) { targetType = targetType || 'Afternoon'; targetOffset = -1; }

    const targetDateObj = new Date(today);
    targetDateObj.setDate(today.getDate() + targetOffset);

    const year = targetDateObj.getFullYear();
    const month = String(targetDateObj.getMonth() + 1).padStart(2, '0');
    const date = String(targetDateObj.getDate()).padStart(2, '0');
    const sessionDateString = `${year}${month}${date}`;

    console.log(`\n📅 Target Session: ${sessionDateString} (${targetType})`);
    console.log(`🔍 Scraping data from BridgeWebs...`);

    try {
        // Step 1: Scrape data
        console.log("\n" + "=".repeat(60));
        console.log("STEP 1: SCRAPING SESSION DATA");
        console.log("=".repeat(60));
        const data = await getSessionData(sessionDateString, targetType);

        console.log(`✅ Successfully scraped session data`);
        console.log(`   Event: ${data.eventInfo.text}`);
        console.log(`   Rankings: ${data.rankings.length} pairs`);
        console.log(`   Boards: ${data.boards.length} boards`);
        console.log(`   Scorecards: ${data.scorecards.length} scorecards`);

        // Step 2: Generate newsletter
        console.log("\n" + "=".repeat(60));
        console.log("STEP 2: GENERATING NEWSLETTER HTML");
        console.log("=".repeat(60));
        const html = generateNewsletter(data);
        console.log(`✅ Newsletter generated (${html.length} characters)`);

        // Step 3: Save to file
        console.log("\n" + "=".repeat(60));
        console.log("STEP 3: SAVING TO FILE");
        console.log("=".repeat(60));
        const NAS_DIR = process.env.REPORT_DIR || './reports';
        if (!fs.existsSync(NAS_DIR)) {
            fs.mkdirSync(NAS_DIR, { recursive: true });
        }

        const filename = `newsletter_${sessionDateString}_${targetType.toLowerCase()}_SIMULATED.html`;
        const filePath = path.join(NAS_DIR, filename);
        const latestPath = path.join(NAS_DIR, 'latest_simulated.html');

        fs.writeFileSync(filePath, html);
        fs.writeFileSync(latestPath, html);

        console.log(`✅ Saved to: ${filePath}`);
        console.log(`✅ Updated: ${latestPath}`);

        // Step 4: Simulate posting (without actually posting)
        console.log("\n" + "=".repeat(60));
        console.log("STEP 4: SIMULATED POSTING (NOT ACTUALLY POSTING)");
        console.log("=".repeat(60));
        const summaryText = `📊 ${data.eventInfo.text} - Match Report`;
        console.log(`📝 Summary Text: ${summaryText}`);
        console.log(`📄 HTML Length: ${html.length} characters`);
        console.log(`🚫 SKIPPING ACTUAL POST TO WEBSITE (Simulated Mode)`);

        // Summary
        console.log("\n" + "=".repeat(60));
        console.log("✅ SIMULATION COMPLETE - ALL STEPS SUCCESSFUL");
        console.log("=".repeat(60));
        console.log(`\n📊 Summary:`);
        console.log(`   - Data scraped successfully`);
        console.log(`   - Newsletter generated successfully`);
        console.log(`   - Files saved to ${NAS_DIR}`);
        console.log(`   - NO actual posting to website (simulated mode)`);
        console.log(`\n💡 To view the newsletter, open: ${latestPath}`);
        console.log(`\n⚠️  This was a SIMULATED test. No changes were made to the website.`);

    } catch (err) {
        console.error("\n" + "=".repeat(60));
        console.error("❌ ERROR OCCURRED");
        console.error("=".repeat(60));

        if (err.name === 'NoResultsError') {
            console.log(`⚠️  No results found: ${err.message}`);
        } else {
            console.error(`❌ Fatal Error: ${err.message}`);
            console.error(`\n📋 Error Details:`);
            console.error(err.stack);
        }

        process.exit(1);
    }
}

runSimulatedTest();
