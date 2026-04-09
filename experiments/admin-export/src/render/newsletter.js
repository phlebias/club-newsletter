import { buildLegacyMetrics } from "../analysis/legacyMetrics.js";
import { buildPairSummaries } from "../analysis/pairSummaries.js";
import { summarizeCardStrength } from "../analysis/cardStrength.js";
import { analyzePointsDistribution } from "../analysis/pointsDistribution.js";
import { findSlamStory } from "../analysis/slams.js";
import { findContractSplitBoard } from "../analysis/contractSplits.js";
import { findLeadSensitiveBoard } from "../analysis/leadSwings.js";
import { findMaterialBoards } from "../analysis/materialBoards.js";
import { findSameContractPlaySwing } from "../analysis/playSwings.js";
import { assessSectionConfidence } from "../analysis/quality.js";
import { analyzeWinnerPattern } from "../analysis/winnerPattern.js";
import { analyzeEfficiency, parsePbnDeal, renderHandDiagram } from "../../../../src/analysis.js";

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function shouldRenderSection(finding, confidenceEntry, options = {}) {
    const { alwaysShow = false } = options;
    if (alwaysShow) {
        return true;
    }
    if (!finding) {
        return false;
    }
    return confidenceEntry?.label !== "Low confidence";
}

function renderSection({ title, body, tone = "default" }) {
    const toneClass = tone === "caution" ? "shadow-section caution" : "shadow-section";

    return `
        <section class="${toneClass}">
            <h2>${escapeHtml(title)}</h2>
            ${body}
        </section>
    `;
}

function renderPairSnapshot(pairSummaries, tone) {
    return renderSection({
        title: "Personal Pair Lookup",
        tone,
        body: `
            <p>Select your pair to view a short session summary, including your strongest and weakest boards.</p>
            <select id="shadow-pair-select" class="shadow-select">
                <option value="">-- Select a pair --</option>
                ${pairSummaries.map((pair) => `<option value="${escapeHtml(pair.pairNo)}">${escapeHtml(`${pair.pairNo}: ${pair.players} (${pair.score}%)`)}</option>`).join("")}
            </select>
            <div id="shadow-pair-output" class="shadow-muted">Choose a pair to view its session summary.</div>
        `,
    });
}

function renderPairScript(pairSummaries) {
    return `
        <script>
            (function() {
                const summaries = ${JSON.stringify(pairSummaries)};
                const select = document.getElementById("shadow-pair-select");
                const output = document.getElementById("shadow-pair-output");

                function formatBoardList(items) {
                    if (!items || items.length === 0) {
                        return "None";
                    }

                    return items.map((item) => {
                        const sign = item.diffVsField > 0 ? "+" : "";
                        return "Board " + item.boardNum + " (" + sign + item.diffVsField + ")";
                    }).join(", ");
                }

                function renderSummary(pairNo) {
                    const summary = summaries.find((item) => item.pairNo === pairNo);
                    if (!summary) {
                        output.innerHTML = "Choose a pair to view its session summary.";
                        return;
                    }

                    const avgSign = summary.avgVsField > 0 ? "+" : "";
                    output.innerHTML = [
                        '<div class="shadow-grid">',
                        '<div class="shadow-card"><div class="shadow-label">Rank</div><div class="shadow-value">' + summary.rank + ' (' + summary.score + '%)</div></div>',
                        '<div class="shadow-card"><div class="shadow-label">Boards Played</div><div class="shadow-value">' + summary.boardsPlayed + '</div></div>',
                        '<div class="shadow-card"><div class="shadow-label">Avg vs Field</div><div class="shadow-value">' + avgSign + summary.avgVsField + '</div></div>',
                        '<div class="shadow-card"><div class="shadow-label">Positive / Negative</div><div class="shadow-value">' + summary.positiveBoards + ' / ' + summary.negativeBoards + '</div></div>',
                        '</div>',
                        '<p class="shadow-list"><strong>Best boards:</strong> ' + formatBoardList(summary.bestBoards) + '</p>',
                        '<p class="shadow-list"><strong>Worst boards:</strong> ' + formatBoardList(summary.worstBoards) + '</p>'
                    ].join('');
                }

                if (select) {
                    select.addEventListener("change", function() {
                        renderSummary(select.value);
                    });
                }
            })();
        </script>
    `;
}

function renderDiagramDetails(board, label = "View hand diagram") {
    if (!board?.deal) {
        return "";
    }

    const diagram = renderHandDiagram(parsePbnDeal(board.deal), board.boardNum, board.ddTricks, board.optimumScore);
    if (!diagram) {
        return "";
    }

    return `
        <details style="margin: 8px 0 12px;">
            <summary style="color: #fbbf24; cursor: pointer; font-size: 0.95rem;">${escapeHtml(label)}</summary>
            <div>${diagram}</div>
        </details>
    `;
}

function buildDiagramRenderer() {
    const renderedBoards = new Set();

    return (board, label = "View hand diagram") => {
        if (!board?.boardNum) {
            return "";
        }

        const boardKey = String(board.boardNum);
        if (renderedBoards.has(boardKey)) {
            return "";
        }

        const diagramHtml = renderDiagramDetails(board, label);
        if (diagramHtml) {
            renderedBoards.add(boardKey);
        }
        return diagramHtml;
    };
}

function renderEfficiencySection(boards, rankings) {
    const pairNames = {};
    (rankings || []).forEach((ranking) => {
        if (ranking.no && ranking.players) {
            pairNames[ranking.no] = ranking.players;
        }
    });

    const rows = analyzeEfficiency(boards || [], pairNames).slice(0, 5);
    if (rows.length === 0) {
        return "";
    }

    return renderSection({
        title: "HCP Efficiency",
        body: `
            <p>This table shows how declarers compared with double-dummy expectations on the boards where that data was available.</p>
            <table style="width: 100%; border-collapse: collapse; font-size: 1rem; color: #cbd5e1;">
                <thead>
                    <tr style="text-align: left; color: #fbbf24; border-bottom: 1px solid #334155;">
                        <th style="padding: 8px 8px 8px 0;">Pair</th>
                        <th style="padding: 8px; text-align: right;">Avg Diff</th>
                        <th style="padding: 8px; text-align: right;">Boards</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map((row) => `
                        <tr style="border-bottom: 1px solid rgba(51, 65, 85, 0.6);">
                            <td style="padding: 8px 8px 8px 0;">${escapeHtml(row.name)}</td>
                            <td style="padding: 8px; text-align: right;">${escapeHtml(row.avgDiff > 0 ? `+${row.avgDiff}` : row.avgDiff)}</td>
                            <td style="padding: 8px; text-align: right;">${escapeHtml(row.count)}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `,
    });
}

function renderKillerLeadSection(leadSwing, boards, renderUniqueDiagram) {
    if (!leadSwing) {
        return "";
    }

    const board = (boards || []).find((item) => String(item.boardNum) === String(leadSwing.boardNum));

    return renderSection({
        title: "Killer Leads & Par Breakers",
        body: `
            <p>${escapeHtml(leadSwing.summary)}</p>
            <p>This is the clearest board in the session where the opening lead appears to have changed the final outcome in the same contract.</p>
            ${board ? renderUniqueDiagram(board, `View Board ${leadSwing.boardNum} diagram`) : ""}
        `,
    });
}

export function renderShadowNewsletter(sessionData) {
    const legacyMetrics = buildLegacyMetrics(sessionData);
    const pairSummaries = buildPairSummaries(sessionData);
    const cardStrength = summarizeCardStrength(sessionData);
    const pointsDistribution = analyzePointsDistribution(sessionData);
    const slamStory = findSlamStory(sessionData);
    const contractSplit = findContractSplitBoard(sessionData);
    const leadSwing = findLeadSensitiveBoard(sessionData);
    const materialBoards = findMaterialBoards(sessionData);
    const playSwing = findSameContractPlaySwing(sessionData);
    const winnerPattern = analyzeWinnerPattern(sessionData);
    const leadDuplicatesPlay = Boolean(
        leadSwing
        && playSwing
        && leadSwing.boardNum === playSwing.boardNum
        && leadSwing.contract === playSwing.contract
    );
    const confidence = assessSectionConfidence(sessionData, {
        contractSplit,
        playSwing,
        leadSwing,
        winnerPattern,
        materialBoards,
    });
    const renderUniqueDiagram = buildDiagramRenderer();

    const sections = [
        renderSection({
            title: "Winners",
            tone: confidence.summary.tone,
            body: `
                ${legacyMetrics.winners.map((winner) => `<p><strong>${escapeHtml(winner.label)}:</strong> ${escapeHtml(winner.text)}</p>`).join("")}
                ${winnerPattern ? `<p><strong>Winning margin analysis:</strong> ${escapeHtml(winnerPattern.summary)}</p>` : ""}
            `,
        }),
    ];

    if (cardStrength) {
        sections.push(renderSection({
            title: "Did you have the cards?",
            body: `
                <p>${escapeHtml(cardStrength.headline)}</p>
                <p>${escapeHtml(cardStrength.ceiling)}</p>
            `,
        }));
    }

    sections.push(renderSection({
        title: "Big Swings",
        tone: confidence.materialBoards.tone,
        body: materialBoards.map((board) => `
            <p>${escapeHtml(board.summary)}</p>
            ${renderUniqueDiagram(board, `View Board ${board.boardNum} diagram`)}
        `).join(""),
    }));

    sections.push(renderSection({
        title: "Slams",
        body: `
            <p>${escapeHtml(slamStory.summary)}</p>
            ${slamStory.diagramBoard ? renderUniqueDiagram(slamStory.diagramBoard, `View Board ${slamStory.boardNum} diagram`) : ""}
        `,
    }));

    if (shouldRenderSection(contractSplit, confidence.contractSplit)) {
        sections.push(renderSection({
            title: "Where the choice of contract made a difference",
            tone: confidence.contractSplit.tone,
            body: `<p>${escapeHtml(contractSplit.summary)}</p>`,
        }));
    }

    if (shouldRenderSection(playSwing, confidence.sameContractSwing)) {
        sections.push(renderSection({
            title: "Individual Tops",
            tone: confidence.sameContractSwing.tone,
            body: `<p>${escapeHtml(playSwing.summary)}</p>`,
        }));
    }

    const killerLeadSection = renderKillerLeadSection(leadSwing, sessionData.boards, renderUniqueDiagram);
    if (killerLeadSection) {
        sections.push(killerLeadSection);
    }

    if (shouldRenderSection(leadSwing, confidence.leadDifference) && !leadDuplicatesPlay && !killerLeadSection) {
        sections.push(renderSection({
            title: "Opening Lead",
            tone: confidence.leadDifference.tone,
            body: `<p>${escapeHtml(leadSwing.summary)}</p>`,
        }));
    }

    const efficiencySection = renderEfficiencySection(sessionData.boards, sessionData.rankings);
    if (efficiencySection) {
        sections.push(efficiencySection);
    }

    if (pointsDistribution) {
        sections.push(renderSection({
            title: "Distribution of Points",
            body: `
                <p>${escapeHtml(pointsDistribution.headline)} ${escapeHtml(pointsDistribution.opportunityText)}</p>
                <p>${escapeHtml(pointsDistribution.textureText)}</p>
            `,
        }));
    }

    sections.push(renderPairSnapshot(pairSummaries, confidence.pairSnapshot.tone));

    return `
        <div class="shadow-newsletter">
            <div class="shadow-header">
                <div style="margin-bottom: 20px;">
                    <button onclick="this.closest('details')?.removeAttribute('open')" style="
                        background-color: transparent;
                        border: 1px solid #fbbf24;
                        color: #fbbf24;
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-family: inherit;
                        font-size: 0.9rem;
                    ">
                        &larr; Back / Close Report
                    </button>
                </div>
                <div class="shadow-kicker">Session Report</div>
                <h1>${escapeHtml(sessionData.eventInfo?.text?.split("\\n")[0] || sessionData.meta?.eventDescription || "Recovered Session")}</h1>
                <p>A session summary built around the clearest boards for bidding judgement, card play, and match-defining swings.</p>
            </div>
            ${sections.join("")}
        </div>
        ${renderPairScript(pairSummaries)}
    `;
}
