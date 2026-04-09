function formatSuit(contract) {
    return String(contract || "")
        .replace(/S/g, "♠")
        .replace(/H/g, "♥")
        .replace(/D/g, "♦")
        .replace(/C/g, "♣");
}

function parseNsScore(result) {
    const nsScore = Number.parseInt(result?.nsScore, 10);
    if (Number.isFinite(nsScore)) {
        return nsScore;
    }

    const ewScore = Number.parseInt(result?.ewScore, 10);
    if (Number.isFinite(ewScore)) {
        return -ewScore;
    }

    return 0;
}

function directionalScore(result) {
    const score = parseNsScore(result);
    return ["N", "S"].includes(result?.declarer) ? score : -score;
}

export function findLeadSensitiveBoard(sessionData) {
    const boards = sessionData.boards || [];

    for (const board of boards) {
        const byContract = new Map();
        for (const result of board.results) {
            const contract = String(result.contract || "").trim();
            const lead = String(result.lead || "").trim();
            if (!contract || contract === "PASS" || !lead) {
                continue;
            }

            if (!byContract.has(contract)) {
                byContract.set(contract, []);
            }
            byContract.get(contract).push(result);
        }

        for (const [contract, results] of byContract.entries()) {
            if (results.length < 2) {
                continue;
            }

            const uniqueLeads = new Set(results.map((result) => String(result.lead || "").trim()));
            if (uniqueLeads.size < 2) {
                continue;
            }

            const sortedByTricks = results
                .slice()
                .sort((left, right) => (Number.parseInt(right.tricks, 10) || 0) - (Number.parseInt(left.tricks, 10) || 0));

            const best = sortedByTricks[0];
            const worst = sortedByTricks[sortedByTricks.length - 1];
            const bestTricks = Number.parseInt(best.tricks, 10) || 0;
            const worstTricks = Number.parseInt(worst.tricks, 10) || 0;

            if (bestTricks === worstTricks || String(best.lead || "").trim() === String(worst.lead || "").trim()) {
                continue;
            }

            return {
                boardNum: board.boardNum,
                contract,
                betterLead: best.lead,
                worseLead: worst.lead,
                betterTricks: bestTricks,
                worseTricks: worstTricks,
                betterScore: directionalScore(best),
                worseScore: directionalScore(worst),
                summary: `Board ${board.boardNum} may be lead-sensitive in ${formatSuit(contract)}: the ${best.lead} lead saw declarer finish with ${bestTricks} tricks for ${directionalScore(best)}, while the ${worst.lead} lead held the same contract to ${worstTricks} tricks for ${directionalScore(worst)}.`,
            };
        }
    }

    return null;
}
