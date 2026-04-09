import fs from "fs";
import path from "path";

const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function sanitizeLabel(value) {
    return value
        .replace(/[^a-z0-9_-]+/gi, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "")
        .toLowerCase()
        .slice(0, 80) || "snapshot";
}

async function writePageSnapshot(page, outDir, label) {
    ensureDir(outDir);
    const safeLabel = sanitizeLabel(label);
    const htmlPath = path.join(outDir, `${safeLabel}.html`);
    const pngPath = path.join(outDir, `${safeLabel}.png`);

    await page.screenshot({ path: pngPath, fullPage: true });
    const html = await page.content();
    fs.writeFileSync(htmlPath, html);

    return { htmlPath, pngPath };
}

async function clickByText(page, matcher) {
    return page.evaluate((matcherSource) => {
        const pattern = new RegExp(matcherSource, "i");
        const candidates = Array.from(document.querySelectorAll("a, button, input[type='button'], input[type='submit']"));

        for (const el of candidates) {
            const text = (el.innerText || el.value || el.textContent || "").trim();
            if (!text || !pattern.test(text)) {
                continue;
            }

            el.click();
            return { clicked: true, text };
        }

        return { clicked: false, text: null };
    }, matcher.source);
}

async function loginToAdmin(page, config, outDir) {
    const loginUrl = `https://www.bridgewebs.com/cgi-bin/bwx/bw.cgi?pid=upload_menu&club=${config.clubId}`;
    await page.goto(loginUrl, { waitUntil: "networkidle2", timeout: 60000 });
    await writePageSnapshot(page, outDir, "01_login_page");

    const loginInput = await page.$('input[id="bridge_login"]');
    const passwordInput = await page.$('input[id="bridge_password"]');

    if (!loginInput || !passwordInput) {
        throw new Error("Could not find BridgeWebs admin login form.");
    }

    await page.evaluate((userSelector, passwordSelector) => {
        const userInput = document.querySelector(userSelector);
        const passwordInputInner = document.querySelector(passwordSelector);
        if (userInput) {
            userInput.value = "";
        }
        if (passwordInputInner) {
            passwordInputInner.value = "";
        }
    }, 'input[id="bridge_login"]', 'input[id="bridge_password"]');

    await loginInput.type(config.adminUser, { delay: 40 });
    await passwordInput.type(config.adminPassword, { delay: 40 });

    await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 60000 }),
        passwordInput.press("Enter"),
    ]);

    await page.waitForNetworkIdle({ idleTime: 500, timeout: 60000 }).catch(() => {});
    await writePageSnapshot(page, outDir, "02_after_login");
}

async function openTargetEvent(page, config, outDir) {
    const target = await page.evaluate((eventId) => {
        const eventCells = Array.from(document.querySelectorAll("[onclick*='eventLink']"));

        const parsed = eventCells.map((el) => {
            const onclick = el.getAttribute("onclick") || "";
            const match = onclick.match(/eventLink\s*\(\s*'([^']+)'/);
            return {
                eventId: match ? match[1] : null,
                text: (el.innerText || el.textContent || "").trim(),
                onclick,
            };
        }).filter((item) => item.eventId);

        const chosen = eventId
            ? parsed.find((item) => item.eventId === eventId)
            : parsed[0];

        if (!chosen) {
            return { opened: false, available: parsed.slice(0, 10) };
        }

        const el = eventCells.find((node) => (node.getAttribute("onclick") || "").includes(`'${chosen.eventId}'`));
        if (!el) {
            return { opened: false, available: parsed.slice(0, 10) };
        }

        el.click();
        return {
            opened: true,
            eventId: chosen.eventId,
            text: chosen.text,
            available: parsed.slice(0, 10),
        };
    }, config.eventId || "");

    if (!target.opened) {
        await writePageSnapshot(page, outDir, "04_event_not_found");
        return { method: "event-not-found", ...target, url: page.url() };
    }

    await page.waitForNetworkIdle({ idleTime: 500, timeout: 30000 }).catch(() => {});
    await writePageSnapshot(page, outDir, "04_event_opened");
    return { method: "event-opened", url: page.url(), eventId: target.eventId, text: target.text };
}

async function openResultsAdministration(page, outDir) {
    const result = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll("a[href]"));
        const match = links.find((link) => {
            const text = (link.innerText || link.textContent || "").trim();
            const href = link.getAttribute("href") || "";
            return /results calendar/i.test(text) || (/pid=upload_calendar/.test(href) && /display_past/.test(href));
        });

        if (!match) {
            return { opened: false };
        }

        match.click();
        return {
            opened: true,
            text: (match.innerText || match.textContent || "").trim(),
        };
    });

    if (!result.opened) {
        await writePageSnapshot(page, outDir, "03_results_admin_not_found");
        return { method: "results-admin-not-found", url: page.url() };
    }

    await page.waitForNetworkIdle({ idleTime: 500, timeout: 30000 }).catch(() => {});
    await writePageSnapshot(page, outDir, "03_results_administration");
    return { method: "results-admin-opened", url: page.url(), label: result.text };
}

async function clickRecoverTab(page, outDir) {
    const result = await clickByText(page, /recover/);
    if (!result.clicked) {
        await writePageSnapshot(page, outDir, "05_recover_not_found");
        return { method: "recover-not-found", url: page.url() };
    }

    await page.waitForNetworkIdle({ idleTime: 500, timeout: 30000 }).catch(() => {});
    await writePageSnapshot(page, outDir, "05_recover_opened");

    const pageText = await page.content();
    return {
        method: "recover-opened",
        url: page.url(),
        label: result.text,
        bodyHasExport: /export|xml|pbn/i.test(pageText),
    };
}

async function navigateToRecover(page, config, outDir) {
    if (config.recoverUrl) {
        await page.goto(config.recoverUrl, { waitUntil: "networkidle2", timeout: 60000 });
        await writePageSnapshot(page, outDir, "03_recover_url");
        return { method: "direct-url", url: page.url() };
    }

    const resultsAdmin = await openResultsAdministration(page, outDir);
    if (resultsAdmin.method !== "results-admin-opened") {
        return resultsAdmin;
    }

    const eventResult = await openTargetEvent(page, config, outDir);
    if (eventResult.method !== "event-opened") {
        return eventResult;
    }

    return clickRecoverTab(page, outDir);
}

async function captureLinkedExports(page, outDir) {
    const exportLinks = await page.evaluate(() => {
        return Array.from(document.querySelectorAll("a[href]"))
            .map((link) => ({
                href: link.href,
                text: (link.innerText || link.textContent || "").trim(),
            }))
            .filter((link) => /(pbn|xml)/i.test(link.text) || /\.(pbn|xml)(\?|$)/i.test(link.href));
    });

    const saved = [];
    for (const link of exportLinks) {
        try {
            const response = await page.goto(link.href, { waitUntil: "networkidle2", timeout: 60000 });
            const body = await response.text();
            const ext = /xml/i.test(link.text) || /\.xml(\?|$)/i.test(link.href) ? "xml" : "pbn";
            const baseName = sanitizeLabel(link.text || `export_${ext}`) || `export_${ext}`;
            const targetPath = path.join(outDir, `${baseName}.${ext}`);
            fs.writeFileSync(targetPath, body);
            saved.push({ type: ext, path: targetPath, href: link.href, text: link.text });
        } catch (err) {
            saved.push({ type: "error", href: link.href, text: link.text, error: err.message });
        }
    }

    return saved;
}

export async function runCapture({ browser, config, captureLabel }) {
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);

    const outDir = path.join(config.captureRoot, captureLabel);
    ensureDir(outDir);

    const metadata = {
        startedAt: new Date().toISOString(),
        clubId: config.clubId,
        eventId: config.eventId || null,
        sessionDate: config.sessionDate || null,
        sessionType: config.sessionType || null,
        captureLabel,
        snapshots: [],
        exports: [],
        navigation: [],
    };

    try {
        await loginToAdmin(page, config, outDir);
        metadata.navigation.push({ step: "login", url: page.url() });

        const recoverResult = await navigateToRecover(page, config, outDir);
        metadata.navigation.push({ step: "recover", ...recoverResult });

        const exportResults = await captureLinkedExports(page, outDir);
        metadata.exports = exportResults;

        const finalSnapshot = await writePageSnapshot(page, outDir, "99_final_state");
        metadata.snapshots.push(finalSnapshot);
        metadata.finishedAt = new Date().toISOString();

        fs.writeFileSync(path.join(outDir, "capture-metadata.json"), JSON.stringify(metadata, null, 2));
        return metadata;
    } finally {
        await page.close();
    }
}
