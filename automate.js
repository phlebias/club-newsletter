
import fs from 'fs';
import path from 'path';
import { getSessionData } from './scraper.js';
import { generateNewsletter } from './src/generator.js';
import { postNewsletter } from './src/poster.js';
import { saveReport } from './src/firestore.js';

/**
 * Automation script for Bridge Newsletter.
 * Designed to run at 3:00 AM on a NAS.
 */
async function runAuto() {
    console.log("[Auto] Script starting...");
    const today = process.env.TEST_DATE ? new Date(process.env.TEST_DATE) : new Date();
    const day = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday

    // Schedule Mapping (Run at 3:00 AM)
    // Tuesday (2): Look for Monday Evening
    // Wednesday (3): Look for Tuesday Afternoon
    // Thursday (4): Look for Wednesday Evening
    // Friday (5): Look for Thursday Afternoon

    let targetType = process.env.TEST_TYPE || '';
    let targetOffset = -1; // Days to go back

    if (process.env.TEST_MODE === 'true') {
        console.log("[Auto] Running in TEST MODE");
    }

    if (day === 2) { targetType = targetType || 'Evening'; targetOffset = -1; }
    else if (day === 3) { targetType = targetType || 'Afternoon'; targetOffset = -1; }
    else if (day === 4) { targetType = targetType || 'Evening'; targetOffset = -1; }
    else if (day === 5) { targetType = targetType || 'Afternoon'; targetOffset = -1; }
    else if (process.env.TEST_MODE !== 'true') {
        console.log("No session scheduled for today's run. Skipping.");
        process.exit(0);
    }

    const targetDateObj = new Date(today);
    targetDateObj.setDate(today.getDate() + targetOffset);

    // Skip the 2nd Monday of the month (Swiss Pairs), as the scraper is not set up for it.
    if (targetDateObj.getDay() === 1 && targetDateObj.getDate() >= 8 && targetDateObj.getDate() <= 14) {
        console.log("[Auto] Target date is the second Monday of the month (Swiss Pairs). Skipping execution.");
        process.exit(0);
    }

    const year = targetDateObj.getFullYear();
    const month = String(targetDateObj.getMonth() + 1).padStart(2, '0');
    const date = String(targetDateObj.getDate()).padStart(2, '0');
    const sessionDateString = `${year}${month}${date}`;

    console.log(`[Auto] Running for ${sessionDateString} (${targetType})`);

    try {
        const data = await getSessionData(sessionDateString, targetType);
        const html = generateNewsletter(data);

        const NAS_DIR = process.env.REPORT_DIR || './reports';
        if (!fs.existsSync(NAS_DIR)) {
            fs.mkdirSync(NAS_DIR, { recursive: true });
        }

        const filename = `newsletter_${sessionDateString}_${targetType.toLowerCase()}.html`;
        const filePath = path.join(NAS_DIR, filename);
        const latestPath = path.join(NAS_DIR, 'latest.html');

        fs.writeFileSync(filePath, html);
        fs.writeFileSync(latestPath, html);

        console.log(`[Auto] Success! Report saved to ${filePath}`);
        console.log(`[Auto] Updated latest.html`);

        // Save to Firestore for Rolling 5
        try {
            const reportData = {
                ...data,
                sessionDate: sessionDateString,
                targetType: targetType,
                html: html
            };
            await saveReport(reportData);
        } catch (dbErr) {
            console.error(`[Auto] Firestore Error: ${dbErr.message}`);
            // Don't fail the whole run if Firestore fails, but log it
        }

        // Post to BridgeWebs website
        console.log(`[Auto] Posting to BridgeWebs...`);
        const summaryText = `📊 ${data.eventInfo.text} - Match Report`;
        await postNewsletter(summaryText, html);
        console.log(`[Auto] Posted to website successfully.`);

    } catch (err) {
        if (err.name === 'NoResultsError') {
            console.log(`[Auto] Graceful Handling: ${err.message}`);

            // Generate a 'Results Pending' placeholder newsletter
            const placeholderData = {
                eventInfo: err.eventInfo || { text: `${targetType} Session - ${sessionDateString}` },
                rankings: [],
                boards: [],
                scorecards: []
            };

            const html = generateNewsletter(placeholderData);
            const NAS_DIR = process.env.REPORT_DIR || './reports';
            const latestPath = path.join(NAS_DIR, 'latest.html');

            try {
                fs.writeFileSync(latestPath, html);
                console.log(`[Auto] Updated latest.html with 'Pending' placeholder.`);
                process.exit(0); // Success, even if results were pending
            } catch (fsErr) {
                console.error(`[Auto] Failed to write placeholder: ${fsErr.message}`);
                process.exit(1);
            }
        }

        if (err.message?.includes('ERR_NAME_NOT_RESOLVED')) {
            console.error(`[Auto] Network/DNS Error: Could not resolve bridgewebs host. ${err.message}`);
            process.exit(1);
        }

        if (err.message?.includes('ERR_INTERNET_DISCONNECTED')) {
            console.error(`[Auto] Network Error: Internet connection appears to be down. ${err.message}`);
            process.exit(1);
        }

        console.error(`[Auto] Fatal Error: ${err.message}`);
        process.exit(1);
    }
}

runAuto();
