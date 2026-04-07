
/**
 * Bridge Analysis Module
 * Handles Double Dummy Parsing, Killer Lead detection, and Efficiency metrics.
 */

// PBN Double Dummy Order: North (NT S H D C), South, East, West.
const DENOMINATIONS = ['NT', 'S', 'H', 'D', 'C'];
const DIRECTIONS = ['N', 'S', 'E', 'W']; // PBN Standard Order: North, South, East, West

export function parseDDTricks(abilityStr) {
    if (!abilityStr || abilityStr.length !== 20) return null;
    const strains = ['NT', 'S', 'H', 'D', 'C'];
    const positions = ['N', 'E', 'S', 'W']; // PBN DD Order: North (0-4), East (5-9), South (10-14), West (15-19)
    const result = { N: {}, S: {}, E: {}, W: {} };

    positions.forEach((pos, pIdx) => {
        strains.forEach((strain, sIdx) => {
            const hex = abilityStr[pIdx * 5 + sIdx];
            if (hex) {
                result[pos][strain] = parseInt(hex, 16);
            } else {
                result[pos][strain] = 0;
            }
        });
    });

    return result;
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
        if (expectedTricks > actualTricks && expectedTricks >= contractTarget) {
            killerLeads.push({
                boardNum: board.boardNum,
                nsPair: res.ns,
                ewPair: res.ew,
                type: 'Defense',
                contract: res.contract,
                declarer,
                result: res.score,
                deal: board.hands || board.deal,
                lead: res.lead,
                diff: actualTricks - expectedTricks,
                ddTricks: board.ddTricks,
                optimumScore: board.optimumScore,
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
                deal: board.hands || board.deal,
                lead: res.lead,
                diff: actualTricks - expectedTricks,
                ddTricks: board.ddTricks,
                optimumScore: board.optimumScore,
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

/**
 * Parses a PBN deal string into a structured object.
 * Format: "N:h1 h2 h3 h4" (hands separated by spaces, suits by dots)
 */
export function parsePbnDeal(dealString) {
    if (!dealString) return null;

    const parts = dealString.split(':');
    if (parts.length !== 2) return null;

    const startDir = parts[0].trim();
    const handsText = parts[1].trim().split(' ');
    
    const dirs = ['N', 'E', 'S', 'W'];
    const startIndex = dirs.indexOf(startDir);
    if (startIndex === -1) return null;

    const hands = {};
    handsText.forEach((h, i) => {
        const dir = dirs[(startIndex + i) % 4];
        const suits = h.split('.');
        hands[dir] = {
            S: suits[0] || '',
            H: suits[1] || '',
            D: suits[2] || '',
            C: suits[3] || ''
        };
    });

    return hands;
}

// parseAbility removed in favor of parseDDTricks

export function getOptimalContract(abilityStr, optimumScoreStr = "") {
    const ability = parseDDTricks(abilityStr);
    if (!ability) return null;

    let bestScore = -1;
    let bestContract = "";
    let bestTricks = 0;
    let bestPos = "";
    let bestStrain = "";

    const strains = ['NT', 'S', 'H', 'D', 'C'];
    const positions = ['N', 'E', 'S', 'W'];
    const strainScores = { 'NT': 100, 'S': 90, 'H': 80, 'D': 70, 'C': 60 };

    positions.forEach(pos => {
        strains.forEach(strain => {
            const tricks = ability[pos][strain];
            if (tricks >= 7) {
                const level = tricks - 6;
                const score = (tricks * 1000) + (strainScores[strain] || 0);

                if (score > bestScore) {
                    bestScore = score;
                    bestTricks = tricks;
                    bestPos = pos;
                    bestStrain = strain;
                    const strainSym = strain.replace('S', '♠').replace('H', '♥').replace('D', '♦').replace('C', '♣');
                    bestContract = `${level}${strainSym}`;
                }
            }
        });
    });

    if (!bestContract) return null;

    return {
        label: `${bestContract} by ${bestPos}`,
        full: `Suggested: ${bestContract} by ${bestPos} (${bestTricks} tricks)`,
        tricks: bestTricks,
        contract: bestContract,
        pos: bestPos
    };
}

/**
 * Renders an elegant HTML hand diagram for a parsed deal.
 */
export function renderHandDiagram(hands, boardNum = "", ddTricks = "", optimumScore = "") {
    if (!hands) return '';

    const optimal = (ddTricks || optimumScore) ? getOptimalContract(ddTricks, optimumScore) : null;
    const bidTip = optimal ? optimal.full : "";
    const bidLabel = optimal ? optimal.label : "";

    const formatHand = (dir) => {
        const h = hands[dir];
        if (!h) return '';
        return `
            <div style="font-family: 'Inter', monospace; font-size: 0.95rem; line-height: 1.3;">
                <div style="font-weight: 800; color: #fbbf24; margin-bottom: 4px; text-decoration: underline;">${dir}</div>
                <div style="color: #cbd5e1;"><span style="color: #fff; display: inline-block; width: 15px;">♠</span> ${h.S || '—'}</div>
                <div style="color: #cbd5e1;"><span style="color: #f87171; display: inline-block; width: 15px;">♥</span> ${h.H || '—'}</div>
                <div style="color: #cbd5e1;"><span style="color: #fbbf24; display: inline-block; width: 15px;">♦</span> ${h.D || '—'}</div>
                <div style="color: #cbd5e1;"><span style="color: #60a5fa; display: inline-block; width: 15px;">♣</span> ${h.C || '—'}</div>
            </div>
        `;
    };

    return `
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; background: rgba(15, 23, 42, 0.6); padding: 15px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.1); margin: 15px 0; max-width: 400px; line-height: 1.2;">
            <div style="grid-column: 2; grid-row: 1; justify-self: center;">${formatHand('N')}</div>
            <div style="grid-column: 1; grid-row: 2; align-self: center;">${formatHand('W')}</div>
            <div style="grid-column: 2; grid-row: 2; align-self: center; justify-self: center; text-align: center;">
                <div title="${bidTip}" style="font-weight: 900; color: #fbbf24; font-size: 0.9rem; background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 6px; cursor: help; border: 1px solid rgba(251, 191, 36, 0.3);" onmouseover="this.style.background='rgba(251, 191, 36, 0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                    Board ${boardNum}
                </div>
                ${bidLabel ? `<div style="font-size: 0.65rem; color: #94a3b8; font-family: 'Inter', sans-serif; margin-top: 4px; font-style: italic; white-space: nowrap;">${bidLabel}</div>` : ''}
            </div>
            <div style="grid-column: 3; grid-row: 2; align-self: center;">${formatHand('E')}</div>
            <div style="grid-column: 2; grid-row: 3; justify-self: center;">${formatHand('S')}</div>
        </div>
    `;
}
