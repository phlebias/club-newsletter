function parseScore(result, pairNo) {
    const nsScore = Number.parseInt(result?.nsScore, 10);
    const ewScore = Number.parseInt(result?.ewScore, 10);
    const base = Number.isFinite(nsScore) ? nsScore : (Number.isFinite(ewScore) ? -ewScore : 0);
    return result.ns === pairNo ? base : -base;
}

function average(values) {
    if (!values.length) {
        return 0;
    }
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function pairBoardsFor(sessionData, pairNo) {
    return (sessionData.boards || [])
        .map((board) => {
            const result = board.results.find((entry) => entry.ns === pairNo || entry.ew === pairNo);
            return result ? { boardNum: board.boardNum, result, board } : null;
        })
        .filter(Boolean);
}

export function buildPairSummaries(sessionData) {
    const rankings = sessionData.rankings || [];

    return rankings.map((ranking) => {
        const pairNo = ranking.no;
        const appearances = pairBoardsFor(sessionData, pairNo);
        const boardDiffs = appearances.map(({ result, board, boardNum }) => {
            const pairScore = parseScore(result, pairNo);
            const fieldScores = board.results.map((entry) => parseScore(entry, pairNo));
            const fieldAvg = average(fieldScores);
            return {
                boardNum,
                pairScore,
                diffVsField: Math.round(pairScore - fieldAvg),
                contract: result.contract || "",
            };
        });

        const sortedByGain = boardDiffs.slice().sort((left, right) => right.diffVsField - left.diffVsField);
        const tops = boardDiffs.filter((item) => item.diffVsField > 0).length;
        const bottoms = boardDiffs.filter((item) => item.diffVsField < 0).length;
        const avgVsField = average(boardDiffs.map((item) => item.diffVsField));

        return {
            pairNo,
            players: ranking.players,
            rank: ranking.rank || ranking.pos || "—",
            score: ranking.score || "—",
            boardsPlayed: appearances.length,
            avgVsField: Math.round(avgVsField),
            positiveBoards: tops,
            negativeBoards: bottoms,
            bestBoards: sortedByGain.slice(0, 3).map((item) => ({
                boardNum: item.boardNum,
                diffVsField: item.diffVsField,
            })),
            worstBoards: sortedByGain.slice(-3).reverse().map((item) => ({
                boardNum: item.boardNum,
                diffVsField: item.diffVsField,
            })),
        };
    });
}
