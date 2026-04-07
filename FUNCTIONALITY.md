# Club Newsletter — Functionality Overview

## Summary
This project generates a short, witty club newsletter from BridgeWebs session data. It scrapes BridgeWebs for recent session results, extracts rankings and travellers, computes match statistics and hand-level analyses, and renders a polished HTML newsletter suitable for distribution.

## Key Features
- Automatic selection of a recent session (defaults to latest within ~7 days).
- Admin override to specify exact `date` and `type` (Afternoon/Evening).
- Headless scraping of BridgeWebs (login/interaction via Puppeteer) to fetch:
  - Rankings (top pairs)
  - Travellers / board-level results
  - PBN hand diagrams for HCP and deal parsing
- Statistical analysis and narrative generation:
  - HCP distribution, win rates, average matchpoints
  - Board-level analysis for swings, contract splits, slams, doubled contracts
  - Session spotlight, auction heroes, card-play gems, and club pulse
- Produces HTML output of the newsletter and returns structured JSON for further use.

## Architecture
- Frontend: Vite-powered client (development server) for UI and preview.
- Backend: Node.js + Express; primary server code in [server.js](server.js).
- Scraper: [scraper.js](scraper.js) uses Puppeteer to navigate BridgeWebs and extract:
  - Rankings (display_rank)
  - Travellers / board results (display_travs / travellers)
  - PBN hands for deal parsing and HCP calculation
- Dependencies: `puppeteer`, `cheerio`, `axios`/`node-fetch`, `express`, `cors`, `concurrently`, `vite` (see `package.json`).

## API / Endpoints
- POST `/api/generate`
  - Body: `{ date?, type?, override? }` where `date` is YYYY-MM-DD (or internal YYYYMMDD fallback), `type` e.g. `Afternoon`.
  - Behavior: Calls `getSessionData` (in [scraper.js](scraper.js)), then `generateNewsletter` (in [server.js](server.js)) and returns `{ success, html, data, eventId }`.
  - Example usage: the frontend calls this endpoint to build the newsletter HTML for preview/download.

## Data Flow
1. Request to `/api/generate` reaches the Express server.
2. Server invokes `getSessionData(eventDate, type)` which:
   - Launches headless Chrome via Puppeteer.
   - Navigates BridgeWebs home/results pages, selects an event, fetches rankings, travellers and PBN.
   - Parses travellers into board objects and merges hand PBN (HCP, dealer, vuln).
3. Server runs `generateNewsletter(data)`:
   - Computes overall statistics, board analyses, and identifies highlights.
   - Produces premium HTML for the newsletter (returned as `html`).
4. Response contains both the generated HTML and the raw parsed data for downstream processing.

## Important Files
- [server.js](server.js) — Express server and `generateNewsletter` implementation.
- [scraper.js](scraper.js) — Puppeteer scraping logic and data parsing (`getSessionData`).
- [README.md](README.md) — Project README with dev/run instructions.
- [package.json](package.json) — Dependencies and npm scripts.
- Frontend files: `index.html`, `src/main.js` and UI under `src/` (Vite app).

## How to Run (development)
1. Install deps:

```bash
npm install
```

2. Start backend and frontend (concurrently):

```bash
npm run start
```

- `npm run serve` runs `node server.js` (server on port 3002).
- `npm run dev` starts Vite for frontend development.

3. Use the UI at the configured port (README suggests `http://localhost:3000`) or call the API directly.

## Configuration & Secrets
- The scraper expects the BridgeWebs site to be accessible and may require credentials if pages are behind login. Credentials are not stored in this repo—supply them securely (env vars or a secrets store) if required.
- `CLUB_ID` is set to `'liverpool'` by default in [scraper.js](scraper.js). Update as needed.

## Limitations & Notes
- Scraping is brittle by nature: changes on BridgeWebs pages (DOM structure, link formats) may break scraping heuristics. [scraper.js](scraper.js) contains many fallbacks but may still need updates.
- Puppeteer is run headless by default; running headful (headless:false) can aid debugging.
- The newsletter generation is tailored to UK-style Bridge commentary and makes assumptions about traveller table structure.
- PBN parsing is used to compute HCP and deal metadata; not all events may expose PBN in the expected location.

## Next Steps / Enhancements (optional)
- Add a configuration file or env-based config for `CLUB_ID`, credentials, and timeouts.
- Add cached fetching to avoid re-scraping the same event repeatedly.
- Provide an export option to PDF (server-side rendering of HTML → PDF) for direct download.
- Add unit tests for the parsing heuristics in `scraper.js`.

---
Generated automatically from repository files: [package.json](package.json), [README.md](README.md), [server.js](server.js), [scraper.js](scraper.js).
