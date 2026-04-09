function toDirectionalScore(result, pairNo) {
    const rawNs = Number.parseInt(result?.nsScore, 10);
    const rawEw = Number.parseInt(result?.ewScore, 10);
    const nsScore = Number.isFinite(rawNs) ? rawNs : (Number.isFinite(rawEw) ? -rawEw : 0);
    return result.ns === pairNo ? nsScore : -nsScore;
}

function pickPrimaryWinner(rankings) {
    const nsRankings = rankings.filter((rank) => rank.direction === "NS");
    const ewRankings = rankings.filter((rank) => rank.direction === "EW");

    if (nsRankings.length > 0 && ewRankings.length > 0) {
        return nsRankings[0];
    }

    return rankings[0] || null;
}

export function analyzeWinnerPattern(sessionData) {
    const rankings = sessionData.rankings || [];
    const boards = sessionData.boards || [];
    const winner = pickPrimaryWinner(rankings);

    if (!winner) {
        return null;
    }

    let betterThanFieldCount = 0;
    let boardsSeen = 0;
    const largeGainBoards = [];

    boards.forEach((board) => {
        const result = board.results.find((entry) => entry.ns === winner.no || entry.ew === winner.no);
        if (!result || board.results.length === 0) {
            return;
        }

        boardsSeen += 1;
        const pairScore = toDirectionalScore(result, winner.no);
        const fieldScores = board.results.map((entry) => toDirectionalScore(entry, winner.no));
        const fieldAverage = fieldScores.reduce((sum, score) => sum + score, 0) / fieldScores.length;
        const gain = pairScore - fieldAverage;

        if (gain > 0) {
            betterThanFieldCount += 1;
        }
        if (gain > 200) {
            largeGainBoards.push({
                boardNum: board.boardNum,
                gain: Math.round(gain),
            });
        }
    });

    const style = largeGainBoards.length >= 3 ? "large_swings" : "steady_gains";
    const summary = style === "large_swings"
        ? `${winner.players} built their score on several large gains, notably Boards ${largeGainBoards.slice(0, 3).map((board) => board.boardNum).join(", ")}.`
        : `${winner.players} bettered the field on ${betterThanFieldCount} of ${boardsSeen} boards, so their result came more from steady gains than isolated swings.`;

    return {
        winner: winner.players,
        style,
        betterThanFieldCount,
        boardsSeen,
        largeGainBoards,
        summary,
    };
}
