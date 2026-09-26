# Certus

Legal-document review with evidence classification and page-specific citation checks.

## Run locally

Install dependencies in `server/` and `client/` with `npm install`.
Copy each `.env.example` to `.env.local` and configure the backend.
Run `npm run dev` in each directory.

- Frontend: http://127.0.0.1:5173
- Backend: http://localhost:5000/api
- Deployed demo: fully self-contained browser mock. It requires no database, authentication service, API keys, or backend environment variables. Data stays in the current browser tab and is cleared when that tab closes.
- Live: set `MOCK_MODE=false` and supply the Google Document AI, Gemini, and MongoDB Atlas settings listed in the example file.

Environment files and local credential folders are ignored. Never put API keys in VITE variables or commit credential JSON.

## Current integration status

See [INTEGRATION_STATUS.md](INTEGRATION_STATUS.md) for the full UI/data audit, credential checklist, verification results, and remaining live-service requirements.

Demo mode parses the actual uploaded PDF. AI extraction/chat and vector retrieval remain explicitly simulated. Scanned PDFs require live OCR. Uncited legal authority is never automatically treated as verified.

The example PDF is fictional and intentionally different from the prior employment-contract fixture. Uploads accept PDF only, up to 50 MB.

## Deployed demo flow

1. The browser creates a temporary anonymous session identifier scoped to the current tab.
2. PDF.js parses readable PDF text locally; the file is not uploaded.
3. Deterministic mock logic extracts claims and attaches page citations.
4. Browser-local Q&A and scenario analysis retrieve clauses from the parsed text.
5. The browser generates an evidence brief, statistics, and SHA-256 content digest.
6. Copy the memorandum or use the browser's Print / Export PDF action.

Citation matching checks textual support, not legal validity. Independent legal-authority verification is not connected.

External case-law research is intentionally disabled in the deployed mock so no search terms or document data leave the browser. The optional backend retains the CourtListener integration for future live use.

## Validation

Run `npm run build` in both app directories and `npm test` in `server/`.
The browser regression script is `scripts/verify-flow.cjs`; it needs Playwright and Edge, with both dev servers running.
