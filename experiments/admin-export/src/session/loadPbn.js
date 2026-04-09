import fs from "fs";

function cardHcp(cards) {
    let total = 0;
    for (const card of cards) {
        if (card === "A") total += 4;
        else if (card === "K") total += 3;
        else if (card === "Q") total += 2;
        else if (card === "J") total += 1;
    }
    return total;
}

function parseDealHands(deal) {
    if (!deal || !deal.includes(":")) {
        return null;
    }

    const [startDir, handsText] = deal.split(":");
    const dirs = ["N", "E", "S", "W"];
    const startIdx = dirs.indexOf(startDir.trim());
    if (startIdx === -1) {
        return null;
    }

    const rawHands = handsText.trim().split(/\s+/);
    const hands = {};

    rawHands.forEach((raw, idx) => {
        const dir = dirs[(startIdx + idx) % 4];
        const [spades = "", hearts = "", diamonds = "", clubs = ""] = raw.split(".");
        hands[dir] = {
            S: spades,
            H: hearts,
            D: diamonds,
            C: clubs,
        };
    });

    return hands;
}

function computeHcp(deal) {
    const hands = parseDealHands(deal);
    if (!hands) {
        return {
            nHCP: 0,
            sHCP: 0,
            eHCP: 0,
            wHCP: 0,
            nsHCP: 0,
            ewHCP: 0,
        };
    }

    const countFor = (dir) => {
        const hand = hands[dir];
        return cardHcp(hand.S) + cardHcp(hand.H) + cardHcp(hand.D) + cardHcp(hand.C);
    };

    const nHCP = countFor("N");
    const sHCP = countFor("S");
    const eHCP = countFor("E");
    const wHCP = countFor("W");

    return {
        nHCP,
        sHCP,
        eHCP,
        wHCP,
        nsHCP: nHCP + sHCP,
        ewHCP: eHCP + wHCP,
    };
}

export function loadPbnBoards(pbnPath) {
    const pbn = fs.readFileSync(pbnPath, "utf8");
    const chunks = pbn.split(/\n(?=\[Event )/g).filter(Boolean);
    const byBoard = {};

    for (const chunk of chunks) {
        const boardNum = chunk.match(/\[Board "([^"]+)"\]/)?.[1];
        if (!boardNum) {
            continue;
        }

        const deal = chunk.match(/\[Deal "([^"]*)"\]/)?.[1] || "";
        const hcp = computeHcp(deal);

        byBoard[String(boardNum)] = {
            boardNum: String(boardNum),
            deal,
            hands: deal,
            dealer: chunk.match(/\[Dealer "([^"]*)"\]/)?.[1] || "",
            vuln: chunk.match(/\[Vulnerable "([^"]*)"\]/)?.[1] || "",
            ddTricks: chunk.match(/\[DoubleDummyTricks "([^"]*)"\]/)?.[1] || null,
            optimumScore: null,
            ...hcp,
        };
    }

    return byBoard;
}
