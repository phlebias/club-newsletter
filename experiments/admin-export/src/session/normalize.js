function compareBoardNumbers(a, b) {
    return Number(a.boardNum) - Number(b.boardNum);
}

export function normalizeRecoverSession({ xmlSession, pbnBoards }) {
    const boards = xmlSession.boards
        .map((board) => ({
            ...board,
            ...(pbnBoards[board.boardNum] || {}),
            boardNum: board.boardNum,
        }))
        .sort(compareBoardNumbers);

    const xmlBoardCount = xmlSession.boards.length;
    const pbnBoardCount = Object.keys(pbnBoards).length;

    const warnings = [];
    if (xmlSession.meta.boardsPlayed && xmlSession.meta.boardsPlayed !== boards.length) {
        warnings.push({
            code: "board_count_mismatch",
            message: `XML reports ${xmlSession.meta.boardsPlayed} boards played, but ${boards.length} boards were normalized.`,
        });
    }
    if (pbnBoardCount > 0 && pbnBoardCount !== boards.length) {
        warnings.push({
            code: "pbn_xml_board_count_mismatch",
            message: `Recovered PBN contains ${pbnBoardCount} boards while the normalized session contains ${boards.length}.`,
        });
    }

    return {
        source: "recover",
        eventInfo: xmlSession.eventInfo,
        rankings: xmlSession.rankings,
        boards,
        scorecards: xmlSession.scorecards,
        meta: {
            ...xmlSession.meta,
            xmlBoardCount,
            pbnBoardCount,
        },
        quality: {
            hasTravellerLines: boards.some((board) => board.results.length > 0),
            hasPbn: pbnBoardCount > 0,
            hasDd: boards.some((board) => Boolean(board.ddTricks)),
            hasScorecardEquivalent: false,
            warnings,
        },
    };
}
