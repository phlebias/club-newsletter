
/**
 * Bridge Analysis Module
 * Handles Double Dummy Parsing, Killer Lead detection, and Efficiency metrics.
 */

// PBN Double Dummy Order: North (NT S H D C), South, East, West.
const DENOMINATIONS = ['NT', 'S', 'H', 'D', 'C'];
const DIRECTIONS = ['N', 'S', 'E', 'W']; // PBN Standard Order: North, South, East, West

export function parseDDTricks(ddString) {
    if (!ddString || ddString.length !== 20) return null;

    const analysis = { N: {}, S: {}, E: {}, W: {} };
    let idx = 0;

    for (const denom of DENOMINATIONS) {
        for (const dir of DIRECTIONS) {
            const char = ddString[idx];
            let tricks = 0;
            if (char >= '0' && char <= '9') tricks = parseInt(char);
            else if (char === 'a' || char === 'A') tricks = 10;
            else if (char === 'b' || char === 'B') tricks = 11;
            else if (char === 'c' || char === 'C') tricks = 12;
            else if (char === 'd' || char === 'D') tricks = 13;

            analysis[dir][denom] = tricks;
            idx++;
        }
    }
    return analysis;
}

export function getParScore(board, vulnerability) {
    // If PBN provided OptimumScore, parse it: e.g. "NS 400" or "EW -200"
    if (board.optimumScore) {
        const parts = board.optimumScore.split(' ');
        if (parts.length === 2) {
            const side = parts[0];
            const score = parseInt(parts[1]);
            return side === 'NS' ? score : -score; // Return NS perspective
        }
    }

    // Fallback: Calculate Par from DDTricks (Complex, skipping for now unless needed)
    return null;
}

export function analyzeKillerLeads(board) {
    if (!board.ddTricks) return [];

    const dd = parseDDTricks(board.ddTricks);
    if (!dd) return [];

    const killerLeads = [];

    board.results.forEach(res => {
        if (res.contract === 'PASS') return;

        // Parse contract
        const level = parseInt(res.contract[0]);
        const suit = res.contract.substring(1, 2) === 'N' ? 'NT' : res.contract.substring(1, 2); // S, H, D, C
        const declarer = res.declarer || '?';

        // Expected tricks for DECLARER
        const expectedTricks = dd[declarer]?.[suit];

        if (expectedTricks === undefined) return; // Should not happen if data is valid

        const actualTricks = parseInt(res.tricks);
        if (isNaN(actualTricks)) return;

        const contractTarget = level + 6;

        // --- Killer Defense Scenario ---
        // Condition: The contract *should* make (Par >= Target), but it went down (Actual < Target).
        // This implies the defense found a way to stop a makable contract.
        if (expectedTricks >= contractTarget && actualTricks < contractTarget) {
            killerLeads.push({
                boardNum: board.boardNum,
                nsPair: res.ns,
                ewPair: res.ew,
                type: 'Defense',
                contract: res.contract,
                declarer,
                result: res.score,
                lead: res.lead,
                diff: actualTricks - expectedTricks,
                desc: `Computer predicted ${expectedTricks} tricks (making), but the defense found the way to hold it to ${actualTricks}.`
            });
        }

        // --- Miracle Make Scenario (Declarer Hero) ---
        // Condition: The contract *should* go down (Par < Target), but it made (Actual >= Target).
        // This implies the declarer found a way to make an unmakable contract (or defense slipped).
        else if (expectedTricks < contractTarget && actualTricks >= contractTarget) {
            killerLeads.push({
                boardNum: board.boardNum,
                nsPair: res.ns,
                ewPair: res.ew,
                type: 'Declarer',
                contract: res.contract,
                declarer,
                result: res.score,
                lead: res.lead,
                diff: actualTricks - expectedTricks,
                desc: `Computer says this contract fails (Par: ${expectedTricks}), yet Declarer somehow brought home ${actualTricks}.`
            });
        }
    });

    return killerLeads;
}

/**
 * Calculates efficiency: Realized Score vs Par Score (if available)
 * Or simple HCP conversion.
 */
export function analyzeEfficiency(boards, pairNames) {
    const stats = {};

    boards.forEach(b => {
        if (!b.ddTricks) return;
        const dd = parseDDTricks(b.ddTricks);

        b.results.forEach(r => {
            const isNS = ['N', 'S'].includes(r.declarer); // Declarer view
            const parTricks = dd?.[r.declarer]?.[r.contract.substring(1, 2) === 'N' ? 'NT' : r.contract.substring(1, 2)];
            if (parTricks === undefined) return;

            const actualTricks = parseInt(r.tricks);
            const diff = actualTricks - parTricks;

            // Assign to declarer pair
            const declPair = ['N', 'S'].includes(r.declarer) ? r.ns : r.ew;

            if (!stats[declPair]) stats[declPair] = { totalDiff: 0, count: 0, overtricks: 0, undertricks: 0 };

            stats[declPair].totalDiff += diff;
            stats[declPair].count++;
            if (diff > 0) stats[declPair].overtricks++;
            if (diff < 0) stats[declPair].undertricks++;
        });
    });

    // Convert to array
    return Object.keys(stats).map(pair => ({
        pair,
        name: pairNames[pair] || `Pair ${pair}`,
        avgDiff: (stats[pair].totalDiff / stats[pair].count).toFixed(2),
        count: stats[pair].count
    })).sort((a, b) => parseFloat(b.avgDiff) - parseFloat(a.avgDiff));
}
