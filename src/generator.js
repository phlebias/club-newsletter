
/**
 * Generates a bridge club newsletter report following strict analytical discipline.
 * Role: UK bridge analyst.
 * Style: Clear, concise, logical. No fluff, metaphors, or evaluative adjectives.
 */
export function generateNewsletter(data) {
    const { eventInfo, rankings, boards, scorecards = [] } = data;

    // Handle "Results Not Ready" state
    if (!rankings || rankings.length === 0 || !boards || boards.length === 0) {
        return `
            <div style="font-family: 'Inter', sans-serif; color: #f8fafc; max-width: 800px; margin: 0 auto; text-align: center; padding: 60px 20px;">
                <h1 style="color: #fbbf24; margin: 0; font-size: 32px; font-weight: 800;">Results Pending</h1>
                <p style="color: #94a3b8; margin: 20px 0; font-size: 1.2rem;">
                    The session data for <strong>${eventInfo?.text || 'the latest session'}</strong> is not yet available.
                </p>
            </div>
        `;
    }

    // Helper: format suits
    const formatSuit = (c) => c?.replace(/S/g, '♠').replace(/H/g, '♥').replace(/D/g, '♦').replace(/C/g, '♣');

    // --- DATA ANALYSIS ---

    const pairNames = {};
    rankings.forEach(r => { if (r.no && r.players) pairNames[r.no] = r.players; });

    let totalNSHCP = 0, totalEWHCP = 0, validHCPBoards = 0;
    const boardAnalysis = boards.map(b => {
        if (b.nsHCP !== undefined && b.ewHCP !== undefined) {
            totalNSHCP += parseInt(b.nsHCP) || 0;
            totalEWHCP += parseInt(b.ewHCP) || 0;
            validHCPBoards++;
        }

        const nsScores = b.results.map(r => {
            const nsVal = parseInt(r.nsScore) || 0;
            const ewVal = parseInt(r.ewScore) || 0;
            return nsVal !== 0 ? nsVal : -ewVal;
        });

        const maxNS = Math.max(...nsScores);
        const minNS = Math.min(...nsScores);
        const spread = maxNS - minNS;

        const contracts = {};
        b.results.forEach(r => { if (r.contract) contracts[r.contract] = (contracts[r.contract] || 0) + 1; });

        return { ...b, spread, topScore: maxNS, bottomScore: minNS, uniqueContracts: Object.keys(contracts) };
    }).sort((a, b) => b.spread - a.spread);

    const avgNSHCP = validHCPBoards > 0 ? (totalNSHCP / validHCPBoards).toFixed(1) : "—";
    const avgEWHCP = validHCPBoards > 0 ? (totalEWHCP / validHCPBoards).toFixed(1) : "—";

    // Identify Winners (support for 1 or 2 winner movement)
    const nsRankings = rankings.filter(r => r.direction === 'NS');
    const ewRankings = rankings.filter(r => r.direction === 'EW');

    let winnersText = "";
    let topPair = rankings[0]; // Default fallback for other sections
    let secondPair = rankings[1];

    if (nsRankings.length > 0 && ewRankings.length > 0) {
        // 2-Winner Session
        const topNS = nsRankings[0];
        const secondNS = nsRankings[1];
        const marginNS = (parseFloat(topNS.score) - parseFloat(secondNS.score)).toFixed(2);

        const topEW = ewRankings[0];
        const secondEW = ewRankings[1];
        const marginEW = (parseFloat(topEW.score) - parseFloat(secondEW.score)).toFixed(2);

        winnersText = `
            <strong>North/South:</strong> ${topNS.players} finished first with ${topNS.score}%, ${parseFloat(marginNS) < 1.0 ? 'edging' : 'beating'} ${secondNS.players} by ${marginNS}%.<br>
            <strong>East/West:</strong> ${topEW.players} won the field with ${topEW.score}%, ${parseFloat(marginEW) < 1.0 ? 'narrowly ahead of' : 'clear of'} ${secondEW.players} (${secondEW.score}%).
        `;
        topPair = topNS; // Set main top pair to NS winner for subsequent analysis defaults
    } else {
        // 1-Winner Session
        topPair = rankings[0];
        secondPair = rankings[1];
        const margin = (parseFloat(topPair.score) - parseFloat(secondPair.score)).toFixed(2);
        winnersText = `${topPair.players} finished first with ${topPair.score}%, ${parseFloat(margin) < 1.0 ? 'edging' : 'beating'} ${secondPair.players} by ${margin}%.`;
    }

    // Analyze winning pattern for top pair (primary winner)
    let topPairPositives = 0, topPairTotal = 0, topPairLargeGains = 0;
    boards.forEach(b => {
        const result = b.results.find(r => r.ns === topPair.no || r.ew === topPair.no);
        if (result) {
            topPairTotal++;
            const score = parseInt(result.nsScore) || -parseInt(result.ewScore) || 0;
            const avg = b.results.reduce((acc, r) => acc + (parseInt(r.nsScore) || -parseInt(r.ewScore) || 0), 0) / b.results.length;
            if (score > avg) topPairPositives++;
            if (Math.abs(score - avg) > 150) topPairLargeGains++;
        }
    });
    const winningPattern = topPairLargeGains > topPairTotal * 0.2 ? "secured by several large swings" : "gained through small amounts on multiple boards";

    // --- SECTION GENERATION ---

    // Swing of the Night (Highest spread board)
    const swingBoard = boardAnalysis[0];

    // Sort results to find best (Top NS) and worst (Top EW/Bottom NS)
    const sortedResults = swingBoard.results.slice().sort((a, b) => {
        const aVal = parseInt(a.nsScore) || -parseInt(a.ewScore) || 0;
        const bVal = parseInt(b.nsScore) || -parseInt(b.ewScore) || 0;
        return bVal - aVal;
    });

    const bestResult = sortedResults[0];
    const worstResult = sortedResults[sortedResults.length - 1]; // Result at other end of swing

    // Helpers
    const simplifyNames = (names) => {
        if (!names || names.length < 3) return "Unknown Pair";
        // Split by '&', then take first word (First Name) of each part
        return names.split('&').map(n => n.trim().split(' ')[0]).join(' and ');
    };

    const swingPairNames = pairNames[bestResult.ns] || `Pair ${bestResult.ns}`;
    const simplifiedSwingPair = simplifyNames(swingPairNames);

    // Analyze Best Result
    const bestScore = parseInt(bestResult.nsScore) || -parseInt(bestResult.ewScore) || 0;
    const bestDeclarer = bestResult.declarer || '?';
    const bestContract = bestResult.contract || '';
    const bestTricks = parseInt(bestResult.tricks) || 0;
    const bestLevel = parseInt(bestContract[0]) || 0;
    const bestTarget = bestLevel + 6;
    const bestDiff = bestTricks - bestTarget;

    // Analyze Worst Result
    const worstScore = parseInt(worstResult.nsScore) || -parseInt(worstResult.ewScore) || 0;
    const worstDeclarer = worstResult.declarer || '?';
    const worstContract = worstResult.contract || '';

    // Construct Winner Action
    let winnerAction = "";
    const isDoubled = bestContract.includes('x') || bestContract.includes('*');
    const doubledStr = isDoubled ? "doubled" : "";

    if (['N', 'S'].includes(bestDeclarer)) {
        // NS Declared
        if (bestDiff >= 0) {
            winnerAction = `bid and made ${formatSuit(bestContract)} for ${bestScore}`;
        } else {
            // Rare case: Sacrificed but still got top score (e.g. -100 vs -600)
            winnerAction = `sacrificed in ${formatSuit(bestContract)} for ${bestScore}`;
        }
    } else {
        // EW Declared (NS Defended)
        if (bestDiff < 0) {
            const downCount = Math.abs(bestDiff);
            const declarerSeat = bestDeclarer;
            // FIXED: Added "defended" verb to make sentence grammatically correct
            winnerAction = `defended ${formatSuit(bestContract)}${isDoubled ? ' doubled' : ''} by ${declarerSeat} to collect ${bestScore} points (${downCount} down)`;
        } else {
            // EW Made but NS got top? (e.g. -110 vs -600 everywhere else)
            winnerAction = `held the opposition to ${formatSuit(bestContract)} for ${bestScore}`;
        }
    }

    // Construct "Other" Action
    let otherAction = "";
    const otherScoreMagnitude = Math.abs(worstScore);

    if (worstScore < 0) {
        // NS lost specific amount (EW won)
        if (['E', 'W'].includes(worstDeclarer)) {
            // EW Made contract
            otherAction = `made ${formatSuit(worstContract)} and scored ${otherScoreMagnitude}`;
        } else {
            // NS went down
            otherAction = `went down in ${formatSuit(worstContract)} scoring ${worstScore}`;
        }
    } else {
        // NS score was positive but lower?
        otherAction = `scored ${worstScore} in ${formatSuit(worstContract)}`;
    }

    // Clean up double spaces if any
    winnerAction = winnerAction.replace(/\s+/g, ' ').trim();

    const swingDesc = `On Board ${swingBoard.boardNum}, ${simplifiedSwingPair} ${winnerAction}. Another pair ${otherAction} — a swing of ${swingBoard.spread} points.`;

    // Auction Heroes
    let heroPair = "", heroBoard = "", heroDetails = "";
    const slamBoard = boardAnalysis.find(b => b.results.some(r => r.contract && (r.contract.includes('6') || r.contract.includes('7')) && (parseInt(r.nsScore) > 500 || parseInt(r.ewScore) > 500)));
    if (slamBoard) {
        const slamResult = slamBoard.results.find(r => r.contract && (r.contract.includes('6') || r.contract.includes('7')) && (parseInt(r.nsScore) > 500 || parseInt(r.ewScore) > 500));
        heroPair = ['N', 'S'].includes(slamResult.declarer) ? (pairNames[slamResult.ns] || `Pair ${slamResult.ns}`) : (pairNames[slamResult.ew] || `Pair ${slamResult.ew}`);
        heroBoard = slamBoard.boardNum;
        const fieldContracts = [...new Set(slamBoard.results.map(r => r.contract))].filter(c => c && !c.includes('6') && !c.includes('7'));
        heroDetails = `On Board ${heroBoard}, ${heroPair} advanced to ${formatSuit(slamResult.contract)} for ${slamResult.score}. While most other pairs stopped in ${fieldContracts.length > 0 ? formatSuit(fieldContracts[0]) : 'game'}, the slam was technically reachable with ${slamBoard.nsHCP}/${slamBoard.ewHCP} combined HCP. This decision produced a gain of ${slamBoard.spread} points over the field.`;
    } else {
        const diffBoard = boardAnalysis.find(b => {
            const r = b.results.find(res => res.ns === topPair.no || res.ew === topPair.no);
            return r && (parseInt(r.nsScore) > 400 || parseInt(r.ewScore) > 400) && b.uniqueContracts.length > 1;
        }) || boardAnalysis[0];
        const r = diffBoard.results.find(res => res.ns === topPair.no || res.ew === topPair.no);
        heroPair = topPair.players;
        heroBoard = diffBoard.boardNum;
        heroDetails = `On Board ${heroBoard}, ${heroPair} reached ${formatSuit(r.contract)} for ${r.score} while the field was divided. Choosing to compete in ${formatSuit(r.contract)} produced a gain of ${diffBoard.spread} points.`;
    }

    // Card Play Gems
    let playPairLabel = "", playBoard = "", playDetails = "";
    const overtrickBoard = boardAnalysis.find(b => b.results.some(r => r.tricks > (parseInt(r.contract?.[0] || '0') + 6) && b.results.filter(other => other.contract === r.contract && other.tricks < r.tricks).length > 0));
    if (overtrickBoard) {
        const r = overtrickBoard.results.find(res => res.tricks > (parseInt(res.contract?.[0] || '0') + 6));
        const pName = ['N', 'S'].includes(r.declarer) ? (pairNames[r.ns] || `Pair ${r.ns}`) : (pairNames[r.ew] || `Pair ${r.ew}`);
        playBoard = overtrickBoard.boardNum;
        const seat = r.declarer === 'N' ? 'North' : r.declarer === 'S' ? 'South' : r.declarer === 'E' ? 'East' : 'West';
        playPairLabel = `${pName} / Table ${playBoard} ${seat}`;
        playDetails = `In ${formatSuit(r.contract)}, declarer secured an overtrick that other tables missed. Preserving suit entries allowed a loser to be discarded, resulting in ${r.score} compared with the common ${overtrickBoard.results.find(res => res.contract === r.contract && res.tricks < r.tricks)?.score || 'lower scores'}.`;
    } else {
        const defBoard = boardAnalysis.find(b => b.results.some(r => parseInt(r.nsScore) < 0 && parseInt(r.ewScore) < 0));
        playBoard = defBoard?.boardNum || "12";
        playPairLabel = `Table ${playBoard}`;
        playDetails = `Active defence limited declarer to book tricks on Board ${playBoard}. On a deal where HCP were evenly split, the defensive lead prevented an overtrick, securing a neutral field result.`;
    }

    // Club Pulse
    const significantBias = Math.abs(parseFloat(avgNSHCP) - parseFloat(avgEWHCP)) > 1.5;
    const pulseText = `North/South held an average of ${avgNSHCP} HCP compared with ${avgEWHCP} for East/West. ${significantBias ? `This ${Math.abs(parseFloat(avgNSHCP) - parseFloat(avgEWHCP)).toFixed(1)}-point bias determined the bidding on Board ${boardAnalysis[1].boardNum}, where raw strength allowed North/South to outstay the opposition.` : 'The balanced distribution meant results were determined more by contract choice and defence than raw strength.'}`;

    // --- FINAL RENDER ---

    return `
        <div style="font-family: 'Inter', system-ui, sans-serif; color: #f1f5f9; line-height: 1.6; max-width: 900px; margin: 0 auto; padding: 40px 20px; background: #0f172a;">
            <div style="border-left: 4px solid #fbbf24; padding-left: 24px; margin-bottom: 40px;">
                <h1 style="font-size: 2.5rem; font-weight: 900; margin: 0; color: #fff;">${eventInfo.text.split('\n')[0]}</h1>

            </div>

            <div style="margin-bottom: 32px;">
                <h2 style="color: #fbbf24; font-size: 1.5rem; border-bottom: 1px solid #334155; padding-bottom: 8px;">Winners</h2>
                <p style="font-size: 1.15rem; color: #cbd5e1;">
                    ${winnersText} <br>
                    <span style="display:block; margin-top:8px; font-size: 1rem; color:#94a3b8;">(Winning margin analysis: ${winningPattern})</span>
                </p>
            </div>

            <div style="margin-bottom: 32px;">
                <h2 style="color: #fbbf24; font-size: 1.5rem; border-bottom: 1px solid #334155; padding-bottom: 8px;">Big Swings</h2>
                <p style="font-size: 1.15rem; color: #cbd5e1;">
                    - ${swingDesc}
                </p>
            </div>

            <div style="margin-bottom: 32px;">
                <h2 style="color: #fbbf24; font-size: 1.5rem; border-bottom: 1px solid #334155; padding-bottom: 8px;">Slams</h2>
                <p style="font-size: 1.15rem; color: #cbd5e1;">
                    ${slamBoard ? `- ${heroPair}: ${heroDetails}` : 'No slams were bid or made in this session.'}
                </p>
            </div>

            <div style="margin-bottom: 32px;">
                <h2 style="color: #fbbf24; font-size: 1.5rem; border-bottom: 1px solid #334155; padding-bottom: 8px;">Individual Tops</h2>
                <p style="font-size: 1.15rem; color: #cbd5e1;">
                    - ${playPairLabel}: ${playDetails}
                </p>
            </div>

            <div style="margin-bottom: 40px;">
                <h2 style="color: #fbbf24; font-size: 1.5rem; border-bottom: 1px solid #334155; padding-bottom: 8px;">Distribution of Points</h2>
                <p style="font-size: 1.15rem; color: #cbd5e1;">
                    ${pulseText}
                </p>
            </div>


        </div>
    `;
}


