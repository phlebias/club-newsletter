
import { postNewsletter } from '../src/poster.js';

async function runTest() {
    const label = process.argv[2] || 'test1';
    try {
        console.log(`Running Test Post with label: ${label}...`);
        await postNewsletter(
            `Test Update - ${label} - ${new Date().toISOString()}`,
            `<p>This is test content for: <strong>${label}</strong></p>`
        );
        console.log("Test Complete.");
    } catch (e) {
        console.error("Test Failed:", e);
        process.exit(1);
    }
}

runTest();
