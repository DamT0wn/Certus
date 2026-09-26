# Integration and UI audit

## Implemented

- Shared CSS status tokens: document facts and verified states use deep forest `#2F5233`; inferences use ochre; rejected claims use brick. All badges use the same tokens in intake, analysis, and brief.
- Intake legend is one divided strip on tablet/desktop, stacked inside the same border on narrow screens. PROOFS has a brass hairline pill. Lucide interface icons share a 1.75 stroke width. Demo login uses navy.
- Analysis uses switchable panels below 1024px. Toolbars wrap, document paper fits the available width, and brief metadata/cards wrap on phones.
- Existing API routes drive upload/parsing, extraction, chat, scenarios, document retrieval, and brief generation. Citation verification runs inside extraction/chat/scenario processing; no separate verification endpoint is required.
- Claim counts, review counts, citation match scores, pass rate, page count, summary, and content digest come from backend evidence. Removed the employment-contract viewer fallback, fixed salary/jurisdiction summary, fixed risk scenarios, and fake hash.
- SHA-256 covers a versioned JSON representation of OCR text and persisted claim evidence. It is a content digest, not a digital signature, proof of legal correctness, or immutable audit log.
- Page-specific verification rejects quotes attributed to the wrong page. Unspecified pages are resolved from the actual source quote when possible.
- The former uncited VERIFIED_LAW exemption is removed. CourtListener case-law search is connected, but search results do not authenticate a legal proposition or its current validity; legal assertions requiring independent verification remain UNVERIFIED.
- Async API errors reach Express error handling. UI has loading/error states for auth, upload, extraction, document loading, chat, scenarios, brief loading, and clipboard export. PDF export uses the browser print dialog.

## What is running locally

| Component | Current behavior |
| --- | --- |
| Authentication and HTTP API | Real local Express/Mongoose endpoints |
| Database | In-memory MongoDB; not durable production storage |
| PDF text | Actual uploaded PDF parsed with pdf-parse; no substituted contract |
| Scanned PDF OCR | Requires configured Google Document AI; demo rejects PDFs without readable text |
| Extraction | Demo sentence extraction from the actual document; not live Gemini |
| Chat | Demo source excerpt retrieval; not live Gemini reasoning |
| Scenarios | Explicitly report unavailable reasoning in demo mode; no fabricated findings |
| Embeddings and search | Deterministic demo vectors and keyword retrieval |
| Citation gate, statistics, digest, brief, export | Real computation from stored evidence |
| External law verification | Unavailable pending selection and approval of a source/provider |
| Case-law research | Live CourtListener search in Proof Intelligence; source links and metadata, no automatic VERIFIED_LAW promotion |

## Credentials and infrastructure still required

The local configuration has placeholder MongoDB, Google Cloud project, and Gemini values. No accounts, paid services, or deployment targets were provisioned. Live cloud operation has not been tested.

Fill `server/.env.local` (or real deployment environment variables):

- `MOCK_MODE=false`
- `MONGODB_URI`: existing Atlas connection URI with a vector index named `embedding_index` on `chunks.embedding`, plus `documentId` as a filter. The vector index dimensions must match the selected embedding model's output.
- `JWT_SECRET`: a strong random signing secret.
- `GCP_PROJECT_ID`, `GCP_LOCATION`, `DOCAI_PROCESSOR_ID`, `GOOGLE_APPLICATION_CREDENTIALS`: existing Document AI processor and credential-file path. Keep credential JSON inside ignored `server/credentials/` for local development.
- `GEMINI_API_KEY`, `GEMINI_MODEL`, `EMBEDDING_MODEL`: enabled API key and available model identifiers for that account. Availability and live output dimensions remain to be verified.
- `PORT`: optional; defaults to 5000.

The backend loads `.env.local`, then `.env`, without overriding deployment environment variables. Live startup fails for missing/placeholder configuration or database connection failure instead of silently serving mocked data.

Optional frontend configuration in `client/.env.local`: `VITE_API_BASE_URL` (default `/api`) and `API_PROXY_TARGET` (Vite development proxy, default `http://localhost:5000`). VITE variables are public: never put credentials there. Both example environment files contain variable names without real values. `.env` and `.env.local` are ignored and not tracked.

## Verification

- Client and server TypeScript production builds pass.
- 44 server tests pass, including wrong-page citation, source-page resolution, digest stability, unsupported-law rejection, and CourtListener authentication/error/response handling checks.
- Browser flow uses a valid fictional two-page services agreement containing a $7,500 fee and fifteen-day notice, rather than the old employment fixture.
- Automated browser checks cover upload, parsing, extraction, page citations, chat, scenario handling, brief generation, stable digest, clipboard copy, and PDF generation.
- Intake, each analysis panel, and brief tested at 375px and 768px, plus desktop 1440px. No document-level horizontal overflow. Screenshots inspected.
- Network-failure checks cover upload, extraction, chat, scenarios, and brief loading.
- Sample PDF and exported brief rendered for visual inspection. Test artifacts are local in ignored `tmp/qa/`.

Reproduce browser checks with `scripts/verify-flow.cjs` while both dev servers run. Provide `PLAYWRIGHT_PATH` if Playwright is not installed on the module path; the script uses a local Edge browser. Recreate the example PDF with `scripts/create-sample.py` using ReportLab.

## Remaining boundary

A real customer document and configured cloud credentials are needed to validate Google OCR, Gemini extraction/reasoning, Atlas retrieval, quotas, scanned documents, and persistence end-to-end. The successful local test does not establish that these external services work. CourtListener authentication and live search have been tested separately. Full legal-proposition verification and current-treatment checks remain to be designed; provisioning missing infrastructure requires user direction.

## CourtListener setup

Set `COURTLISTENER_API_TOKEN` in the ignored `server/.env.local` or deployment environment. Restart the backend after changing it. `GET /api/research/cases?q=contract` requires a Certus bearer token and forwards the user-entered query to CourtListener with server-side token authentication. This works independently of `MOCK_MODE`; uploaded contract text is not automatically sent. Results show up to ten cases with court, filing date, citations, excerpt, and canonical source link. Open Analysis Workspace → Proof Intel → US case-law research. `scripts/verify-courtlistener.cjs` tests the live browser flow and the rate-limit error state.
