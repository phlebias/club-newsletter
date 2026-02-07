
import { getSessionData } from './scraper.js';

async function test() {
    try {
        console.log("Testing scraper for 2026-01-20 Tuesday Afternoon...");
        const data = await getSessionData('20260120', 'Afternoon');
        console.log("Scrape complete.");
        console.log("Rankings found:", data.rankings?.length);
        console.log("Boards found:", data.boards?.length);

        if (!data.rankings || data.rankings.length === 0) {
            console.log("FAILURE: No rankings found.");
        }

        if (!data.boards || data.boards.length === 0) {
            console.log("FAILURE: No boards found.");
        }

    } catch (err) {
        console.error("Scraper error:", err);
    }
}

test();
