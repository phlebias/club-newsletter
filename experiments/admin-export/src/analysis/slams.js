function formatSuit(contract) {
    return String(contract || "")
        .replace(/S/g, "♠")
        .replace(/H/g, "♥")
        .replace(/D/g, "♦")
        .replace(/C/g, "♣");
}

function directionalScore(result) {
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

export function findSlamStory(sessionData) {
    const rankings = sessionData.rankings || [];
    const boards = sessionData.boards || [];
    const pairNames = {};

    rankings.forEach((ranking) => {
        if (ranking.no && ranking.players) {
            pairNames[ranking.no] = ranking.players;
        }
    });

    const candidates = boards.flatMap((board) => {
        const madeSlams = board.results.filter((result) => {
            const level = Number.parseInt(String(result.contract || "")[0], 10);
            const tricks = Number.parseInt(result.tricks, 10);
            return level >= 6 && Number.isFinite(tricks) && tricks >= level + 6;
        });

        return madeSlams.map((result) => ({ board, result }));
    });

    if (candidates.length === 0) {
        return {
            summary: "No slams were bid and made in this session.",
            boardNum: null,
            diagramBoard: null,
        };
    }

    const best = candidates
        .map(({ board, result }) => {
            const pairNo = ["N", "S"].includes(result.declarer) ? result.ns : result.ew;
            const pairName = pairNames[pairNo] || `Pair ${pairNo}`;
            const fieldContracts = [...new Set(
                board.results
                    .map((item) => item.contract)
                    .filter((contract) => contract && !/^[67]/.test(String(contract)))
            )];
            const sideHcp = ["N", "S"].includes(result.declarer)
                ? Number.parseInt(board.nsHCP, 10) || 0
                : Number.parseInt(board.ewHCP, 10) || 0;

            return {
                boardNum: board.boardNum,
                board,
                pairName,
                contract: result.contract,
                score: directionalScore(result),
                spread: board.results.length > 0
                    ? Math.max(...board.results.map((item) => directionalScore(item))) - Math.min(...board.results.map((item) => directionalScore(item)))
                    : 0,
                fieldContracts,
                sideHcp,
                summary: `Board ${board.boardNum}: ${pairName} reached ${formatSuit(result.contract)} and scored ${directionalScore(result)}. ${fieldContracts.length > 0 ? `Most of the room stopped in ${fieldContracts.map(formatSuit).slice(0, 2).join(" or ")}.` : "Very few tables matched that ambition."} They were working with ${sideHcp} combined HCP.`,
            };
        })
        .sort((left, right) => right.spread - left.spread)[0];

    return {
        ...best,
        diagramBoard: best.board,
    };
}
