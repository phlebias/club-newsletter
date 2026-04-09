const TIE_MARGIN_EPSILON = 0.005;

function formatWinnerSentence(topPair, secondPair, options = {}) {
    const { tieVerb = "finished first equal with", normalVerb = "finished first with", narrowVerb = "edging", clearVerb = "beating" } = options;
    const marginValue = parseFloat(topPair?.score ?? "0") - parseFloat(secondPair?.score ?? "0");
    const margin = marginValue.toFixed(2);

    if (Math.abs(marginValue) < TIE_MARGIN_EPSILON) {
        return `${topPair.players} ${tieVerb} ${secondPair.players} on ${topPair.score}%.`;
    }

    return `${topPair.players} ${normalVerb} ${topPair.score}%, ${parseFloat(margin) < 1.0 ? narrowVerb : clearVerb} ${secondPair.players} by ${margin}%.`;
}

export function buildLegacyMetrics(sessionData) {
    const { rankings = [], boards = [], quality = {}, meta = {} } = sessionData;
    const nsRankings = rankings.filter((rank) => rank.direction === "NS");
    const ewRankings = rankings.filter((rank) => rank.direction === "EW");

    let winners = [];
    if (nsRankings.length > 1 && ewRankings.length > 1) {
        winners = [
            {
                label: "North/South",
                text: formatWinnerSentence(nsRankings[0], nsRankings[1]),
            },
            {
                label: "East/West",
                text: formatWinnerSentence(ewRankings[0], ewRankings[1], {
                    tieVerb: "finished first equal with",
                    normalVerb: "won the field with",
                    narrowVerb: "narrowly ahead of",
                    clearVerb: "clear of",
                }).replace(/\(([^)]+)\)\.$/, "$1."),
            },
        ];
    } else if (rankings.length > 1) {
        winners = [
            {
                label: "Overall",
                text: formatWinnerSentence(rankings[0], rankings[1]),
            },
        ];
    }

    const boardsWithDd = boards.filter((board) => Boolean(board.ddTricks)).length;
    const boardsWithLeads = boards.filter((board) =>
        board.results.some((result) => String(result.lead || "").trim() !== "")
    ).length;
    const averageTables = boards.length
        ? (boards.reduce((sum, board) => sum + board.results.length, 0) / boards.length).toFixed(1)
        : "0.0";

    return {
        winners,
        coverage: {
            boardsWithDd,
            boardsWithLeads,
            averageTables,
            warningsCount: quality?.warnings?.length || 0,
            scheduledBoards: meta?.boardsPlayed ?? null,
        },
    };
}
