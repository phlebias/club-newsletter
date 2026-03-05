
import "dotenv/config";
import { getSessionData } from './scraper.js';
import fs from 'fs';

async function test() {
    try {
        console.log("Starting scrape for latest session...");
        const data = await getSessionData();
        fs.writeFileSync('latest_session_data.json', JSON.stringify(data, null, 2));
        console.log("Data saved to latest_session_data.json");
    } catch (err) {
        console.error("Scrape failed:", err);
    }
}

test();
