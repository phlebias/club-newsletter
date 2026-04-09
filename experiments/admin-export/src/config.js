import fs from "fs";
import path from "path";

const DEFAULT_CLUB_ID = "liverpool";

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

function requireValue(name) {
    const value = normalizeValue(process.env[name]);
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

export function loadConfig() {
    loadDotEnv();
    const clubId = normalizeValue(process.env.BRIDGEWEBS_CLUB_ID) || DEFAULT_CLUB_ID;
    const eventId = normalizeValue(process.env.EVENT_ID);
    const sessionDate = normalizeValue(process.env.SESSION_DATE);
    const sessionType = normalizeValue(process.env.SESSION_TYPE);
    const recoverUrl = normalizeValue(process.env.BRIDGEWEBS_RECOVER_URL);
    const captureRoot = path.resolve("experiments/admin-export/fixtures/raw");

    return {
        clubId,
        adminUser: normalizeValue(process.env.BRIDGEWEBS_ADMIN_USER) || clubId,
        adminPassword: requireValue("BRIDGEWEBS_ADMIN_PASSWORD"),
        eventId,
        sessionDate,
        sessionType,
        recoverUrl,
        captureRoot,
    };
}

export function buildCaptureLabel(config) {
    if (config.eventId) {
        return config.eventId;
    }

    const datePart = config.sessionDate || "unknown-date";
    const typePart = config.sessionType
        ? config.sessionType.toLowerCase().replace(/\s+/g, "-")
        : "unknown-session";

    return `${datePart}_${typePart}`;
}
