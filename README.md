# Certus

Legal-document review with evidence classification and page-specific citation checks.

## Run locally

Install dependencies in `server/` and `client/` with `npm install`.
Copy each `.env.example` to `.env.local` and configure the backend.
Run `npm run dev` in each directory.

- Frontend: http://127.0.0.1:5173
- Backend: http://localhost:5000/api
- Demo: set `MOCK_MODE=true`, configure `JWT_SECRET`, and use a placeholder `MONGODB_URI` to start an in-memory database.
- Live: set `MOCK_MODE=false` and supply the Google Document AI, Gemini, and MongoDB Atlas settings listed in the example file.

Environment files and local credential folders are ignored. Never put API keys in VITE variables or commit credential JSON.

## Current integration status

See [INTEGRATION_STATUS.md](INTEGRATION_STATUS.md) for the full UI/data audit, credential checklist, verification results, and remaining live-service requirements.

Demo mode parses the actual uploaded PDF. AI extraction/chat and vector retrieval remain explicitly simulated. Scanned PDFs require live OCR. Uncited legal authority is never automatically treated as verified.

The example PDF is fictional and intentionally different from the prior employment-contract fixture. Uploads accept PDF only, up to 50 MB.

## API flow

1. `POST /api/auth/register` or `/api/auth/login`
2. `POST /api/documents/upload`: parse/OCR and index the uploaded PDF
3. `POST /api/documents/:id/extract`: extract claims and verify page citations
4. `GET /api/documents/:id`: retrieve source text and claims
5. `POST /api/chat` and `POST /api/documents/:id/whatif`: gated document queries
6. `GET /api/documents/:id/brief`: evidence-derived brief, statistics, and SHA-256 content digest
7. Copy the memorandum or use the browser's Print / Export PDF action.

Citation matching checks textual support, not legal validity. Independent legal-authority verification is not connected.

CourtListener case-law research is available in the Analysis Workspace's Proof Intelligence panel. Set `COURTLISTENER_API_TOKEN` in the backend environment and restart. This search works even while document AI remains in demo mode. Results are research leads with source citations, not automatically verified law.

## Validation

Run `npm run build` in both app directories and `npm test` in `server/`.
The browser regression script is `scripts/verify-flow.cjs`; it needs Playwright and Edge, with both dev servers running.
