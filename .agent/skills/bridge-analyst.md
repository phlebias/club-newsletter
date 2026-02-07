---
name: Bridge Analyst
description: Advanced bridge hand analysis including PBN parsing, Double Dummy comparisons, and performance metrics.
---

# Bridge Analyst Skill

This skill provides advanced analytical capabilities for bridge session data. It is designed to work with PBN (Portable Bridge Notation) files and standard bridge scoring data to produce deep insights into player performance and hand dynamics.

## Core Capabilities

1.  **PBN Extraction & Parsing**
    - Fetches PBN data from BridgeWebs 'Hands' tab (or equivalent API).
    - Parses standard PBN tags including `Deal`, `Vulnerable`, `Dealer`.
    - Extracts Double Dummy Analysis (DDA) tags: `DoubleDummyTricks`, `OptimumScore`, `OptimumResultTable`.

2.  **Double Dummy Analysis**
    - **Double Dummy Par**: Identifies the theoretical best result for both sides.
    - **Killer Leads**: Identifies opening leads that defeat a contract which is otherwise makable, or leads that allow a contract to make which should go down.
    - **Par Comparison**: Compares actual table results against the double dummy par to evaluate field performance.

3.  **HCP Efficiency**
    - Calculates the "Tricks per HCP" metric for declarers.
    - Identifies pairs who consistently outperform their card strength.

## Implementation Details

### PBN Parsing Logic
When parsing PBN files, ensure you handle the following tags:
- `[Deal "N:..."]`: The hand distribution.
- `[DoubleDummyTricks "abcd..."]`: A string representing makeable tricks for N, S, E, W in denominations NT, S, H, D, C.
    - Format usually: 5 denominations * 4 positions (or vice versa). Verify against PBN standard.
    - *Standard PBN DoubleDummyTricks order*: North (NT,S,H,D,C), South, East, West. (Checking spec is recommended).

### Killer Leads Logic
A "Killer Lead" is defined as a lead that results in a score significantly different from the Double Dummy expectation.
- *Condition*: Contract is Makable (DD Tricks >= Contract Level + 6).
- *Result*: Contract goes Down.
- *Attribution*: The opening lead is the primary suspect (though defense play matters).
- *Reverse*: Contract is Downable (DD Tricks < Contract Level + 6). Result: Contract Makes. Attribution: Favorable lead or defensive error.

### HCP Efficiency
Metric: `(Actual Tricks Won - Expected Tricks based on HCP) / HCP`
- Or simply: `Average (Result Score - Par Score)` (Par difference).
- Simple Metric: `Tricks / HCP` (noisy for single boards).
- Robust Metric: Compare `Actual Score` vs `Work Point Expectation` (Milton Work: 4/3/2/1).

## Usage
Include this logic in the session analysis pipeline to generate the "Session Spotlight" and "Card Play Gems" sections of the newsletter.

## Reporting Requirements
Every report must conclude with a persistent "Glossary" section.
- **Tone**: Witty, dry, and direct.
- **Content**:
    - **Double Dummy**: The computer plays as if everyone can see everyone else's cards. It never guesses. It's bridge played with the lights on.
    - **Killer Leads & Par Breakers**: "Par" is the computer's prediction of perfect play. A Par Breaker is when a human proves the computer wrong—either by making the "impossible" or finding the one Killer Lead that sinks a "sure thing."
    - **HCP Efficiency**: Measures what you actually did with your cards. A Positive (+) Diff means you're squeezing blood from a stone. A Negative (-) Diff means you likely left a few tricks on the table as a charitable donation.
    - **Avg Diff**: The average number of tricks gained or lost per hand against the "perfect" baseline.

## Narrative Integration
When the scraper identifies a Par Breaker, the agent must write a punchy one-sentence summary for the "Killer Leads" section, naming the specific player who "beat the odds" or "found the killer defense".

## Persistence & Maintenance
- **Glossary**: The "Witty Glossary" must remain a permanent fixture in the footer of every report.
- **Layout Changes**: If the Bridgewebs HTML layout changes, the agent is authorized to use its browser tool to find the new paths for the 'Hands' tab and PBN download to maintain these specific report sections.

