# Admin Export Prototype

This prototype is a safe, standalone experiment for testing whether BridgeWebs admin exports are a better source of session data than the current traveller-based scrape.

## Safety Rules

- Do not import the production runtime path.
- Do not modify the live scraper or server from this prototype.
- Do not overwrite production reports or session data.
- Save all downloaded fixtures and parsed outputs inside this folder only.
- Treat this as a shadow-mode validator until proven reliable.

## Goals

- Log into BridgeWebs administration safely.
- Navigate to the results recovery/export area.
- Download raw PBN and XML files for a chosen event.
- Parse those files into a normalized JSON shape.
- Compare the parsed output with the existing scraper output for the same event.

## Folder Layout

- `src/`: prototype scripts
- `fixtures/raw/`: saved admin export files
- `fixtures/parsed/`: normalized JSON derived from raw exports
- `reports/`: human-readable comparison summaries

## Intended Workflow

1. Capture raw admin exports for a known session.
2. Parse the saved files offline.
3. Compare prototype output against the current scraper output.
4. Repeat on multiple sessions before any integration decision.

## Current Stage

Stage 1 is implemented as a capture-only CLI:

- logs into BridgeWebs admin using environment variables
- tries to reach the recover/export area
- saves page snapshots and any visible PBN/XML links into `fixtures/raw/<capture-label>/`
- writes `capture-metadata.json` describing what it found

### Environment

Copy `.env.example` to `.env` and fill in:

- `BRIDGEWEBS_ADMIN_USER`
- `BRIDGEWEBS_ADMIN_PASSWORD`
- optional `BRIDGEWEBS_RECOVER_URL` if direct navigation is easier than text-link discovery
- either `EVENT_ID` or `SESSION_DATE` plus `SESSION_TYPE`

### Run

From the repo root:

```bash
node experiments/admin-export/src/index.js --capture
```

## Notes

- This stage does not parse exports yet.
- This stage has not been live-validated here, so the recover-page navigation is intentionally conservative and snapshot-heavy.
- If BridgeWebs uses a different recover URL or label text, set `BRIDGEWEBS_RECOVER_URL` to remove that uncertainty.

## Status

Capture prototype in place. No production behavior has been changed.
