function toNsScore(result) {
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

function formatSuit(contract) {
    return String(contract || "")
        .replace(/S/g, "♠")
        .replace(/H/g, "♥")
        .replace(/D/g, "♦")
        .replace(/C/g, "♣");
}

function simplifyNames(names) {
    if (!names || names.length < 3) {
        return "Unknown Pair";
    }
    return names.split("&").map((name) => name.trim().split(" ")[0]).join(" and ");
}

function describeResult(result, pairNames) {
    const score = toNsScore(result);
    const contract = formatSuit(result.contract || "");
    const declarer = result.declarer || "?";
    const tricks = Number.parseInt(result.tricks, 10) || 0;
    const target = (Number.parseInt(String(result.contract || "")[0], 10) || 0) + 6;
    const trickDiff = tricks - target;
    const pairLabel = simplifyNames(pairNames[result.ns] || `Pair ${result.ns}`);

    let action = "";
    if (["N", "S"].includes(declarer)) {
        action = trickDiff >= 0
            ? `bid and made ${contract} for ${score}`
            : `sacrificed in ${contract} for ${score}`;
    } else {
        action = trickDiff < 0
            ? `defended ${contract}${String(result.contract || "").includes("*") || String(result.contract || "").includes("x") ? " doubled" : ""} by ${declarer} to collect ${score}`
            : `held the opposition to ${contract} for ${score}`;
    }

    return {
        pairLabel,
        action,
        score,
    };
}

export function findMaterialBoards(sessionData, limit = 3) {
    const rankings = sessionData.rankings || [];
    const boards = sessionData.boards || [];
    const pairNames = {};

    rankings.forEach((ranking) => {
        if (ranking.no && ranking.players) {
            pairNames[ranking.no] = ranking.players;
        }
    });

    return boards
        .map((board) => {
            const sortedResults = board.results
                .slice()
                .sort((left, right) => toNsScore(right) - toNsScore(left));

            const bestResult = sortedResults[0];
            const worstResult = sortedResults[sortedResults.length - 1];
            const spread = bestResult && worstResult ? toNsScore(bestResult) - toNsScore(worstResult) : 0;

            return {
                boardNum: board.boardNum,
                spread,
                bestResult,
                worstResult,
                bestSummary: bestResult ? describeResult(bestResult, pairNames) : null,
                worstSummary: worstResult ? describeResult(worstResult, pairNames) : null,
                contracts: [...new Set(board.results.map((result) => result.contract).filter(Boolean))],
            };
        })
        .sort((left, right) => right.spread - left.spread)
        .slice(0, limit)
        .map((board) => ({
            ...board,
            deal: sessionData.boards.find((item) => item.boardNum === board.boardNum)?.deal || "",
            ddTricks: sessionData.boards.find((item) => item.boardNum === board.boardNum)?.ddTricks || "",
            optimumScore: sessionData.boards.find((item) => item.boardNum === board.boardNum)?.optimumScore || "",
            summary: board.bestSummary && board.worstSummary
                ? `Board ${board.boardNum}: ${board.bestSummary.pairLabel} ${board.bestSummary.action}. At the other end of the traveller, another pair ${board.worstSummary.action}, producing a ${board.spread}-point spread.`
                : `Board ${board.boardNum}: ${board.spread}-point spread.`,
        }));
}
