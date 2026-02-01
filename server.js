
import express from 'express';
import cors from 'cors';
import { getSessionData } from './scraper.js';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3002;

app.get('/', (req, res) => {
    res.send(`
        <html>
            <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
                <h1>Bridge Bot API is Running 🤖</h1>
                <p>You are on the backend server port.</p>
                <p>Please visit the frontend application here:</p>
                <a href="http://localhost:3000" style="font-size: 1.2em; color: #0056b3;">http://localhost:3000</a>
            </body>
        </html>
    `);
});

/**
 * Generates a witty, insightful UK bridge commentator style newsletter.
 * Enhanced to provide deep dive analysis on scorecards, leads, and directional bias.
 */
function generateNewsletter(data) {
    const { eventInfo, rankings, boards, scorecards } = data;

    // Create pair lookup
    const pairNames = {};
    if (rankings) {
        rankings.forEach(r => {
            if (r.no && r.players) {
                // Normalize number: remove leading zeros and trim
                const normalizedNo = r.no.toString().trim().replace(/^0+/, '') || "0";
                pairNames[normalizedNo] = r.players;
                // Also store with original just in case
                pairNames[r.no.toString().trim()] = r.players;
            }
        });
    }

    // Helper to get pair name safely
    const getPairName = (no) => {
        if (!no) return "Unknown Pair";
        const normalized = no.toString().trim().replace(/^0+/, '') || "0";
        return pairNames[normalized] || pairNames[no.toString().trim()] || `Pair ${no}`;
    };

    const totalResults = boards.reduce((sum, b) => sum + (b.results ? b.results.length : 0), 0);
    console.log(`[Analysis] Processing ${boards.length} boards and ${totalResults} result records.`);

    // Enrich boards with scorecards data and calculate aggregates
    let totalNSScore = 0, totalEWScore = 0;
    let totalNSHCP = 0, totalEWHCP = 0;
    let validHCPBoards = 0;
    let nsWins = 0, ewWins = 0, ties = 0;
    let totalContracts = 0;

    // Group scorecards by board for enrichment
    const scorecardsByBoard = {};
    if (scorecards) {
        scorecards.forEach(sc => {
            if (!scorecardsByBoard[sc.board]) scorecardsByBoard[sc.board] = [];
            scorecardsByBoard[sc.board].push(sc);
        });
    }

    // Process each board
    const boardAnalysis = boards.map(b => {
        // HCP stats
        if (b.nsHCP !== undefined && b.ewHCP !== undefined) {
            totalNSHCP += parseInt(b.nsHCP) || 0;
            totalEWHCP += parseInt(b.ewHCP) || 0;
            validHCPBoards++;
        }

        // Enrich with scorecard data if available
        if (scorecardsByBoard[b.boardNum]) {
            b.results.forEach(r => {
                const sc = scorecardsByBoard[b.boardNum].find(s => s.ns === r.ns && s.ew === r.ew);
                if (sc) {
                    r.lead = sc.lead;
                    r.declarer = sc.declarer;
                    r.contract = sc.contract || r.contract; // Prefer scorecard contract
                }
            });
        }

        // Analyze results for this board
        const scores = b.results.map(r => (parseInt(r.nsScore) || 0) - (parseInt(r.ewScore) || 0));
        const max = Math.max(...scores, 0);
        const min = Math.min(...scores, 0);
        const spread = max - min;

        // Contract Analysis
        const contracts = {};
        const leads = {};

        b.results.forEach(r => {
            // Score totals
            const ns = parseInt(r.nsScore) || 0;
            const ew = parseInt(r.ewScore) || 0;
            totalNSScore += ns;
            totalEWScore += ew;

            if (ns > ew) nsWins++;
            else if (ew > ns) ewWins++;
            else ties++;

            // Contract stats
            if (r.contract) {
                contracts[r.contract] = (contracts[r.contract] || 0) + 1;
                totalContracts++;
            }
            // Lead stats
            if (r.lead) {
                leads[r.lead] = (leads[r.lead] || 0) + 1;
            }
        });

        const uniqueContracts = Object.keys(contracts);
        const uniqueLeads = Object.keys(leads);

        return {
            ...b,
            spread,
            topScore: max,
            bottomScore: min,
            contracts,
            leads,
            uniqueContracts,
            uniqueLeads,
            isSlam: uniqueContracts.some(c => c.includes('6') || c.includes('7')),
            isGame: uniqueContracts.some(c => c.includes('3NT') || c.includes('4') || c.includes('5'))
        };
    }).sort((a, b) => b.spread - a.spread);

    // --- AGGREGATE STATS ---
    const avgNSHCP = validHCPBoards > 0 ? (totalNSHCP / validHCPBoards).toFixed(1) : "N/A";
    const avgEWHCP = validHCPBoards > 0 ? (totalEWHCP / validHCPBoards).toFixed(1) : "N/A";
    const totalHands = nsWins + ewWins + ties;
    const nsWinPct = totalHands > 0 ? ((nsWins / totalHands) * 100).toFixed(1) : 0;
    const ewWinPct = totalHands > 0 ? ((ewWins / totalHands) * 100).toFixed(1) : 0;

    // --- ADVANCED ANALYSIS ---

    // 1. Analyze Leads (Same Board, Same Contract, Different Leads)
    let leadAnalysisText = "Standard leads were the order of the day; no obvious deviations affected outcomes significantly.";
    let leadDifferences = [];

    boardAnalysis.forEach(b => {
        // Group by contract first
        const resultsByContract = {};
        b.results.forEach(r => {
            if (r.contract && r.lead) { // Only if we have both
                if (!resultsByContract[r.contract]) resultsByContract[r.contract] = [];
                resultsByContract[r.contract].push(r);
            }
        });

        // For each contract, check if different leads produced different average scores
        Object.entries(resultsByContract).forEach(([contract, results]) => {
            if (results.length < 2) return; // Need at least 2 plays

            // Group by lead
            const scoresByLead = {};
            results.forEach(r => {
                const score = (parseInt(r.nsScore) || 0) - (parseInt(r.ewScore) || 0);
                if (!scoresByLead[r.lead]) scoresByLead[r.lead] = { total: 0, count: 0, scores: [] };
                scoresByLead[r.lead].total += score;
                scoresByLead[r.lead].count++;
                scoresByLead[r.lead].scores.push(score);
            });

            const leads = Object.keys(scoresByLead);
            if (leads.length > 1) {
                // Calculate averages
                const averages = leads.map(lead => ({
                    lead,
                    avg: scoresByLead[lead].total / scoresByLead[lead].count,
                    count: scoresByLead[lead].count
                })).sort((a, b) => b.avg - a.avg);

                const best = averages[0];
                const worst = averages[averages.length - 1];
                const diff = Math.abs(best.avg - worst.avg);

                if (diff > 50) { // arbitrary threshold for "significant"
                    leadDifferences.push({
                        board: b.boardNum,
                        contract,
                        bestLead: best.lead,
                        bestScore: Math.round(best.avg),
                        worstLead: worst.lead,
                        worstScore: Math.round(worst.avg),
                        diff,
                        count: results.length
                    });
                }
            }
        });
    });

    function getLeadSuit(leadStr) {
        if (!leadStr) return "something";
        const s = leadStr.toUpperCase();
        if (s.includes('C') || s.includes('♣')) return "a club";
        if (s.includes('D') || s.includes('♦')) return "a diamond";
        if (s.includes('H') || s.includes('♥')) return "a heart";
        if (s.includes('S') || s.includes('♠')) return "a spade";
        if (s.includes('NT')) return "a no trump";
        return "a lead";
    }

    // Select the most impactful lead difference
    leadDifferences.sort((a, b) => b.diff - a.diff);
    if (leadDifferences.length > 0) {
        const topLead = leadDifferences[0];
        const suitName = getLeadSuit(topLead.bestLead);
        const secondSuit = getLeadSuit(topLead.worstLead);

        if (suitName === secondSuit) {
            leadAnalysisText = `<p>Interesting that on <strong>Board ${topLead.board}</strong> ${suitName} was led against <strong>${topLead.contract}</strong>, but results were wildly different. One pair made the contract for ${topLead.bestScore >= 0 ? '+' : ''}${topLead.bestScore}, while another went down for ${topLead.worstScore >= 0 ? '+' : ''}${topLead.worstScore}. A case for careful card play!</p>`;
        } else {
            leadAnalysisText = `<p><strong>Board ${topLead.board}</strong> provided a clear lesson. Against <strong>${topLead.contract}</strong>, leading ${suitName} averaged ${topLead.bestScore >= 0 ? '+' : ''}${topLead.bestScore}, whereas ${secondSuit} lead resulted in ${topLead.worstScore >= 0 ? '+' : ''}${topLead.worstScore}.</p>`;
        }

        if (leadDifferences.length > 1) {
            const secondLead = leadDifferences[1];
            const suit2 = getLeadSuit(secondLead.bestLead);
            leadAnalysisText += `<p>On <strong>Board ${secondLead.board}</strong>, results also varied significantly against ${secondLead.contract} depending on the ${suit2} lead.</p>`;
        }
    } else if (scorecards && scorecards.length > 0) {
        leadAnalysisText = "<p>Our analysis of the scorecards found mostly consistent results regardless of the lead. Good declarer play likely neutralized any advantage from non-standard leads today.</p>";
    } else {
        leadAnalysisText = "<p><em>(Scorecard data unavailable to analyze specific leads)</em></p>";
    }

    // 2. Analyze Contracts (Same Board, Different Contracts)
    let contractAnalysisText = "The field was remarkably consistent in contract selection.";
    let contractDifferences = [];

    boardAnalysis.forEach(b => {
        if (b.uniqueContracts.length < 2) return;

        // Compare average scores of different contracts
        const contractStats = b.uniqueContracts.map(c => {
            const scores = b.results.filter(r => r.contract === c).map(r => (parseInt(r.nsScore) || 0) - (parseInt(r.ewScore) || 0));
            const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
            return { contract: c, avg, count: scores.length };
        }).filter(s => s.count > 0); // Ignore singleton weirdness if desired, but maybe keeping it is fun

        if (contractStats.length >= 2) {
            contractStats.sort((a, b) => b.avg - a.avg);
            const best = contractStats[0];
            const worst = contractStats[contractStats.length - 1];
            const diff = Math.abs(best.avg - worst.avg);

            // Only care if the difference is substantial (e.g. game vs partscore swing)
            if (diff > 100) {
                contractDifferences.push({
                    board: b.boardNum,
                    bestContract: best.contract,
                    bestAvg: Math.round(best.avg),
                    worstContract: worst.contract,
                    worstAvg: Math.round(worst.avg),
                    diff,
                    nsHCP: b.nsHCP,
                    ewHCP: b.ewHCP
                });
            }
        }
    });

    contractDifferences.sort((a, b) => b.diff - a.diff);
    if (contractDifferences.length > 0) {
        const topCon = contractDifferences[0];
        // More nuanced description to avoid implies "wrong contract" when it might be "bad play"
        contractAnalysisText = `<p><strong>Board ${topCon.board}</strong> saw a significant spread in scores across the room. While those in <strong>${topCon.bestContract}</strong> averaged ${topCon.bestAvg >= 0 ? '+' : ''}${topCon.bestAvg}, the cards proved trickier for others in <strong>${topCon.worstContract}</strong> who averaged ${topCon.worstAvg >= 0 ? '+' : ''}${topCon.worstAvg}.</p>`;

        if (contractDifferences.length > 1) {
            const secondCon = contractDifferences[1];
            contractAnalysisText += `<p>Similarly on <strong>Board ${secondCon.board}</strong>, results ranged from ${secondCon.bestAvg >= 0 ? '+' : ''}${secondCon.bestAvg} in <strong>${secondCon.bestContract}</strong> to ${secondCon.worstAvg >= 0 ? '+' : ''}${secondCon.worstAvg} in <strong>${secondCon.worstContract}</strong>.</p>`;
        }
    } else {
        contractAnalysisText = "<p>The field was remarkably consistent in contract selection and outcomes today.</p>";
    } // --- GENERATE OUTPUT HTML ---

    let spotlight = "";

    // Check for multiple sections (e.g. Mitchell Movement)
    // We look for a "Rank 1" that appears after a non-Rank 1, indicating a new section starting.
    let splitIndex = -1;
    for (let i = 1; i < rankings.length; i++) {
        const currentPos = rankings[i].pos.replace(/[=\s]/g, '');
        const prevPos = rankings[i - 1].pos.replace(/[=\s]/g, '');

        // If we find a '1' that follows a non-'1', that's a section break
        if (currentPos === '1' && prevPos !== '1') {
            splitIndex = i;
            break;
        }
    }

    if (splitIndex !== -1) {
        // Dual Winners (Likely NS / EW)
        const group1 = rankings.slice(0, splitIndex);
        const group2 = rankings.slice(splitIndex);

        const formatGroup = (label, group) => {
            // Deduplicate group by pair number/name to avoid "Winner vs Winner" bug
            const uniqueGroup = [];
            const seen = new Set();
            group.forEach(r => {
                const id = r.no || r.players;
                if (!seen.has(id)) {
                    uniqueGroup.push(r);
                    seen.add(id);
                }
            });

            // Re-sort normalized by score
            const sorted = [...uniqueGroup].sort((a, b) => {
                const sA = parseFloat(a.score.replace(/[^\d.]/g, '')) || 0;
                const sB = parseFloat(b.score.replace(/[^\d.]/g, '')) || 0;
                return sB - sA;
            });

            const winner = sorted[0];
            if (!winner) return "";

            let text = `<div style="margin-bottom: 15px;">
                <div style="font-weight: bold; color: #444; margin-bottom: 4px;">${label}</div>
                <div style="font-size: 1.1em;">${winner.players} <span style="font-weight: bold; color: #28a745;">${winner.score}</span></div>`;

            // Find valid runner up (Next distinct player)
            // sorted[1] is the best runner up because we deduped and sorted
            const runnerUp = sorted[1];

            if (runnerUp) {
                const s1 = parseFloat(winner.score.replace(/[^\d.]/g, ''));
                const s2 = parseFloat(runnerUp.score.replace(/[^\d.]/g, ''));

                // Determine if score is percentage or match points roughly
                const isPercent = winner.score.includes('%');
                const diff = (s1 - s2);

                // Format difference
                let diffStr = diff.toFixed(2);
                if (isPercent) diffStr += '%';

                if (diff < 0.01) {
                    text += `<div style="font-size: 0.9em; color: #666; margin-top: 2px;">Virtually tied with ${runnerUp.players} (${runnerUp.score}).</div>`;
                } else {
                    text += `<div style="font-size: 0.9em; color: #666; margin-top: 2px;">Won by ${diffStr} ahead of ${runnerUp.players} (${runnerUp.score}).</div>`;
                }
            } else {
                text += `<div style="font-size: 0.9em; color: #666; margin-top: 2px;">Uncontested or single pair.</div>`;
            }
            text += `</div>`;
            return text;
        };

        // Standard convention: NS listed first, EW listed second
        spotlight = formatGroup("North-South", group1) + formatGroup("East-West", group2);

    } else {
        // Single Winner (Howell or unified)
        // Deduplicate
        const uniqueRankings = [];
        const seen = new Set();
        rankings.forEach(r => {
            const id = r.no || r.players;
            if (!seen.has(id)) {
                uniqueRankings.push(r);
                seen.add(id);
            }
        });

        // Sort
        const sorted = uniqueRankings.sort((a, b) => {
            const sA = parseFloat(a.score.replace(/[^\d.]/g, '')) || 0;
            const sB = parseFloat(b.score.replace(/[^\d.]/g, '')) || 0;
            return sB - sA;
        });

        const topPair = sorted[0] || { players: "The Winners", matchPoints: "0", score: "0%" };

        spotlight = `<strong>${topPair.players}</strong> (${topPair.score}).`;

        if (topPair.no) {
            const runnerUp = sorted[1];

            if (runnerUp) {
                const s1 = parseFloat(topPair.score.replace(/[^\d.]/g, ''));
                const s2 = parseFloat(runnerUp.score.replace(/[^\d.]/g, ''));
                const isPercent = topPair.score.includes('%');
                const diff = (s1 - s2);
                let diffStr = diff.toFixed(2);
                if (isPercent) diffStr += '%';

                if (diff < 0.01) {
                    spotlight += ` Tied with ${runnerUp.players} (${runnerUp.score}).`;
                } else {
                    spotlight += ` Won by ${diffStr} ahead of ${runnerUp.players} (${runnerUp.score}).`;
                }
            }

            // Winning boards count
            const pairBoards = boardAnalysis.filter(b => b.results.some(r => r.ns === topPair.no || r.ew === topPair.no));
            const tops = pairBoards.filter(b => {
                const res = b.results.find(r => r.ns === topPair.no || r.ew === topPair.no);
                if (!res) return false;
                // Simplistic top check (assumes NS view for now)
                const score = (parseInt(res.nsScore) || 0) - (parseInt(res.ewScore) || 0);
                const dir = res.ns === topPair.no ? 'ns' : 'ew';

                // If I am NS, I want Max score. If I am EW, I want Min score (usually recorded as NS score)
                // Wait, results store nsScore.
                // If I am EW, a "Top" for me is the LOWEST NS score.
                if (dir === 'ns') return score === b.topScore;
                else return score === b.bottomScore;
            });
            if (tops.length > 0) {
                spotlight += `<br><span style="font-size: 0.9em;">Top Score on ${tops.length} ${tops.length === 1 ? 'board' : 'boards'}.</span>`;
            }
        }
    }

    // Swing of the Session
    let swingHtml = "<p>Balanced scoring in this session with no massive swings.</p>";
    const bigSwing = boardAnalysis[0];
    if (bigSwing && bigSwing.spread > 0) {
        swingHtml = `<p><strong>Board ${bigSwing.boardNum}</strong> provided the fireworks (${bigSwing.spread} MP spread). <br>`;
        if (bigSwing.uniqueContracts.length > 1) {
            swingHtml += `The field was split: ${bigSwing.uniqueContracts.map(c => `<b>${c}</b>`).join(' vs ')}. `;
        }
        const topRes = bigSwing.results.find(r => parseInt(r.nsScore) === bigSwing.topScore);
        const botRes = bigSwing.results.find(r => parseInt(r.nsScore) === bigSwing.bottomScore);
        if (topRes && botRes) {
            swingHtml += `One pair made ${topRes.contract} for ${topRes.nsScore}, while another faced ${botRes.contract} for ${botRes.nsScore}.</p>`;
        }
    }

    // 3. Analyze Slam Achievements (Unique successful slams AND multiple pairs)
    let slamHtml = "";
    const slamHighlights = [];

    boardAnalysis.forEach(b => {
        // Find results where a slam was bid (Level 6 or 7)
        const slamResults = b.results.filter(r => {
            if (!r.contract) return false;
            // Check for level 6 or 7
            if (!r.contract.includes('6') && !r.contract.includes('7')) return false;

            console.log(`[DEBUG] Potential Slam found on Board ${b.boardNum}: ${r.contract} by ${r.declarer || 'Unknown'} (Scores: NS ${r.nsScore}, EW ${r.ewScore})`);

            // Check if made
            const nsScore = parseInt(r.nsScore) || 0;
            const ewScore = parseInt(r.ewScore) || 0;
            const absScore = Math.abs(nsScore);

            // Robust check: if declarer known, check specific score sign.
            if (r.declarer) {
                // Normalize declarer
                const decl = r.declarer.trim().toUpperCase().charAt(0); // 'North' -> 'N'
                if (['N', 'S'].includes(decl) && nsScore > 0) {
                    console.log(`[DEBUG] Slam MADE (NS declared, positive score)`);
                    return true;
                }
                if (['E', 'W'].includes(decl) && ewScore > 0) {
                    console.log(`[DEBUG] Slam MADE (EW declared, positive score)`);
                    return true;
                }
                console.log(`[DEBUG] Slam FAILED or score mismatch`);
                return false;
            } else {
                // Heuristic fallback: Slams usually > 900 points intra-club
                const passed = absScore >= 920;
                console.log(`[DEBUG] Slam Heuristic Check (Score ${absScore} >= 920): ${passed}`);
                return passed;
            }
        });

        if (slamResults.length > 0) {
            // Group by contract
            const pairsByContract = {};

            slamResults.forEach(r => {
                let pairName = "Unknown Pair";
                // Determine pair name
                let isNs = true;
                if (r.declarer) {
                    isNs = ['N', 'S'].includes(r.declarer);
                } else {
                    isNs = (parseInt(r.nsScore) > 0);
                }
                pairName = isNs ? getPairName(r.ns) : getPairName(r.ew);

                if (!pairsByContract[r.contract]) pairsByContract[r.contract] = [];
                pairsByContract[r.contract].push(pairName);
            });

            // Add highlight for each contract found
            Object.entries(pairsByContract).forEach(([contract, pairs]) => {
                slamHighlights.push({
                    board: b.boardNum,
                    contract,
                    pairs,
                    isUnique: pairs.length === 1
                });
            });
        }
    });

    if (slamHighlights.length > 0) {
        slamHtml = `<div style="margin-top: 20px; padding-top: 15px; border-top: 1px dashed #ccc;">
            <h4 style="color: #6f42c1; margin: 0 0 10px 0;">✨ The Slam Zone</h4>
            <ul style="margin: 0; padding-left: 20px; color: #444;">
                ${slamHighlights.map(h => {
            // Try to clean up suit symbols if raw HTML entities are present
            const cleanContract = h.contract.replace(/&spades;/g, '♠').replace(/&hearts;/g, '♥').replace(/&diams;/g, '♦').replace(/&clubs;/g, '♣');

            if (h.isUnique) {
                return `<li><strong>${h.pairs[0]}</strong> were the only pair to bid and make <strong>${cleanContract}</strong> on Board ${h.board}!</li>`;
            } else {
                // Join pairs with commas and 'and'
                let pairString = "";
                if (h.pairs.length === 2) {
                    pairString = `${h.pairs[0]} and ${h.pairs[1]}`;
                } else {
                    const lastPair = h.pairs[h.pairs.length - 1];
                    const otherPairs = h.pairs.slice(0, -1).join(', ');
                    pairString = `${otherPairs} and ${lastPair}`;
                }
                return `<li><strong>${pairString}</strong> all bid and made <strong>${cleanContract}</strong> on Board ${h.board}.</li>`;
            }
        }).join('')}
            </ul>
        </div>`;

        // Append to spotlight
        spotlight += slamHtml;
    }

    // 4. Analyze Unique Top Contracts (Unique contract + Top Score)
    const uniqueTopHighlights = [];

    boardAnalysis.forEach(b => {
        // Find contracts that were bid by exactly one pair
        const contractCounts = {};
        b.results.forEach(r => {
            if (r.contract) {
                contractCounts[r.contract] = (contractCounts[r.contract] || 0) + 1;
            }
        });

        const uniqueContracts = Object.keys(contractCounts).filter(c => contractCounts[c] === 1);

        uniqueContracts.forEach(uContract => {
            // Get the specific result
            const r = b.results.find(res => res.contract === uContract);
            if (!r) return;

            // Skip if it's already a slam (covered above)
            if (uContract.includes('6') || uContract.includes('7')) return;

            // Check if it was a TOP score for the declarer/pair
            const nsScore = (parseInt(r.nsScore) || 0) - (parseInt(r.ewScore) || 0);
            let achievedTop = false;
            let pairName = "Unknown";

            // We need to know who "bid" it to credit them.
            // Usually implied by declarer (N/S or E/W).
            if (r.declarer) {
                if (['N', 'S'].includes(r.declarer)) {
                    // NS Pair declared. Did they get Top NS score?
                    if (nsScore === b.topScore) {
                        achievedTop = true;
                        pairName = getPairName(r.ns);
                    }
                } else if (['E', 'W'].includes(r.declarer)) {
                    // EW Pair declared. Did they get Top EW score (lowest NS score)?
                    if (nsScore === b.bottomScore) {
                        achievedTop = true;
                        pairName = getPairName(r.ew);
                    }
                }
            } else {
                // Fallback: If score matches Top (NS view) -> Credit NS?
                if (nsScore === b.topScore && b.topScore > b.bottomScore) {
                    achievedTop = true;
                    pairName = getPairName(r.ns);
                }
                // If score matches Bottom (EW view) -> Credit EW?
                else if (nsScore === b.bottomScore && b.bottomScore < b.topScore) {
                    achievedTop = true;
                    pairName = getPairName(r.ew);
                }
            }

            if (achievedTop) {
                uniqueTopHighlights.push({
                    board: b.boardNum,
                    contract: uContract,
                    pair: pairName,
                    score: nsScore
                });
            }
        });
    });

    if (uniqueTopHighlights.length > 0) {
        // Limit to top 3 to avoid clutter if many
        const shownHighlights = uniqueTopHighlights.slice(0, 3);

        const uniqueHtml = `<div style="margin-top: 15px; padding-top: 15px; border-top: 1px dashed #ccc;">
            <h4 style="color: #d63384; margin: 0 0 10px 0;">🦄 Unique & Top!</h4>
            <ul style="margin: 0; padding-left: 20px; color: #444;">
                ${shownHighlights.map(h => `<li>
                    <strong>${h.pair}</strong> found the unique contract of <strong>${h.contract}</strong> on Board ${h.board} for a top score!
                </li>`).join('')}
            </ul>
             ${uniqueTopHighlights.length > 3 ? `<p style="font-size: 0.8em; margin: 5px 0 0 0; color: #666;">(+ ${uniqueTopHighlights.length - 3} others)</p>` : ''}
        </div>`;

        spotlight += uniqueHtml;
    }

    return `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <header style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #0056b3; padding-bottom: 20px;">
                <h1 style="color: #0056b3; margin: 0; font-size: 28px;">♣️ Liverpool Bridge Club ♦️</h1>
                <h2 style="color: #555; margin: 5px 0 0 0; font-size: 18px;">${eventInfo.text} - Post-Match Analysis</h2>
            </header>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
                <div style="background: white; padding: 20px; border-radius: 6px; border-left: 5px solid #28a745;">
                    <h3 style="margin-top: 0; color: #28a745;">🏆 Session Spotlight</h3>
                    ${spotlight}
                </div>
                <div style="background: white; padding: 20px; border-radius: 6px; border-left: 5px solid #dc3545;">
                    <h3 style="margin-top: 0; color: #dc3545;">🧨 Swing of the Session</h3>
                    ${swingHtml}
                </div>
            </div>

            <div style="background: white; padding: 20px; border-radius: 6px; border-left: 5px solid #17a2b8; margin-bottom: 30px;">
                <h3 style="margin-top: 0; color: #17a2b8;">💡 Deep Dive: Strategy & Stats</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                    <div>
                        <div style="margin-bottom: 20px;">
                            <strong style="color: #0056b3;">High Card Bias</strong><br>
                            ${validHCPBoards > 0 ?
            `NS Avg: ${avgNSHCP} | EW Avg: ${avgEWHCP}<br>
                                 Bias: ${Math.abs(avgNSHCP - avgEWHCP) < 0.5 ? "None (Balanced)" : (avgNSHCP > avgEWHCP ? "NS +" + (avgNSHCP - avgEWHCP).toFixed(1) : "EW +" + (avgEWHCP - avgNSHCP).toFixed(1))}`
            : "HCP Data Unavailable"}
                        </div>
                        <div>
                        <strong style="color: #0056b3;">Bidding & Play Outcomes</strong>
                            ${contractAnalysisText}
                        </div>
                    </div>
                    <div style="border-left: 1px solid #eee; padding-left: 20px;">
                        <strong style="color: #0056b3;">Lead Efficiency</strong>
                        ${leadAnalysisText}
                        <p style="font-size: 0.9em; color: #666; margin-top: 10px;"><em>Traveller processing active: ${totalResults} records analyzed.</em></p>
                    </div>
                </div>
            </div>

            <footer style="text-align: center; color: #888; font-size: 12px; margin-top: 40px;">
                Generated automatically by your Bridge Bot Assistant 🤖
            </footer>
        </div>
    `;
}

app.post('/api/generate', async (req, res) => {
    const { date, type, override } = req.body;

    try {
        console.log("Starting session scrape...");
        const sessionDate = override && date ? date.replace(/-/g, '') : null;
        const data = await getSessionData(sessionDate, type);

        console.log("Generating newsletter...");
        const html = generateNewsletter(data);

        res.json({
            success: true,
            html,
            data,
            eventId: data.eventInfo.eventId
        });
    } catch (err) {
        console.error("Server error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
