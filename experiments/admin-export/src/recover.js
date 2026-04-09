import fs from "fs";
import path from "path";

const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const RECOVER_URL = "https://www.bridgewebs.com/cgi-bin/bwor/bw.cgi";

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function sanitizeLabel(value) {
    return value
        .replace(/[^a-z0-9._-]+/gi, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "")
        .toLowerCase()
        .slice(0, 120) || "download";
}

async function writePageSnapshot(page, outDir, label) {
    ensureDir(outDir);
    const safeLabel = sanitizeLabel(label);
    const htmlPath = path.join(outDir, `${safeLabel}.html`);
    const pngPath = path.join(outDir, `${safeLabel}.png`);

    await page.screenshot({ path: pngPath, fullPage: true });
    fs.writeFileSync(htmlPath, await page.content());

    return { htmlPath, pngPath };
}

async function loginToRecover(page, config, outDir) {
    const recoverLoginUrl = `${RECOVER_URL}?club=${config.clubId}&pid=upload_results&wd=1&popt=recover`;
    await page.goto(recoverLoginUrl, { waitUntil: "networkidle2", timeout: 60000 });
    await writePageSnapshot(page, outDir, "01_recover_login");

    const passwordInput = await page.$("input[name='bridge_password']");
    const loginButton = await page.$("button[name='popt'][value='login']");

    if (!passwordInput || !loginButton) {
        throw new Error("Could not find the Results Administration recover login form.");
    }

    await page.evaluate(() => {
        const input = document.querySelector("input[name='bridge_password']");
        if (input) {
            input.value = "";
        }
    });

    await passwordInput.type(config.adminPassword, { delay: 40 });
    await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 60000 }),
        loginButton.click(),
    ]);
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 60000 }).catch(() => {});
    await writePageSnapshot(page, outDir, "02_after_recover_login");

    await page.goto(recoverLoginUrl, { waitUntil: "networkidle2", timeout: 60000 });
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 60000 }).catch(() => {});
    await writePageSnapshot(page, outDir, "03_recover_authenticated");
}

async function findEventDownloads(page, eventId) {
    return page.evaluate((targetEventId) => {
        const checkbox = document.querySelector(`input[name='download_event_${targetEventId}']`);
        if (!checkbox) {
            const known = Array.from(document.querySelectorAll("input[name^='download_event_']"))
                .map((input) => input.value)
                .slice(0, 40);
            return { found: false, availableEventIds: known };
        }

        const row = checkbox.closest("tr");
        if (!row) {
            return { found: false, availableEventIds: [] };
        }

        const titleCell = row.querySelectorAll("td")[5];
        const title = (titleCell?.innerText || titleCell?.textContent || "").trim();
        const links = Array.from(row.querySelectorAll(".eldlink"))
            .map((el) => ({
                label: (el.innerText || el.textContent || "").trim().toLowerCase(),
                title: el.getAttribute("title") || "",
            }))
            .filter((item) => item.label === "pbn" || item.label === "xml" || item.label === "dat");

        return {
            found: true,
            eventId: targetEventId,
            title,
            links,
        };
    }, eventId);
}

async function configureDownloads(page, downloadDir) {
    ensureDir(downloadDir);
    const client = await page.target().createCDPSession();
    await client.send("Page.setDownloadBehavior", {
        behavior: "allow",
        downloadPath: downloadDir,
    });
}

async function waitForNewFile(downloadDir, beforeFiles, timeoutMs = 30000) {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
        const currentFiles = fs.readdirSync(downloadDir).filter((name) => !name.endsWith(".crdownload"));
        const newFiles = currentFiles.filter((name) => !beforeFiles.has(name));
        if (newFiles.length > 0) {
            return newFiles[0];
        }

        await new Promise((resolve) => setTimeout(resolve, 250));
    }

    return null;
}

async function downloadFile(page, eventId, kind, downloadDir) {
    const beforeFiles = new Set(fs.readdirSync(downloadDir));

    const clicked = await page.evaluate((targetEventId, targetKind) => {
        const checkbox = document.querySelector(`input[name='download_event_${targetEventId}']`);
        const row = checkbox?.closest("tr");
        if (!row) {
            return false;
        }

        const link = Array.from(row.querySelectorAll(".eldlink")).find((el) => {
            const label = (el.innerText || el.textContent || "").trim().toLowerCase();
            return label === targetKind;
        });

        if (!link) {
            return false;
        }

        link.click();
        return true;
    }, eventId, kind);

    if (!clicked) {
        return { kind, ok: false, error: `Missing ${kind} link for ${eventId}` };
    }

    const filename = await waitForNewFile(downloadDir, beforeFiles);
    if (!filename) {
        return { kind, ok: false, error: `Timed out waiting for ${kind} download for ${eventId}` };
    }

    const sourcePath = path.join(downloadDir, filename);
    const ext = path.extname(filename) || `.${kind}`;
    const finalName = sanitizeLabel(`${eventId}_${kind}${ext.startsWith(".") ? "" : "."}${ext}`.replace(/\.+/g, "."));
    const finalPath = path.join(downloadDir, finalName);

    if (sourcePath !== finalPath) {
        fs.renameSync(sourcePath, finalPath);
    }

    return {
        kind,
        ok: true,
        filename: path.basename(finalPath),
        path: finalPath,
    };
}

export async function runRecoverDownload({ browser, config, captureLabel }) {
    if (!config.eventId) {
        throw new Error("Recover-mode testing requires EVENT_ID.");
    }

    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);

    const outDir = path.join(config.captureRoot, `${captureLabel}_recover`);
    const downloadDir = path.join(outDir, "downloads");
    ensureDir(outDir);
    ensureDir(downloadDir);

    const metadata = {
        startedAt: new Date().toISOString(),
        clubId: config.clubId,
        eventId: config.eventId,
        captureLabel,
        snapshots: [],
        downloads: [],
    };

    try {
        await configureDownloads(page, downloadDir);
        await loginToRecover(page, config, outDir);

        const eventInfo = await findEventDownloads(page, config.eventId);
        metadata.event = eventInfo;
        if (!eventInfo.found) {
            const finalSnapshot = await writePageSnapshot(page, outDir, "99_event_not_found");
            metadata.snapshots.push(finalSnapshot);
            metadata.finishedAt = new Date().toISOString();
            fs.writeFileSync(path.join(outDir, "recover-metadata.json"), JSON.stringify(metadata, null, 2));
            throw new Error(`Event ${config.eventId} was not listed on the recover page.`);
        }

        const wantedKinds = ["pbn", "xml"];
        for (const kind of wantedKinds) {
            const result = await downloadFile(page, config.eventId, kind, downloadDir);
            metadata.downloads.push(result);
        }

        const finalSnapshot = await writePageSnapshot(page, outDir, "99_after_downloads");
        metadata.snapshots.push(finalSnapshot);
        metadata.finishedAt = new Date().toISOString();
        fs.writeFileSync(path.join(outDir, "recover-metadata.json"), JSON.stringify(metadata, null, 2));
        return metadata;
    } finally {
        await page.close();
    }
}
