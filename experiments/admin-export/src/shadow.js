import fs from "fs";
import path from "path";
import { launchBrowser } from "./chrome.js";
import { runRecoverDownload } from "./recover.js";
import { generateRecoverReport } from "./report.js";

function normalizeValue(value) {
    return typeof value === "string" ? value.trim() : "";
}

function loadDotEnv() {
    const envPath = path.resolve("experiments/admin-export/.env");
    if (!fs.existsSync(envPath)) {
        return;
    }

    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) {
            continue;
        }

        const eqIndex = trimmed.indexOf("=");
        if (eqIndex === -1) {
            continue;
        }

        const key = trimmed.slice(0, eqIndex).trim();
        const rawValue = trimmed.slice(eqIndex + 1).trim();
        const value = rawValue.replace(/^['"]|['"]$/g, "");

        if (!(key in process.env)) {
            process.env[key] = value;
        }
    }
}

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function buildShadowFilename(sessionDateString, targetType) {
    return `newsletter_${sessionDateString}_${targetType.toLowerCase()}_recover_shadow.html`;
}

export function shouldRunRecoverShadow() {
    return normalizeValue(process.env.ENABLE_RECOVER_SHADOW).toLowerCase() === "true";
}

export async function generateRecoverShadowReport({ eventId, sessionDateString, targetType, reportDir }) {
    loadDotEnv();

    const adminPassword = normalizeValue(process.env.BRIDGEWEBS_ADMIN_PASSWORD);
    if (!adminPassword) {
        throw new Error("Missing BRIDGEWEBS_ADMIN_PASSWORD for recover shadow mode.");
    }

    if (!eventId) {
        throw new Error("Recover shadow mode requires a concrete eventId from the primary scrape.");
    }

    const config = {
        clubId: normalizeValue(process.env.BRIDGEWEBS_CLUB_ID) || "liverpool",
        adminUser: normalizeValue(process.env.BRIDGEWEBS_ADMIN_USER) || "liverpool",
        adminPassword,
        eventId,
        sessionDate: sessionDateString,
        sessionType: targetType,
        recoverUrl: normalizeValue(process.env.BRIDGEWEBS_RECOVER_URL),
        captureRoot: path.resolve("experiments/admin-export/fixtures/raw"),
    };

    const captureLabel = eventId;
    const shadowDir = path.join(reportDir, "shadow");
    const outPath = path.join(shadowDir, buildShadowFilename(sessionDateString, targetType));

    ensureDir(shadowDir);

    const browser = await launchBrowser();
    try {
        const metadata = await runRecoverDownload({ browser, config, captureLabel });
        const downloadDir = path.join(config.captureRoot, `${captureLabel}_recover`, "downloads");
        const xmlPath = path.join(downloadDir, `${config.eventId}_xml.xml`);
        const pbnPath = path.join(downloadDir, `${config.eventId}_pbn.pbn`);
        const report = generateRecoverReport({ xmlPath, pbnPath, outPath });

        return {
            outPath,
            metadataPath: path.join(config.captureRoot, `${captureLabel}_recover`, "recover-metadata.json"),
            downloads: metadata.downloads,
            report,
        };
    } finally {
        await browser.close();
    }
}
