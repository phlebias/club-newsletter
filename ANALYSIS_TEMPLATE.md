# Newsletter Analysis Template

## Step 1: Data Extraction (from Scorecards, Travellers, Hands)

### Scorecards Data Structure
```javascript
{
  board: "7",
  contract: "3NT",
  declarer: "S",
  lead: "♠4",
  tricks: "9",
  score: "+400",
  ns: "3",
  ew: "5"
}
```

### Analysis Calculations Required

#### A. Identify Material Boards
For each board, calculate:
- Matchpoint spread (max score - min score)
- Number of different contracts played
- Frequency of makes/defeats
- Identify boards with spread >3 matchpoints as "material"

#### B. Swing Classification
For each material board:
```
IF contracts differ:
  → "Contract Swing"
  → Record: contracts chosen, results, what succeeded
ELSE IF contracts same but tricks differ:
  → "Play Swing"  
  → Record: contract, lead card, tricks made by each pair
  → Identify: lead or declarer play as differentiator
```

#### C. HCP Bias Calculation
```javascript
nsHCP_total = sum of all boards' nsHCP
ewHCP_total = sum of all boards' ewHCP
boardCount = number of boards

nsAvg = nsHCP_total / boardCount
ewAvg = ewHCP_total / boardCount
bias = abs(nsAvg - ewAvg)

IF bias > 2.0:
  significant = true
  favors = (nsAvg > ewAvg) ? "NS" : "EW"
```

#### D. Success Pattern Analysis
For top 3 pairs, track each board:
```javascript
smallGains = 0  // +1 to +3 matchpoints
largeSwings = 0 // +4+ matchpoints

for each board:
  mpGain = pairScore - averageScore
  if (mpGain >= 1 && mpGain <= 3): smallGains++
  if (mpGain >= 4): largeSwings++

pattern = (smallGains > largeSwings * 2) 
  ? "consistent small edges" 
  : "key large swings"
```

## Step 2: Pre-Writing Evidence Check

### Required Evidence (Minimum)
- [ ] At least 1 board identified where specific decision mattered
- [ ] Actual contracts/scores from Scorecards for that board
- [ ] Clear mechanism of swing (contract choice OR lead OR play)
- [ ] Top pair's record supported by actual board performances

### If Evidence Insufficient
- Reduce target to 150-250 words
- Focus only on verifiable facts
- List final standings without speculation

## Step 3: Newsletter Structure (Evidence-Based)

### Opening (1-2 sentences)
State the session outcome factually:
- Date, session type
- Winner and their score
- Brief context ONLY if HCP bias is significant

**Example:**
> "The 29th January Evening session saw Pair 3 (Smith/Jones) take first with 58%, despite NS hands averaging 21.3 HCP vs EW's 18.7."

### Body (200-350 words)

#### Section 1: Key Board(s) - REQUIRED
Must cite at least one specific board:

**Template:**
> "Board [X] proved decisive. [Most pairs played CONTRACT_A], but [Pair Y] bid [CONTRACT_B]. [Lead/Play detail from Scorecards]. This resulted in [SCORE_A] vs [SCORE_B], a gain of [X] matchpoints."

**Requirements:**
- Board number
- Contracts (from Scorecards)
- Lead card (from Scorecards) if relevant to outcome
- Tricks made (from Scorecards)
- Actual scores
- Matchpoint impact

#### Section 2: Success Pattern - IF DATA SUPPORTS
Only if you have board-by-board breakdown:

**Template (Consistent Gains):**
> "Pair 3's victory came through disciplined accumulation. They matched or bettered the field on 14 of 18 boards, never suffering a large loss."

**Template (Key Swings):**
> "Pair 3's win rested on two key boards. Board 7 (3NT making vs 2NT) and Board 14 (successful 4♠ sacrifice) delivered 9 combined matchpoints."

#### Section 3: Notable Pattern - OPTIONAL
Only if data clearly shows:
- Unusual contract distribution
- Persistent defense/declarer play issue
- HCP bias impact

### Closing (1-2 sentences)
Brief factual summary, no congratulations unless tied to specific achievement.

## Step 4: Word Count Management

- **Strong Evidence (3+ material boards identified)**: 350-450 words
- **Moderate Evidence (1-2 material boards)**: 250-350 words
- **Weak Evidence (patterns unclear)**: 150-250 words

**Never pad with generalizations to reach target.**

## Step 5: Quality Verification

### Every Claim Checklist
For each statement in newsletter:
- [ ] Can I cite the board number?
- [ ] Can I quote the contracts from Scorecards?
- [ ] Can I state the actual scores?
- [ ] Can I explain the mechanism?

### Prohibited Phrases (Unless Evidence Exists)
- ❌ "excellent judgment" → ✅ "bid 3NT on Board 7, making 9 tricks"
- ❌ "outstanding play" → ✅ "found the club switch on Board 12"
- ❌ "inspired decisions" → ✅ "chose to compete to 3♠ on Board 5"
- ❌ "dominated the field" → ✅ "bettered the field on 12 of 16 boards"

## Example Newsletter (Evidence-Based)

### Strong Evidence Version (400 words)

> **Liverpool Bridge Club – 29th January 2026 Evening Session**
>
> Pair 3 (Smith/Jones) claimed first place with 58.2%, edging out Pair 7 (Brown/Davis) on 56.1%. The 16-board session saw NS hands averaging 21.1 HCP against EW's 18.9, a bias that manifested in the scoreline.
>
> Board 7 provided the evening's largest differential. Most pairs in the NS seats reached 3NT, but the route varied. Pair 3 bid a direct 1NT-3NT, while Pair 7 went via Stayman before reaching game. West's ♠4 lead gave nine tricks to all declarers who received it, scoring +400. However, Pair 11 stopped in 2NT after a weak notrump sequence, making the same nine tricks for only +150—a 4-matchpoint loss directly attributable to contract selection.
>
> Board 12 split the field. Five pairs bid the making 4♠, four stopped in 3♠ (also making ten tricks), and two defended 4♥ doubled, which went one off. Pair 3's data shows they bid 4♠, declarer made ten tricks after the ♦K lead, scoring +420. The defenders in 4♥X collected +200. The 3♠ bidders scored +170. Remarkably, Pair 7 bid and made 4♠ as well—this board did not differentiate the top two.
>
> Board 15 proved crucial. Pair 3's scorecard shows 3NT by South, making nine tricks, +400. The lead was ♥6. Five other pairs also reached 3NT, but three went down when declarers misread the position after the same heart lead, scoring -50. Pair 7 was one of the successful declarers. The 450-point difference (450 matchpoints across the field) stemmed from declarer play rather than contract or lead selection.
>
> Pair 3's path to victory showed relentless accuracy rather than spectacular swings. Across 16 boards, they matched or exceeded the field mean on 13 boards. Only Board 4 (where they went down in 3♣ when others made 2♣) and Board 9 (defending 2♠ making when others defeated it) showed losses exceeding 2 matchpoints.
>
> The NS bias manifests in the final standings: the top four pairs all sat NS for at least half the session. However, Pair 7's strong EW showing demonstrates the bias was not insurmountable—they averaged 62% sitting East-West against moderate NS competition.

### Weak Evidence Version (175 words)

> **Liverpool Bridge Club – 29th January 2026 Evening Session**
>
> Pair 3 (Smith/Jones) won the 16-board session with 58.2%, ahead of Pair 7 (Brown/Davis) on 56.1%. NS hands averaged 21.1 HCP vs EW's 18.9.
>
> Board 7 showed the widest scoring spread. Most pairs bid 3NT making nine tricks (+400), but one pair stopped in 2NT (+150). This 4-matchpoint differential on a single board represents the clearest example of contract selection impact visible in the Scorecards data.
>
> Board 12 saw varied contracts: 4♠ (+420), 3♠ (+170), and 4♥X-1 (+200 to defense). The spread was moderate; the board did not materially affect standings.
>
> Pair 3's data shows they matched or bettered the field on 13 of 16 boards, with no individual board delivering more than 5 matchpoints. Their victory came through consistent accuracy rather than isolated swings.
>
> The NS HCP advantage contributed to NS pairs occupying four of the top five positions.

## Summary

**The template forces evidence-first writing. If you cannot populate the required fields from Scorecards/Travellers/Hands, you cannot make the claim.**
