import fs from "fs";
import path from "path";
import { XMLParser } from "fast-xml-parser";

function asArray(value) {
    if (value === undefined || value === null) {
        return [];
    }
    return Array.isArray(value) ? value : [value];
}

function parseInteger(value) {
    const num = Number.parseInt(String(value ?? "").trim(), 10);
    return Number.isFinite(num) ? num : null;
}

export function loadXmlSession(xmlPath) {
    const parser = new XMLParser({
        ignoreAttributes: false,
        trimValues: true,
    });

    const parsed = parser.parse(fs.readFileSync(xmlPath, "utf8"));
    const event = parsed?.USEBIO?.EVENT;
    if (!event) {
        throw new Error(`Could not find EVENT node in ${xmlPath}`);
    }

    const rankings = asArray(event.PARTICIPANTS?.PAIR).map((pair) => ({
        pos: String(pair.PLACE || ""),
        rank: String(pair.PLACE || ""),
        no: String(pair.PAIR_NUMBER),
        fullNo: String(pair.PAIR_NUMBER),
        players: asArray(pair.PLAYER)
            .map((player) => String(player.PLAYER_NAME || ""))
            .filter(Boolean)
            .join(" & "),
        score: String(pair.PERCENTAGE || ""),
        matchPoints: pair.MASTER_POINTS?.MASTER_POINTS_AWARDED
            ? String(pair.MASTER_POINTS.MASTER_POINTS_AWARDED)
            : "",
        direction: String(pair.DIRECTION || ""),
    }));

    const boards = asArray(event.BOARD).map((board) => ({
        boardNum: String(board.BOARD_NUMBER),
        results: asArray(board.TRAVELLER_LINE).map((line) => {
            const nsScore = parseInteger(line.SCORE) ?? 0;
            return {
                ns: String(line.NS_PAIR_NUMBER),
                ew: String(line.EW_PAIR_NUMBER),
                contract: String(line.CONTRACT || ""),
                declarer: String(line.PLAYED_BY || ""),
                lead: String(line.LEAD || ""),
                tricks: parseInteger(line.TRICKS) ?? 0,
                nsScore,
                ewScore: -nsScore,
                score: nsScore,
                nsMatchPoints: parseInteger(line.NS_MATCH_POINTS) ?? 0,
                ewMatchPoints: parseInteger(line.EW_MATCH_POINTS) ?? 0,
            };
        }),
    }));

    return {
        eventInfo: {
            text: `${String(event.EVENT_DESCRIPTION || "Recovered Session")} - ${String(event.DATE || "")}`.trim(),
            eventId: path.basename(xmlPath).replace(/_xml\.xml$/i, ""),
            date: String(event.DATE || ""),
            sessionType: "",
        },
        rankings,
        boards,
        scorecards: [],
        meta: {
            clubName: String(parsed?.USEBIO?.CLUB?.CLUB_NAME || ""),
            eventDescription: String(event.EVENT_DESCRIPTION || ""),
            eventDate: String(event.DATE || ""),
            programName: String(event.PROGRAM_NAME || ""),
            winnerType: String(event.WINNER_TYPE || ""),
            pairs: parseInteger(event.PAIRS),
            boardsPlayed: parseInteger(event.BOARDS_PLAYED),
        },
    };
}
