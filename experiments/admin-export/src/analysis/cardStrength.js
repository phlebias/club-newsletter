export function summarizeCardStrength(sessionData) {
    const boards = sessionData?.boards || [];
    const hcpBoards = boards.filter((board) =>
        board.nsHCP !== undefined
        && board.ewHCP !== undefined
        && (Number.parseInt(board.nsHCP, 10) || 0) + (Number.parseInt(board.ewHCP, 10) || 0) >= 35
    );

    if (hcpBoards.length === 0) {
        return null;
    }

    const totals = hcpBoards.reduce((acc, board) => {
        const nsHCP = Number.parseInt(board.nsHCP, 10) || 0;
        const ewHCP = Number.parseInt(board.ewHCP, 10) || 0;
        acc.ns += nsHCP;
        acc.ew += ewHCP;
        if (Math.abs(nsHCP - ewHCP) <= 2) {
            acc.flat += 1;
        }
        if (Math.max(nsHCP, ewHCP) >= 24) {
            acc.gameValues += 1;
        }
        return acc;
    }, { ns: 0, ew: 0, flat: 0, gameValues: 0 });

    const avgNS = (totals.ns / hcpBoards.length).toFixed(1);
    const avgEW = (totals.ew / hcpBoards.length).toFixed(1);
    const diff = Math.abs(parseFloat(avgNS) - parseFloat(avgEW));

    const headline = diff < 1.0
        ? `The cards were broadly even across the room: North/South averaged ${avgNS} HCP and East/West ${avgEW}.`
        : `${parseFloat(avgNS) > parseFloat(avgEW) ? "North/South" : "East/West"} held the stronger average set of cards, ${Math.max(parseFloat(avgNS), parseFloat(avgEW)).toFixed(1)} HCP to ${Math.min(parseFloat(avgNS), parseFloat(avgEW)).toFixed(1)}.`;

    const context = totals.flat >= Math.ceil(hcpBoards.length * 0.45)
        ? `With ${totals.flat} boards within 2 HCP, many results were decided more by judgement and technique than by sheer strength.`
        : `There were enough uneven deals to create real pressure on bidding judgement when one side held a clear strength edge.`;

    const ceiling = totals.gameValues > Math.floor(hcpBoards.length * 0.4)
        ? `There were ${totals.gameValues} boards with game-going values, so the session offered plenty of chances to win or lose a board in the auction.`
        : `This was not an especially high-ceiling set on points alone, so steady part-score decisions mattered.`;

    return {
        headline,
        context,
        ceiling,
    };
}
