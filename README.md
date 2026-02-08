# IndiaAI Financial Reporting Compliance Platform

This repository now includes a commercial-grade frontend prototype targeted at government officials and enterprise compliance teams.

## What it does

- Ingests multi-format files: TXT, CSV, JSON, PDF and scanned images (PNG/JPG).
- Extracts text from digital documents and OCRs scanned uploads.
- Chunks extracted text for indexing and retrieval.
- Runs explainable rule-based compliance checks for Ind AS / RBI / SEBI related requirements.
- Generates analytics from extracted content.
- Runs a preliminary risk/examination scan for red-flag signals.
- Includes an NFRA Insight Bot UI to query chunked content.
- Exports a compliance validation report as JSON.

## Run locally

Because this is a browser app with module scripts, use a local static server:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Security posture

- Document text processing is done in-browser to minimize data exposure.
- No outbound upload calls are implemented for uploaded document contents.
- The UI is structured for clear state visibility and professional use in review workflows.
