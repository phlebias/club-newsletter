# Newsletter Generation Quick Reference

## Data Sources (Priority Order)

### 1. Scorecards Tab ⭐ PRIMARY SOURCE
**Use For:** Contract, Declarer, Lead, Tricks, Scores
```javascript
scorecards: [
  {
    board: "7",
    contract: "3NT",
    declarer: "S", 
    lead: "♠4",
    tricks: "9",
    score: "+400",
    ns: "3",
    ew: "5"
  },
  // ... more entries
]
```

### 2. Travellers Tab - Supporting
**Use For:** Board-level results across all pairs, frequency of contracts

### 3. Hands Tab - Supporting  
**Use For:** HCP distribution, vulnerability, deal diagrams

## Pre-Writing Analysis (MANDATORY)

### 4 Questions To Answer First:

1. **Which boards materially differentiated results?**
   - Calculate matchpoint spread for each board
   - Identify boards with >3 MP spread as "material"

2. **Contract swing or play swing?**
   - Contract: Different contracts on same board
   - Play: Same contract, different tricks made
   - Use lead data to identify defensive decisions

3. **HCP bias?**
   - Calculate NS avg HCP vs EW avg HCP
   - If difference >2 HCP: SIGNIFICANT, must mention
   - If difference <2 HCP: Not material, can omit

4. **Small gains or big swings?**
   - Count boards with +1 to +3 MP (small gains)
   - Count boards with +4+ MP (big swings)
   - Characterize factually

## Writing Rules

### ✅ DO:
- Cite specific board numbers
- Quote actual contracts from Scorecards
- State actual scores and matchpoint impacts
- Explain swing mechanisms when clear

### ❌ DON'T:
- Use "excellent/outstanding/inspired" without specific evidence
- Congratulate without citing specific achievements
- Generalize to fill word count
- Write humor unless tied to specific data point

## Word Count Guide

- **Strong evidence** (3+ material boards): 350-450 words
- **Moderate evidence** (1-2 material boards): 250-350 words  
- **Weak evidence** (unclear patterns): 150-250 words

**Rule:** Better brief and accurate than long and speculative

## Evidence Checklist (Every Claim)

- [ ] Board number cited?
- [ ] Contracts from Scorecards quoted?
- [ ] Actual scores stated?
- [ ] Mechanism explained?

## Quick Templates

### Material Board Description:
```
"Board [X] proved decisive. Most pairs played [CONTRACT_A], 
but Pair [Y] bid [CONTRACT_B]. The [LEAD] lead [gave/cost] 
declarer [result], scoring [SCORE_A] vs [SCORE_B], 
a [X]-matchpoint swing."
```

### Success Pattern:
```
// Consistent gains:
"Pair X's victory came through [N] boards where they matched 
or beat the field, with no single large loss."

// Big swings:
"Pair X's win rested on Boards [A] and [B], which delivered 
[N] combined matchpoints through [specific mechanism]."
```

### HCP Bias:
```
"NS hands averaged [X] HCP vs EW's [Y], 
a [Z]-point bias that [did/did not] manifest in results."
```

## Red Flags (Stop and Verify)

If you find yourself writing:
- "showed excellent judgment" → Need board number + decision
- "throughout the evening" → Need board count or pattern
- "inspired" / "brilliant" → Need specific action from Scorecards
- "dominated" → Need board-by-board breakdown
- Any humor → Need it tied to specific data anomaly

## Documentation Reference

- **Analytical Discipline:** See `ANALYTICAL_DISCIPLINE.md`
- **Analysis Template:** See `ANALYSIS_TEMPLATE.md`  
- **Scraping Flow:** See `SCRAPING_IMPROVEMENTS.md`

## Bottom Line

**If you can't fill in the brackets with Scorecards data, don't make the claim.**
