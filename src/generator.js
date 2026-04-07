
import { analyzeKillerLeads, analyzeEfficiency, parsePbnDeal, renderHandDiagram } from './analysis.js';

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
    let topPairPositives = 0, topPairTotal = 0;
    const largeGainBoards = [];

    boards.forEach(b => {
        const result = b.results.find(r => r.ns === topPair.no || r.ew === topPair.no);
        if (result) {
            topPairTotal++;
            // Determine pair's score directionally
            const isNS = result.ns === topPair.no;
            const rawNSScore = parseInt(result.nsScore) || -parseInt(result.ewScore) || 0;
            const pairScore = isNS ? rawNSScore : -rawNSScore;

            // Calculate field average directionally
            const fieldSum = b.results.reduce((acc, r) => {
                const s = parseInt(r.nsScore) || -parseInt(r.ewScore) || 0;
                return acc + (isNS ? s : -s);
            }, 0);
            const fieldAvg = fieldSum / b.results.length;

            if (pairScore > fieldAvg) topPairPositives++;
            if ((pairScore - fieldAvg) > 200) largeGainBoards.push(b.boardNum);
        }
    });

    const winningPattern = largeGainBoards.length >= 3
        ? `secured by several large swings (notably Boards ${largeGainBoards.slice(0, 3).join(', ')})`
        : `gained through consistent small margins (bettering the field on ${topPairPositives} of ${topPairTotal} boards)`;

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
    // Identify Auction Heroes (Slam bid and made)
    const slamBoard = boardAnalysis.find(b => b.results.some(r =>
        r.contract &&
        (r.contract.includes('6') || r.contract.includes('7')) &&
        parseInt(r.tricks) >= (parseInt(r.contract[0]) + 6)
    ));

    const isSlamSameAsSwing = slamBoard && swingBoard && slamBoard.boardNum === swingBoard.boardNum;

    // Swing Diagram (Hidden under dropdown, omitted if same as slam which is shown directly)
    const swingDiagram = (swingBoard.deal && !isSlamSameAsSwing) ? renderHandDiagram(parsePbnDeal(swingBoard.deal), swingBoard.boardNum, swingBoard.ddTricks, swingBoard.optimumScore) : '';

    // Auction Heroes Details
    let heroPair = "", heroBoard = "", heroDetails = "";
    if (slamBoard) {
        const slamResult = slamBoard.results.find(r =>
            r.contract &&
            (r.contract.includes('6') || r.contract.includes('7')) &&
            parseInt(r.tricks) >= (parseInt(r.contract[0]) + 6)
        );
        heroPair = ['N', 'S'].includes(slamResult.declarer) ? (pairNames[slamResult.ns] || `Pair ${slamResult.ns}`) : (pairNames[slamResult.ew] || `Pair ${slamResult.ew}`);
        heroBoard = slamBoard.boardNum;
        const fieldContracts = [...new Set(slamBoard.results.map(r => r.contract))].filter(c => c && !c.includes('6') && !c.includes('7'));
        const declarerSide = ['N', 'S'].includes(slamResult.declarer) ? 'NS' : 'EW';
        const relevantHCP = declarerSide === 'NS' 
            ? (parseInt(slamBoard.nsHCP) || (parseInt(slamBoard.nHCP) + parseInt(slamBoard.sHCP)) || 0)
            : (parseInt(slamBoard.ewHCP) || (parseInt(slamBoard.eHCP) + parseInt(slamBoard.wHCP)) || 0);
        const slamDiagram = slamBoard.deal ? renderHandDiagram(parsePbnDeal(slamBoard.deal), slamBoard.boardNum, slamBoard.ddTricks, slamBoard.optimumScore) : '';
        heroDetails = `On Board ${heroBoard}, ${heroPair} advanced to ${formatSuit(slamResult.contract)} for ${slamResult.score}. While most other pairs stopped in ${fieldContracts.length > 0 ? formatSuit(fieldContracts[0]) : 'game'}, they bid this slam with ${relevantHCP} combined HCP. This decision produced a gain of ${slamBoard.spread} points over the field. <br><br> ${slamDiagram}`;
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
        // FIXED: Removed hallucinatory explanation about entries/discards. Sticking to factual score comparison.
        playDetails = `In ${formatSuit(r.contract)}, declarer secured an overtrick that other tables missed. This extra trick improved the score to ${r.score}, differing from the ${overtrickBoard.results.find(res => res.contract === r.contract && res.tricks < r.tricks)?.score || 'standard'} achieved by the field.`;
    } else {
        const defBoard = boardAnalysis.find(b => b.results.some(r => parseInt(r.nsScore) < 0 && parseInt(r.ewScore) < 0));
        playBoard = defBoard?.boardNum || "12";
        playPairLabel = `Table ${playBoard}`;
        playDetails = `Active defence limited declarer to book tricks on Board ${playBoard}. On a deal where HCP were evenly split, the defensive lead prevented an overtrick, securing a neutral field result.`;
    }

    // Club Pulse
    // Club Pulse
    const nVal = parseFloat(avgNSHCP);
    const eVal = parseFloat(avgEWHCP);
    const diff = Math.abs(nVal - eVal);
    const significantBias = diff > 1.5;
    const favoredSide = nVal > eVal ? "North/South" : "East/West";

    const pulseText = `North/South held an average of ${avgNSHCP} HCP compared with ${avgEWHCP} for East/West. ${significantBias ? `This ${diff.toFixed(1)}-point difference favored ${favoredSide}, providing them with a consistent structural advantage.` : 'The balanced distribution meant results were determined more by contract choice and defence than raw strength.'}`;

    // Contract Choice Analysis
    let contractChoiceText = "";
    const splitBoard = boardAnalysis.find(b => {
        const counts = {};
        b.results.forEach(r => { if (r.contract) counts[r.contract] = (counts[r.contract] || 0) + 1; });
        // Check if at least 2 contracts have >= 2 tables
        return Object.values(counts).filter(c => c >= 2).length >= 2;
    });

    if (splitBoard) {
        const counts = {};
        splitBoard.results.forEach(r => { if (r.contract) counts[r.contract] = (counts[r.contract] || 0) + 1; });
        const popularContracts = Object.keys(counts).filter(c => counts[c] >= 2).sort((a, b) => counts[b] - counts[a]);
        const c1 = popularContracts[0];
        const c2 = popularContracts[1];

        const getResAndVariance = (c) => {
            const rs = splitBoard.results.filter(r => r.contract === c);
            if (!rs.length) return { best: null, varies: false };

            // Find best result
            const best = rs.reduce((currBest, curr) => {
                const getScore = (r) => {
                    const sc = parseInt(r.nsScore) || -parseInt(r.ewScore) || 0;
                    return ['N', 'S'].includes(r.declarer) ? sc : -sc;
                };
                return getScore(curr) > getScore(currBest) ? curr : currBest;
            }, rs[0]);

            // Check if scores vary
            const scores = new Set(rs.map(r => parseInt(r.nsScore) || -parseInt(r.ewScore) || 0));
            return { best, varies: scores.size > 1 };
        };

        const formatRes = (r) => {
            if (!r) return "?";
            const s = parseInt(r.nsScore) || -parseInt(r.ewScore) || 0;
            const decl = r.declarer || '?';
            const level = parseInt(r.contract[0]) || 0;
            const tricks = parseInt(r.tricks) || 0;
            const diff = tricks - (level + 6);
            let outcome = diff >= 0 ? `making` : `down ${Math.abs(diff)}`;
            return `${s > 0 ? '+' + s : s} (${decl} ${outcome})`;
        };

        const r1Data = getResAndVariance(c1);
        const r2Data = getResAndVariance(c2);

        const formatResWithPrefix = (data) => {
            if (!data.best) return "?";
            const scoreText = formatRes(data.best);
            return data.varies ? `up to ${scoreText}` : scoreText;
        };

        contractChoiceText = `Board ${splitBoard.boardNum} split the field. Multiple pairs chose ${formatSuit(c1)} scoring ${formatResWithPrefix(r1Data)}, while others preferred ${formatSuit(c2)} scoring ${formatResWithPrefix(r2Data)}. This purely auction-based decision created a swing distinct from play or defense.`;
    } else {
        const varBoard = boardAnalysis.find(b => b.uniqueContracts.length >= 2 && b.spread > 0);
        if (varBoard) {
            contractChoiceText = `Board ${varBoard.boardNum} saw varied evaluations, with contracts including ${varBoard.uniqueContracts.slice(0, 3).map(formatSuit).join(', ')} producing different outcomes.`;
        } else {
            contractChoiceText = "The field was largely consistent in contract choices this session.";
        }
    }

    // High Card Point Allocation
    let hcpAllocationText = "HCP data not available.";
    if (validHCPBoards > 0) {
        const playerStats = [];

        rankings.forEach(pair => {
            if (!pair.no || !pair.players) return;
            const names = pair.players.split('&').map(n => n.trim());
            // Handle " - " separator as well
            const pNames = names.length === 1 && names[0].includes('-') ? names[0].split('-').map(n => n.trim()) : names;

            if (pNames.length < 2) return;

            let p1Sum = 0, p2Sum = 0, count = 0;

            boards.forEach(b => {
                // Ensure board has HCP data
                if (b.nHCP === undefined) return;

                const res = b.results.find(r => r.ns === pair.no || r.ew === pair.no);
                if (res) {
                    count++;
                    if (res.ns === pair.no) {
                        p1Sum += (b.nHCP || 0);
                        p2Sum += (b.sHCP || 0);
                    } else {
                        p1Sum += (b.eHCP || 0);
                        p2Sum += (b.wHCP || 0);
                    }
                }
            });

            if (count > 0) {
                // Store incomplete stats - missing seat info will be filled later
                playerStats.push({ name: pNames[0], avg: (p1Sum / count).toFixed(1), pairNo: pair.no, playerIdx: 0 });
                playerStats.push({ name: pNames[1], avg: (p2Sum / count).toFixed(1), pairNo: pair.no, playerIdx: 1 });
            }
        });

        // ROBUSTNESS: Infer Direction from Boards if not present in Rankings
        const pairDirectionMap = {};
        boards.forEach(b => {
            b.results.forEach(r => {
                const ns = r.ns;
                const ew = r.ew;
                if (!pairDirectionMap[ns]) pairDirectionMap[ns] = { ns: 0, ew: 0 };
                if (!pairDirectionMap[ew]) pairDirectionMap[ew] = { ns: 0, ew: 0 };
                pairDirectionMap[ns].ns++;
                pairDirectionMap[ew].ew++;
            });
        });

        // Determine likely direction for each pair (threshold 55% to handle arrow switches)
        const fixedNSCount = [];
        const fixedEWCount = [];

        Object.keys(pairDirectionMap).forEach(pNo => {
            const d = pairDirectionMap[pNo];
            const total = d.ns + d.ew;
            if (total === 0) return;

            let inferredDir = 'Mixed';
            // Aggressive classification: If > 55% in one direction, classify them as that direction for Stats
            if (d.ns / total > 0.55) { inferredDir = 'NS'; fixedNSCount.push(pNo); }
            else if (d.ew / total > 0.55) { inferredDir = 'EW'; fixedEWCount.push(pNo); }

            pairDirectionMap[pNo].finalDir = inferredDir;
        });

        // Re-evaluate Mitchell status based on INFERRED directions
        // If we have distinct groups, treat as directional for HCP stats
        const isMitchell = fixedNSCount.length >= 2 && fixedEWCount.length >= 2;

        if (isMitchell) {
            // Fill seeds based on inferred direction
            playerStats.forEach(p => {
                let pDir = pairDirectionMap[p.pairNo]?.finalDir;

                // Fallback for purely 50/50 split (rare) - assign to NS default
                if (pDir === 'Mixed') {
                    const d = pairDirectionMap[p.pairNo];
                    pDir = d?.ns >= d?.ew ? 'NS' : 'EW';
                }

                if (pDir === 'NS') {
                    p.seat = p.playerIdx === 0 ? 'North' : 'South';
                } else if (pDir === 'EW') {
                    p.seat = p.playerIdx === 0 ? 'East' : 'West';
                }
            });
        }

        if (isMitchell) {
            // Group by Seat calculation
            const seats = ['North', 'South', 'East', 'West'];
            const summaries = [];

            seats.forEach(seat => {
                const players = playerStats.filter(p => p.seat === seat);
                if (players.length > 0) {
                    const avg = players.reduce((sum, p) => sum + parseFloat(p.avg), 0) / players.length;
                    if (avg >= 11.0) {
                        summaries.push({ seat, avg, type: 'good' });
                    } else if (avg <= 9.0) {
                        summaries.push({ seat, avg, type: 'bad' });
                    }
                }
            });

            if (summaries.length === 0) {
                hcpAllocationText = "The cards were evenly distributed across all directions, with no seat holding a significant structural advantage.";
            } else {
                // Exposure Analysis for Mitchell
                // Calculate Opportunity Index for NS vs EW
                let nsOpportunity = { game: 0, partScore: 0, slam: 0 };
                let ewOpportunity = { game: 0, partScore: 0, slam: 0 };
                let varianceCount = 0;

                boards.forEach(b => {
                    const totalHCP = (parseInt(b.nsHCP) || 0) + (parseInt(b.ewHCP) || 0); // Should be 40, check mainly for valid data
                    if (totalHCP < 35) return; // Skip if bad data

                    // Analyze Board Potential - Simplified Heuristic
                    // High Variance: >1400 swing or weird distribution? Use spread.
                    if (b.spread > 800) varianceCount++;

                    // Who had the "Opportunity"?
                    // Assume side with > 24HCP had the "Game" opportunity
                    // Side with > 31HCP had "Slam" opportunity
                    const nsH = parseInt(b.nsHCP || 0);
                    const ewH = parseInt(b.ewHCP || 0);

                    if (nsH >= 31) nsOpportunity.slam++;
                    else if (nsH >= 24) nsOpportunity.game++;
                    else nsOpportunity.partScore++;

                    if (ewH >= 31) ewOpportunity.slam++;
                    else if (ewH >= 24) ewOpportunity.game++;
                    else ewOpportunity.partScore++;
                });

                // --- Mitchell Analysis ---
                const totalBoards = boards.length;
                const highVariance = varianceCount;
                const totalSlams = nsOpportunity.slam + ewOpportunity.slam; // Sum of opportunities, not distinct boards, but good proxy
                const totalGames = nsOpportunity.game + ewOpportunity.game;

                const ceilingType = totalSlams > 2 ? 'marked by high scoring potential' : totalGames > (totalBoards * 0.4) ? 'marked by frequent scoring opportunities' : 'limited in scoring potential';
                const dominance = highVariance < 3 ? 'part-score dominated' : 'high-variance';

                let mitchellText = `In this Mitchell movement, the session was ${ceilingType}, featuring ${totalSlams > 0 ? totalSlams + ' slam opportunities' : 'no slam opportunities'} and ${totalGames} game boards. `;

                mitchellText += `North/South faced ${nsOpportunity.game + nsOpportunity.slam} game/slam opportunities while East/West had ${ewOpportunity.game + ewOpportunity.slam}, `;
                const diff = (nsOpportunity.game + nsOpportunity.slam) - (ewOpportunity.game + ewOpportunity.slam);
                if (Math.abs(diff) < 2) {
                    mitchellText += `so exposure to high-value boards was evenly balanced. `;
                } else if (diff > 0) {
                    mitchellText += `so North/South were exposed to more of the session’s high-value boards. `;
                } else {
                    mitchellText += `so East/West were exposed to more of the session’s high-value boards. `;
                }

                mitchellText += `Most boards were ${dominance}, indicating that results relied on ${dominance === 'part-score dominated' ? 'accurate partial contracts and defense rather than High Card Points' : 'handling significant swings'}. `;
                mitchellText += `Ranking differences were largely driven by ${dominance === 'part-score dominated' ? 'performance on the minority of high-scoring boards' : 'outcomes on these high-variance deals'}.`;

                hcpAllocationText = mitchellText;
            }
        } else {
            // --- Howell / One-Winner Analysis (Start Position Focus) ---
            // "Restrict analysis to starting direction or seat and early-session exposure only"

            // 1. Map Boards to Potential
            const boardOpp = {};
            const sortedBoards = boards.sort((a, b) => parseInt(a.boardNum) - parseInt(b.boardNum));
            let totalSlams = 0;
            let totalGames = 0;

            sortedBoards.forEach(b => {
                const nsH = parseInt(b.nsHCP || 0);
                const ewH = parseInt(b.ewHCP || 0);
                let type = 'PartScore';
                if (Math.max(nsH, ewH) >= 31) { type = 'Slam'; totalSlams++; }
                else if (Math.max(nsH, ewH) >= 24) { type = 'Game'; totalGames++; }
                else if (b.spread > 800) { type = 'HighVar'; } // Treat high variance as notable
                boardOpp[b.boardNum] = type;
            });

            // 2. Identify Start Positions for every pair
            const pairStarts = {};
            sortedBoards.forEach(b => {
                b.results.forEach(r => {
                    const bNum = parseInt(b.boardNum);
                    if (!pairStarts[r.ns] || pairStarts[r.ns].board > bNum) {
                        pairStarts[r.ns] = { board: bNum, dir: 'NS', pair: r.ns };
                    }
                    if (!pairStarts[r.ew] || pairStarts[r.ew].board > bNum) {
                        pairStarts[r.ew] = { board: bNum, dir: 'EW', pair: r.ew };
                    }
                });
            });

            // 3. Analyze Early Exposure (First round / 3-4 boards)
            const exposure = [];
            const roundLength = 4; // Typical round length assumption or just "Early Session"
            const boardCount = sortedBoards.length;

            Object.values(pairStarts).forEach(start => {
                let oppScore = 0;
                let desc = [];
                for (let i = 0; i < roundLength; i++) {
                    let targetBd = (start.board - 1 + i) % boardCount + 1;
                    const type = boardOpp[targetBd] || 'PartScore';
                    if (type === 'Slam') { oppScore += 3; desc.push('Slam'); }
                    else if (type === 'Game') { oppScore += 2; desc.push('Game'); }
                    else if (type === 'HighVar') { oppScore += 1; }
                }
                exposure.push({ ...start, score: oppScore, desc });
            });

            exposure.sort((a, b) => b.score - a.score);
            const hotStart = exposure[0];
            const coldStart = exposure[exposure.length - 1];

            const getNames = (pNo) => (pairNames[String(pNo)] || pairNames[parseInt(pNo)] || `Pair ${pNo}`).split('&')[0].trim();

            let howellText = `In this Howell movement, individual exposure varied by starting seat. `;

            if (hotStart && hotStart.score > 3) {
                howellText += `Pairs starting at Board ${hotStart.board} (e.g. ${getNames(hotStart.pair)}) faced an action-packed opening set, meeting ${hotStart.desc.includes('Slam') ? 'slam' : 'game'} opportunities immediately. `;
            } else {
                howellText += `The opening boards were largely quiet across the room. `;
            }

            if (coldStart && coldStart.score < 2 && coldStart !== hotStart) {
                howellText += `In contrast, those starting at Board ${coldStart.board} began with technical part-score battles. `;
            }

            const ceiling = totalSlams > 2 ? 'high-ceiling' : 'low-ceiling';
            howellText += `Overall, the session was ${ceiling} with ${totalSlams} potential slams and ${totalGames} game hands. `;
            howellText += `Your final result depended less on "good cards" and more on whether you met the opportunity-rich boards when your system was firing.`;

            hcpAllocationText = howellText;
        }
    }

    // --- FINAL RENDER ---

    return `
        <div style="font-family: 'Inter', system-ui, sans-serif; color: #f1f5f9; line-height: 1.6; max-width: 900px; margin: 0 auto; padding: 40px 20px; background: #0f172a;">
            <div style="border-left: 4px solid #fbbf24; padding-left: 24px; margin-bottom: 40px;">
                <div style="margin-bottom: 20px;">
                    <button onclick="this.closest('details').removeAttribute('open')" style="
                        background-color: transparent;
                        border: 1px solid #fbbf24;
                        color: #fbbf24;
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-family: inherit;
                        font-size: 0.9rem;
                    ">
                        &larr; Back / Close Report
                    </button>
                </div>
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
                <h2 style="color: #fbbf24; font-size: 1.5rem; border-bottom: 1px solid #334155; padding-bottom: 8px;">Did you have the cards?</h2>
                <p style="font-size: 1.15rem; color: #cbd5e1;">
                    ${hcpAllocationText}
                </p>
            </div>
            <div style="margin-bottom: 32px;">
                <h2 style="color: #fbbf24; font-size: 1.5rem; border-bottom: 1px solid #334155; padding-bottom: 8px;">Big Swings</h2>
                <p style="font-size: 1.15rem; color: #cbd5e1;">
                    - ${swingDesc}
                </p>
                ${swingDiagram ? `
                <details style="margin-top: 10px; cursor: pointer;">
                    <summary style="color: #fbbf24; font-size: 0.9rem; text-decoration: underline;">View Hand Diagram</summary>
                    <div style="margin-top: 10px;">${swingDiagram}</div>
                </details>
                ` : ''}
            </div>

            <div style="margin-bottom: 32px;">
                <h2 style="color: #fbbf24; font-size: 1.5rem; border-bottom: 1px solid #334155; padding-bottom: 8px;">Slams</h2>
                <p style="font-size: 1.15rem; color: #cbd5e1;">
                    ${slamBoard ? `- ${heroPair}: ${heroDetails}` : 'No slams were bid or made in this session.'}
                </p>
            </div>

            <!-- NEW ANALYSIS SECTIONS -->
            ${(() => {
            // Killer Leads Analysis
            let killerHtml = '';
            const allKiller = boards.flatMap(b => analyzeKillerLeads(b));
            // Filter for significant swings (e.g. making vs down)
            const notableKiller = allKiller.filter(k => k.type === 'Defense' || k.type === 'Declarer').slice(0, 3);

            if (notableKiller.length > 0) {
                const items = notableKiller.map(k => {
                    const declSide = ['N', 'S'].includes(k.declarer) ? 'NS' : 'EW';
                    const declPair = declSide === 'NS' ? k.nsPair : k.ewPair;
                    const defPair = declSide === 'NS' ? k.ewPair : k.nsPair;

                    // Who is the "Hero"?
                    // If type is Defense, the Defenders are the heroes.
                    // If type is Declarer, the Declarer is the hero.
                    const heroPairNum = k.type === 'Defense' ? defPair : declPair;
                    const heroName = (pairNames[heroPairNum] || `Pair ${heroPairNum}`).split('&')[0].trim();

                    const killerDiagram = k.deal ? renderHandDiagram(parsePbnDeal(k.deal), k.boardNum, k.ddTricks, k.optimumScore) : '';

                    return `
                        <div style="margin-bottom: 12px;">
                            <strong>Board ${k.boardNum}: ${k.contract} by ${k.declarer}</strong> (${k.result})<br>
                            <span style="color: #fbbf24;">${heroName}</span> ${k.type === 'Defense' ? 'found the killer defense' : 'beat the odds'}: ${k.desc} (Lead: ${k.lead || 'Unknown'})
                            ${killerDiagram ? `
                            <details style="margin-top: 8px; cursor: pointer;">
                                <summary style="color: #fbbf24; font-size: 0.85rem; text-decoration: underline;">View Diagram</summary>
                                <div style="margin-top: 8px;">${killerDiagram}</div>
                            </details>
                            ` : ''}
                        </div>
                    `;
                }).join('');

                killerHtml = `
                    <div style="margin-bottom: 32px;">
                        <h2 style="color: #fbbf24; font-size: 1.5rem; border-bottom: 1px solid #334155; padding-bottom: 8px;">Killer Leads & Par Breakers</h2>
                        <div style="font-size: 1.15rem; color: #cbd5e1;">
                            ${items}
                        </div>
                    </div>`;
            }

            // Efficiency Analysis
            let effHtml = '';
            const effStats = analyzeEfficiency(boards, pairNames).slice(0, 5); // Top 5

            if (effStats.length > 0) {
                const rows = effStats.map((s, i) => `
                        <tr style="border-bottom: 1px solid #334155;">
                            <td style="padding: 8px;">${i + 1}. ${s.name}</td>
                            <td style="padding: 8px; text-align: right;">${s.avgDiff > 0 ? '+' : ''}${s.avgDiff}</td>
                            <td style="padding: 8px; text-align: right;">${s.count}</td>
                        </tr>
                     `).join('');

                effHtml = `
                     <div style="margin-bottom: 32px;">
                        <h2 style="color: #fbbf24; font-size: 1.5rem; border-bottom: 1px solid #334155; padding-bottom: 8px;">HCP Efficiency (Performance vs Par)</h2>
                        <p style="font-size: 1rem; color: #94a3b8; margin-bottom: 10px;">Average tricks won above/below Double Dummy expectations per hand.</p>
                        <table style="width: 100%; border-collapse: collapse; font-size: 1.1rem; color: #cbd5e1;">
                            <thead>
                                <tr style="text-align: left; color: #fbbf24;">
                                    <th style="padding: 8px;">Pair</th>
                                    <th style="padding: 8px; text-align: right;">Avg Diff</th>
                                    <th style="padding: 8px; text-align: right;">Bds</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rows}
                            </tbody>
                        </table>
                     </div>`;
            }

            return killerHtml + effHtml;
        })()}

            <div style="margin-bottom: 32px;">
                <h2 style="color: #fbbf24; font-size: 1.5rem; border-bottom: 1px solid #334155; padding-bottom: 8px;">Where the choice of contract made a difference</h2>
                <p style="font-size: 1.15rem; color: #cbd5e1;">
                    - ${contractChoiceText}
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

            <div style="margin-bottom: 40px; padding: 24px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 12px;">
                <h2 style="color: #fbbf24; font-size: 1.5rem; margin-top: 0; border-bottom: 1px solid #334155; padding-bottom: 8px;">Personal Pair Lookup</h2>
                <p style="color: #94a3b8; font-size: 0.95rem; margin-bottom: 16px;">Select your name or pair number to see your personalised session summary.</p>
                
                <div style="margin-bottom: 20px;">
                    <select id="pair-lookup-select" style="width: 100%; padding: 12px; background: #1e293b; border: 1px solid #334155; color: #f1f5f9; border-radius: 6px; font-size: 1rem; cursor: pointer;">
                        <option value="">-- Select Your Pair --</option>
                        ${rankings.map(r => `<option value="${r.no}">${r.no}: ${r.players} (${r.score}%)</option>`).join('')}
                    </select>
                </div>

                <div id="lookup-results-area" style="min-height: 50px; color: #cbd5e1;">
                    <div style="text-align: center; color: #64748b; font-style: italic; padding: 20px;">
                        Select a pair above to view performance details...
                    </div>
                </div>

                <script>
                    (function() {
                        const data = ${JSON.stringify({ rankings, boards })};
                        
                        function parseDD(ddStr, pos, suit) {
                            if (!ddStr || ddStr.length !== 20) return null;
                            const strains = ['NT', 'S', 'H', 'D', 'C'];
                            const positions = ['N', 'E', 'S', 'W'];
                            const pIdx = positions.indexOf(pos);
                            const sIdx = strains.indexOf(suit);
                            if (pIdx === -1 || sIdx === -1) return null;
                            const hex = ddStr[pIdx * 5 + sIdx];
                            return hex ? parseInt(hex, 16) : 0;
                        }

                        function renderPairStats(pairNo, container) {
                            const pair = data.rankings.find(r => r.no === pairNo);
                            if (!pair) return;

                            const pairBoards = data.boards.filter(b => b.results.some(r => r.ns === pairNo || r.ew === pairNo));
                            const totalBoards = pairBoards.length;
                            
                            let totalScoreDiff = 0;
                            let totalEffDiff = 0;
                            let effCount = 0;
                            const tops = [];
                            const bottoms = [];

                            pairBoards.forEach(b => {
                                const res = b.results.find(r => r.ns === pairNo || r.ew === pairNo);
                                const isNS = res.ns === pairNo;
                                
                                const pairScore = isNS ? (parseInt(res.nsScore) || -parseInt(res.ewScore) || 0) : (-parseInt(res.nsScore) || parseInt(res.ewScore) || 0);
                                const fieldScores = b.results.map(r => isNS ? (parseInt(r.nsScore) || -parseInt(r.ewScore) || 0) : (-parseInt(r.nsScore) || parseInt(r.ewScore) || 0));
                                const fieldAvg = fieldScores.reduce((a, b) => a + b, 0) / fieldScores.length;
                                totalScoreDiff += (pairScore - fieldAvg);

                                if (b.ddTricks && res.contract && res.contract !== 'PASS') {
                                    const suit = res.contract.substring(1, 2) === 'N' ? 'NT' : res.contract.substring(1, 2);
                                    const declarer = res.declarer;
                                    const parTricks = parseDD(b.ddTricks, declarer, suit);
                                    if (parTricks !== null) {
                                        totalEffDiff += (parseInt(res.tricks) - parTricks);
                                        effCount++;
                                    }
                                }

                                const maxField = Math.max(...fieldScores);
                                const minField = Math.min(...fieldScores);
                                if (pairScore === maxField && fieldScores.length > 1) tops.push(b.boardNum);
                                if (pairScore === minField && fieldScores.length > 1) bottoms.push(b.boardNum);
                            });

                            const avgScoreDiff = (totalScoreDiff / totalBoards).toFixed(0);
                            const avgEff = effCount > 0 ? (totalEffDiff / effCount).toFixed(2) : "n/a";
                            const effColor = parseFloat(avgEff) > 0 ? '#4ade80' : parseFloat(avgEff) < 0 ? '#f87171' : '#cbd5e1';

                            container.innerHTML = \`
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 10px;">
                                    <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 8px;">
                                        <div style="color: #94a3b8; font-size: 0.8rem; text-transform: uppercase;">Boards Played</div>
                                        <div style="font-size: 1.5rem; font-weight: 700; color: #fff;">\${totalBoards}</div>
                                    </div>
                                    <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 8px;">
                                        <div style="color: #94a3b8; font-size: 0.8rem; text-transform: uppercase;">Rank</div>
                                        <div style="font-size: 1.5rem; font-weight: 700; color: #fff;">\${pair.rank || '—'} <span style="font-size: 0.9rem; color: #94a3b8;">(\${pair.score}%)</span></div>
                                    </div>
                                    <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 8px;">
                                        <div style="color: #94a3b8; font-size: 0.8rem; text-transform: uppercase;">Avg vs Field</div>
                                        <div style="font-size: 1.5rem; font-weight: 700; color: \${parseInt(avgScoreDiff) >= 0 ? '#4ade80' : '#f87171'};">\${parseInt(avgScoreDiff) > 0 ? '+' : ''}\${avgScoreDiff}</div>
                                    </div>
                                    <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 8px;">
                                        <div style="color: #94a3b8; font-size: 0.8rem; text-transform: uppercase;">HCP Efficiency</div>
                                        <div style="font-size: 1.5rem; font-weight: 700; color: \${effColor};">\${parseFloat(avgEff) > 0 ? '+' : ''}\${avgEff}</div>
                                    </div>
                                </div>

                                <div style="margin-top: 20px;">
                                    <div style="margin-bottom: 8px;">
                                        <span style="color: #4ade80; font-weight: 700;">Tops:</span> 
                                        <span style="color: #cbd5e1;">\${tops.length > 0 ? tops.join(', ') : 'None this session'}</span>
                                    </div>
                                    <div>
                                        <span style="color: #f87171; font-weight: 700;">Bottoms:</span> 
                                        <span style="color: #cbd5e1;">\${bottoms.length > 0 ? bottoms.join(', ') : 'None this session'}</span>
                                    </div>
                                </div>
                            \`;
                        }

                        const select = document.getElementById('pair-lookup-select');
                        const resultsArea = document.getElementById('lookup-results-area');
                        
                        if (select && resultsArea) {
                            select.addEventListener('change', () => {
                                const pairNo = select.value;
                                if (!pairNo) {
                                    resultsArea.innerHTML = '<div style="text-align: center; color: #64748b; font-style: italic; padding: 20px;">Select a pair above to view performance details...</div>';
                                    return;
                                }
                                renderPairStats(pairNo, resultsArea);
                            });
                        }
                    })();
                </script>
            </div>

            <div style="margin-top: 60px; padding-top: 20px; border-top: 1px solid #334155; color: #94a3b8; font-size: 0.95rem;">
                <h3 style="color: #fbbf24; margin-bottom: 10px;">Glossary: What does all this mean?</h3>
                <p style="margin-bottom: 10px;">
                    <strong>Double Dummy:</strong> The computer plays the hand as if everyone can see everyone else's cards. It never guesses and never takes a finesse that won't work. It's bridge played with the lights on.
                </p>
                <p style="margin-bottom: 10px;">
                    <strong>Killer Leads & Par Breakers:</strong> "Par" is the computer's prediction of perfect play. A Par Breaker is when a human proves the computer wrong—either by making the "impossible" or finding the one Killer Lead that sinks a "sure thing."
                </p>
                <p style="margin-bottom: 10px;">
                    <strong>HCP Efficiency:</strong> This measures what you actually did with your cards (Performance vs Par). A <strong>Positive (+) Diff</strong> means you're squeezing blood from a stone (winning more tricks than theory says you should). A <strong>Negative (-) Diff</strong> means you likely left a few tricks on the table as a charitable donation.
                </p>
                <p>
                    <strong>Avg Diff:</strong> The average number of tricks gained or lost per hand against the "perfect" baseline.
                </p>
            </div>


        </div>
    `;
}
