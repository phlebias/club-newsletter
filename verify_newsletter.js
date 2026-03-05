
import "dotenv/config";
import { generateNewsletter } from './src/generator.js';
import fs from 'fs';

async function verify() {
    try {
        const data = JSON.parse(fs.readFileSync('latest_session_data.json', 'utf8'));
        const html = generateNewsletter(data);
        fs.writeFileSync('verification_newsletter.html', html);
        console.log("Newsletter generated in verification_newsletter.html");
    } catch (err) {
        console.error("Verification failed:", err);
    }
}

verify();
