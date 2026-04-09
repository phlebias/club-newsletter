function formatSuit(contract) {
    return String(contract || "")
        .replace(/S/g, "♠")
        .replace(/H/g, "♥")
        .replace(/D/g, "♦")
        .replace(/C/g, "♣");
}

function parseScore(result) {
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

function formatPairName(pairNames, result) {
    const pairNo = ["N", "S"].includes(result?.declarer) ? result?.ns : result?.ew;
    return pairNames[pairNo] || `Pair ${pairNo}`;
}

export function findSameContractPlaySwing(sessionData) {
    const rankings = sessionData.rankings || [];
    const boards = sessionData.boards || [];
    const pairNames = {};

    rankings.forEach((ranking) => {
        if (ranking.no && ranking.players) {
            pairNames[ranking.no] = ranking.players;
        }
    });

    const candidate = boards.find((board) => board.results.some((result) => {
        const contractLevel = Number.parseInt(String(result.contract || "")[0], 10);
        const target = Number.isFinite(contractLevel) ? contractLevel + 6 : null;
        if (!target || !result.contract) {
            return false;
        }

        return Number.parseInt(result.tricks, 10) > target
            && board.results.filter((other) => other.contract === result.contract && Number.parseInt(other.tricks, 10) < Number.parseInt(result.tricks, 10)).length > 0;
    }));

    if (!candidate) {
        return null;
    }

    const winningResult = candidate.results.find((result) => {
        const contractLevel = Number.parseInt(String(result.contract || "")[0], 10);
        const target = Number.isFinite(contractLevel) ? contractLevel + 6 : null;
        if (!target || !result.contract) {
            return false;
        }

        return Number.parseInt(result.tricks, 10) > target
            && candidate.results.filter((other) => other.contract === result.contract && Number.parseInt(other.tricks, 10) < Number.parseInt(result.tricks, 10)).length > 0;
    });

    if (!winningResult) {
        return null;
    }

    const comparison = candidate.results.find((other) => other.contract === winningResult.contract && Number.parseInt(other.tricks, 10) < Number.parseInt(winningResult.tricks, 10));
    if (!comparison) {
        return null;
    }

    const winnerName = formatPairName(pairNames, winningResult);
    const winnerScore = parseScore(winningResult);
    const comparisonScore = parseScore(comparison);

    return {
        boardNum: candidate.boardNum,
        contract: winningResult.contract,
        winnerName,
        winnerScore,
        comparisonScore,
        overtricks: Number.parseInt(winningResult.tricks, 10) - (Number.parseInt(String(winningResult.contract || "")[0], 10) + 6),
        summary: `Board ${candidate.boardNum} produced a same-contract swing in ${formatSuit(winningResult.contract)}: ${winnerName} took an extra trick for ${winnerScore}, while another table finished with ${comparisonScore} in the same contract.`,
    };
}
