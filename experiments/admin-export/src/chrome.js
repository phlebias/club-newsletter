import fs from "fs";
import os from "os";
import puppeteer from "puppeteer";

export function findChromePath() {
    try {
        const detected = puppeteer.executablePath();
        if (detected && fs.existsSync(detected)) {
            return detected;
        }
    } catch (err) {
        // Fall through to known paths.
    }

    const platform = os.platform();
    const candidates = platform === "darwin"
        ? [
            "/Users/billburrows/.puppeteer-cache/chrome/mac_arm-144.0.7559.96/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        ]
        : [
            `${os.homedir()}/.cache/puppeteer/chrome/linux-144.0.7559.96/chrome-linux64/chrome`,
            "/usr/bin/google-chrome",
            "/usr/bin/chromium-browser",
        ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    return undefined;
}

export async function launchBrowser() {
    const chromePath = findChromePath();
    const launchOptions = {
        headless: "new",
        defaultViewport: { width: 1440, height: 900 },
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    };

    if (chromePath) {
        launchOptions.executablePath = chromePath;
    }

    return puppeteer.launch(launchOptions);
}
