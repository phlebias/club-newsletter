import { launchBrowser } from "./chrome.js";
import { loadConfig, buildCaptureLabel } from "./config.js";
import { runCapture } from "./capture.js";
import { runRecoverDownload } from "./recover.js";
import { generateRecoverReport } from "./report.js";
import path from "path";

function parseArgs(argv) {
    const args = new Set(argv.slice(2));
    return {
        capture: args.has("--capture") || args.size === 0,
        recover: args.has("--recover"),
        report: args.has("--report"),
    };
}

async function main() {
    const args = parseArgs(process.argv);
    const config = loadConfig();

    if (!args.capture && !args.recover && !args.report) {
        console.log("Nothing to do. Use --capture.");
        return;
    }

    const captureLabel = buildCaptureLabel(config);

    if (args.report) {
        if (!config.eventId) {
            throw new Error("Report generation requires EVENT_ID.");
        }

        const recoverDir = path.resolve(`experiments/admin-export/fixtures/raw/${captureLabel}_recover/downloads`);
        const xmlPath = path.join(recoverDir, `${config.eventId}_xml.xml`);
        const pbnPath = path.join(recoverDir, `${config.eventId}_pbn.pbn`);
        const outPath = path.resolve(`experiments/admin-export/reports/${config.eventId}_recover_report.html`);

        const result = generateRecoverReport({ xmlPath, pbnPath, outPath });
        console.log("Admin recover report complete.");
        console.log(JSON.stringify(result, null, 2));
        return;
    }

    const browser = await launchBrowser();
    try {
        if (args.recover) {
            const result = await runRecoverDownload({ browser, config, captureLabel });
            console.log("Admin recover download complete.");
            console.log(JSON.stringify({
                captureLabel: result.captureLabel,
                eventId: result.eventId,
                downloadCount: result.downloads.filter((item) => item.ok).length,
                downloadDir: result.downloads.find((item) => item.ok)?.path
                    ? result.downloads.find((item) => item.ok).path.replace(/\/[^/]+$/, "")
                    : null,
            }, null, 2));
            return;
        }

        const result = await runCapture({ browser, config, captureLabel });
        console.log("Admin export capture complete.");
        console.log(JSON.stringify({
            captureLabel: result.captureLabel,
            exportCount: result.exports.length,
            lastUrl: result.navigation[result.navigation.length - 1]?.url || null,
        }, null, 2));
    } finally {
        await browser.close();
    }
}

main().catch((err) => {
    console.error("Admin export prototype failed:", err.message);
    process.exitCode = 1;
});
