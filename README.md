
# Bridge Club Newsletter Generator

A premium tool for creating witty, insightful newsletters for BridgeWebs sessions.

## Features
- **Automatic Session Selection**: Picks a random standard session from the last 7 days.
- **Admin Override**: Manually specify any session date and type.
- **Deep Data Retrieval**: Logs into WebAdmin and scrapes full hand data and travellers.
- **AI-Style Commentary**: Generates a cheeky, engaging report in the style of a UK bridge analyst.
- **Analytical Discipline**: All commentary is evidence-based, drawn primarily from Scorecards data (contract, declarer, lead, tricks, scores), supported by Travellers and Hands. See [ANALYTICAL_DISCIPLINE.md](ANALYTICAL_DISCIPLINE.md) for strict requirements.

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the backend server:
   ```bash
   npm run serve
   ```
3. Start the frontend development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Tech Stack
- **Frontend**: HTML5, Vanilla CSS (Glassmorphism), JavaScript (ES Modules), Vite.
- **Backend**: Node.js, Express, Puppeteer (for scraping), Cheerio.
- **Data Source**: BridgeWebs (Liverpool Bridge Club).

## Application Flow
1. On launch, the app attempts to select a session from the last 7 days.
2. If the admin override is enabled, it uses the provided date/type.
3. The server logs into the BridgeWebs WebAdmin using the provided credentials.
4. **Improved Navigation Flow**:
   - Navigate to home page, top-left click results for the desired date
   - Switch to classic edition using the switch button on top right (if available)
   - Access the **Scorecards tab** (main source for analysis) - shows players history with:
     - Contract
     - Declarer (by who)
     - Lead
     - Tricks made
     - Scores
   - Access **Travellers tab** for additional board-level information
   - Access **Hands tab** for deal diagrams and HCP distribution
5. It analyzes the data for swings, bidding brilliance, and play highlights.
6. A formatted newsletter is presented to the user.
