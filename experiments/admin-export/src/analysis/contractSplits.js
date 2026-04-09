function formatSuit(contract) {
    return String(contract || "")
        .replace(/S/g, "♠")
        .replace(/H/g, "♥")
        .replace(/D/g, "♦")
        .replace(/C/g, "♣");
}

function directionalScore(result) {
    const nsScore = Number.parseInt(result?.nsScore, 10);
    const ewScore = Number.parseInt(result?.ewScore, 10);
    const score = Number.isFinite(nsScore) ? nsScore : (Number.isFinite(ewScore) ? -ewScore : 0);
    return ["N", "S"].includes(result?.declarer) ? score : -score;
}

function formatOutcome(result) {
    if (!result) {
        return "?";
    }

    const score = directionalScore(result);
    const contractLevel = Number.parseInt(String(result.contract || "")[0], 10) || 0;
    const tricks = Number.parseInt(result.tricks, 10) || 0;
    const diff = tricks - (contractLevel + 6);
    const outcome = diff >= 0 ? "making" : `down ${Math.abs(diff)}`;
    return `${score > 0 ? `+${score}` : score} (${result.declarer || "?"} ${outcome})`;
}

function summarizeContract(results, contract) {
    const contractResults = results.filter((result) => result.contract === contract);
    if (contractResults.length === 0) {
        return null;
    }

    const best = contractResults.reduce((bestSoFar, current) => {
        return directionalScore(current) > directionalScore(bestSoFar) ? current : bestSoFar;
    }, contractResults[0]);

    const scores = new Set(contractResults.map((result) => directionalScore(result)));
    return {
        contract,
        tables: contractResults.length,
        best,
        varies: scores.size > 1,
    };
}

export function findContractSplitBoard(sessionData) {
    const boards = sessionData.boards || [];

    const candidate = boards.find((board) => {
        const counts = {};
        board.results.forEach((result) => {
            if (result.contract) {
                counts[result.contract] = (counts[result.contract] || 0) + 1;
            }
        });
        return Object.values(counts).filter((count) => count >= 2).length >= 2;
    });

    if (!candidate) {
        return null;
    }

    const counts = {};
    candidate.results.forEach((result) => {
        if (result.contract) {
            counts[result.contract] = (counts[result.contract] || 0) + 1;
        }
    });

    const popularContracts = Object.keys(counts)
        .filter((contract) => counts[contract] >= 2)
        .sort((left, right) => counts[right] - counts[left]);

    const primary = summarizeContract(candidate.results, popularContracts[0]);
    const secondary = summarizeContract(candidate.results, popularContracts[1]);
    if (!primary || !secondary) {
        return null;
    }

    const primaryText = primary.varies ? `up to ${formatOutcome(primary.best)}` : formatOutcome(primary.best);
    const secondaryText = secondary.varies ? `up to ${formatOutcome(secondary.best)}` : formatOutcome(secondary.best);

    return {
        boardNum: candidate.boardNum,
        primary,
        secondary,
        summary: `Board ${candidate.boardNum} split the room between ${formatSuit(primary.contract)} at ${primary.tables} table(s), scoring ${primaryText}, and ${formatSuit(secondary.contract)} at ${secondary.tables} table(s), scoring ${secondaryText}.`,
    };
}
