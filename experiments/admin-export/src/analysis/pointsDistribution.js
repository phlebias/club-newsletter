function toNumber(value) {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
}

export function analyzePointsDistribution(sessionData) {
    const boards = sessionData?.boards || [];
    const hcpBoards = boards.filter((board) =>
        board.nsHCP !== undefined
        && board.ewHCP !== undefined
        && (toNumber(board.nsHCP) + toNumber(board.ewHCP)) >= 35
    );

    if (hcpBoards.length === 0) {
        return null;
    }

    const totals = hcpBoards.reduce((acc, board) => {
        const nsHCP = toNumber(board.nsHCP);
        const ewHCP = toNumber(board.ewHCP);
        const diff = nsHCP - ewHCP;

        acc.nsTotal += nsHCP;
        acc.ewTotal += ewHCP;

        if (Math.abs(diff) <= 2) {
            acc.balancedBoards += 1;
        }
        if (Math.abs(diff) >= 8) {
            acc.skewBoards += 1;
        }
        if (nsHCP >= 24) {
            acc.nsGameBoards += 1;
        }
        if (ewHCP >= 24) {
            acc.ewGameBoards += 1;
        }
        if (nsHCP >= 31) {
            acc.nsSlamBoards += 1;
        }
        if (ewHCP >= 31) {
            acc.ewSlamBoards += 1;
        }

        return acc;
    }, {
        nsTotal: 0,
        ewTotal: 0,
        balancedBoards: 0,
        skewBoards: 0,
        nsGameBoards: 0,
        ewGameBoards: 0,
        nsSlamBoards: 0,
        ewSlamBoards: 0,
    });

    const avgNS = (totals.nsTotal / hcpBoards.length).toFixed(1);
    const avgEW = (totals.ewTotal / hcpBoards.length).toFixed(1);
    const diff = Math.abs(parseFloat(avgNS) - parseFloat(avgEW));

    let headline = `Across ${hcpBoards.length} boards with HCP data, North/South averaged ${avgNS} HCP and East/West ${avgEW}.`;
    if (diff < 1.0) {
        headline += " The overall points were very evenly shared.";
    } else {
        headline += ` That gave a modest overall tilt to ${parseFloat(avgNS) > parseFloat(avgEW) ? "North/South" : "East/West"}.`;
    }

    const opportunityText = `Game-going values appeared on ${totals.nsGameBoards} boards for North/South and ${totals.ewGameBoards} for East/West, with slam-range values on ${totals.nsSlamBoards} and ${totals.ewSlamBoards} boards respectively.`;

    let textureText = "";
    if (totals.balancedBoards >= Math.ceil(hcpBoards.length * 0.45)) {
        textureText = `A large share of the set was closely balanced on points (${totals.balancedBoards} boards within 2 HCP), so the room was often separated by bidding judgement and card play rather than raw strength.`;
    } else if (totals.skewBoards >= Math.ceil(hcpBoards.length * 0.25)) {
        textureText = `There were ${totals.skewBoards} boards with an 8+ HCP imbalance, so several results were driven by one side simply holding a clear strength advantage.`;
    } else {
        textureText = `The session mixed a few clear strength-driven boards with a larger number of competitive part-score hands.`;
    }

    return {
        headline,
        opportunityText,
        textureText,
    };
}
