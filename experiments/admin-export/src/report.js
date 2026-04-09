import fs from "fs";
import path from "path";
import { renderShadowNewsletter } from "./render/newsletter.js";
import { loadXmlSession } from "./session/loadXml.js";
import { loadPbnBoards } from "./session/loadPbn.js";
import { normalizeRecoverSession } from "./session/normalize.js";

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function renderWrappedHtml(sessionData, newsletterHtml) {
    const pageTitle = sessionData?.meta?.eventDescription || sessionData?.eventInfo?.text || "Session Report";

    return `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(pageTitle)} Report</title>
    <style>
        body {
            margin: 0;
            background: #0b1120;
            color: #e5e7eb;
            font-family: Georgia, "Times New Roman", serif;
        }
        .newsletter {
            max-width: 1080px;
            margin: 0 auto;
            overflow: hidden;
        }
        .shadow-newsletter {
            padding: 40px 20px;
            background: #0f172a;
            color: #e2e8f0;
            font-family: 'Inter', system-ui, sans-serif;
            line-height: 1.6;
        }
        .shadow-header {
            border-left: 4px solid #fbbf24;
            padding-left: 24px;
            margin-bottom: 40px;
        }
        .shadow-kicker {
            color: #94a3b8;
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            margin-bottom: 10px;
        }
        .shadow-header h1 {
            margin: 0 0 8px;
            color: #fff;
            font-size: 2.5rem;
            font-weight: 900;
        }
        .shadow-header p {
            margin: 0;
            color: #cbd5e1;
            line-height: 1.6;
            font-size: 1.05rem;
        }
        .shadow-section {
            margin-bottom: 32px;
        }
        .shadow-section.caution {
            padding: 18px 18px 14px;
            border: 1px solid rgba(245, 158, 11, 0.35);
            border-radius: 12px;
            background: rgba(245, 158, 11, 0.06);
        }
        .shadow-section h2 {
            color: #fbbf24;
            font-size: 1.5rem;
            border-bottom: 1px solid #334155;
            padding-bottom: 8px;
            margin: 0 0 12px;
        }
        .shadow-section p {
            margin: 0 0 8px;
            color: #cbd5e1;
            line-height: 1.6;
            font-size: 1.05rem;
        }
        .shadow-section p:last-child {
            margin-bottom: 0;
        }
        .shadow-select {
            width: 100%;
            padding: 12px;
            margin: 8px 0 12px;
            background: #1e293b;
            color: #f8fafc;
            border: 1px solid #334155;
            border-radius: 6px;
            font-size: 1rem;
        }
        .shadow-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
            gap: 16px;
            margin-bottom: 16px;
        }
        .shadow-card {
            background: rgba(255,255,255,0.03);
            border-radius: 8px;
            padding: 10px 12px;
            border: 1px solid rgba(255,255,255,0.04);
        }
        .shadow-label {
            color: #94a3b8;
            font-size: 0.72rem;
            font-weight: 700;
            letter-spacing: 0.04em;
            text-transform: uppercase;
        }
        .shadow-value {
            color: #f8fafc;
            font-size: 1.3rem;
            font-weight: 700;
            margin-top: 4px;
        }
        .shadow-list {
            color: #cbd5e1;
            margin: 10px 0 0;
            font-size: 1rem;
        }
        .shadow-muted {
            min-height: 48px;
            color: #94a3b8;
            font-style: italic;
            padding: 12px 0;
        }
    </style>
</head>
<body>
    <div class="newsletter">${newsletterHtml}</div>
</body>
</html>`;
}

export function generateRecoverReport({ xmlPath, pbnPath, outPath }) {
    const xmlSession = loadXmlSession(xmlPath);
    const pbnBoards = loadPbnBoards(pbnPath);
    const sessionData = normalizeRecoverSession({ xmlSession, pbnBoards });
    const newsletterHtml = renderShadowNewsletter(sessionData);
    const html = renderWrappedHtml(sessionData, newsletterHtml);

    ensureDir(path.dirname(outPath));
    fs.writeFileSync(outPath, html);

    return {
        outPath,
        eventDescription: sessionData.meta.eventDescription,
        eventDate: sessionData.meta.eventDate,
        boardCount: sessionData.boards.length,
        participantCount: sessionData.rankings.length,
    };
}
