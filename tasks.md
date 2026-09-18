# Certus — Implementation Tasks

## Ordering & Conventions

Tasks are ordered so each one is independently testable before the next begins. Dependencies are noted where they exist. Each task is tagged:

- **Antigravity** — backend pipelines, live API integrations, scaffolding, data layer
- **Copilot** — precise/manual logic: verification function, PDF viewer interactions, schema enforcement
- **Kiro** — test hooks, lint hooks, schema validation automation

A task is "done" when it passes its acceptance criteria in isolation, without requiring downstream tasks to be complete.

---

## Phase 0: Project Scaffolding

### TASK-001 — Initialize monorepo structure
**Agent:** Antigravity
**Depends on:** nothing

Set up the workspace layout:
```
/client     → React app (Vite + Tailwind)
/server     → Express app
/shared     → TypeScript types shared between client and server
```

Initialize:
- `/server`: `npm init`, `express`, `mongoose`, `multer`, `joi`, `pdfkit`, `dotenv`, `cors`
- `/client`: `npm create vite@latest` with React + TypeScript template, `tailwindcss`, `pdf-dist` (PDF.js)
- `/shared`: TypeScript interface definitions for `Chunk`, `Claim`, `ExtractionResult`, `VerificationResult`, `QAResponse`
- Root `.env.example` with all keys from design.md environment config section
- `README.md` with local dev setup instructions

**Acceptance:** `npm run dev` starts both client (port 5173) and server (port 3001) without errors. Shared types import cleanly in both packages.

---

### TASK-002 — MongoDB Atlas connection + schema setup
**Agent:** Antigravity
**Depends on:** TASK-001

- Configure Mongoose connection with connection pooling and retry logic
- Define Mongoose models for all five collections: `Document`, `Chunk`, `Extraction`, `QALog`, `AuditLog` — using the schemas from design.md
- Create Atlas Vector Search index on `chunks.embedding` (cosine, 768 dimensions) — document the manual Atlas UI step in README since Atlas index creation is not scriptable via Mongoose
- Seed script that inserts a test document record and verifies connection

**Acceptance:** Seed script runs, inserts a document, and retrieves it by ID. Vector Search index exists in Atlas (manual verification step documented).

---

### TASK-003 — Lint, format, and type-check hooks
**Agent:** Kiro
**Depends on:** TASK-001

- Configure ESLint (flat config, TypeScript rules) for `/client` and `/server`
- Configure Prettier with consistent rules across both packages
- Set up `tsc --noEmit` type-checking in both packages
- Create a Kiro `fileEdited` hook on `**/*.ts` and `**/*.tsx` that runs lint + type-check on save
- Add `npm run lint` and `npm run typecheck` scripts to both `package.json` files

**Acceptance:** Introducing a TypeScript error in any `.ts` file triggers the hook and surfaces the error within 5 seconds of save.

---

## Phase 1: Document Upload & OCR

### TASK-004 — File upload endpoint
**Agent:** Antigravity
**Depends on:** TASK-001, TASK-002

- `POST /api/documents/upload` accepts multipart PDF upload (max 50 MB, enforced by multer)
- Validates file type (MIME type `application/pdf` only)
- Creates a `Document` record in MongoDB with status `UPLOADING`
- Stores the uploaded file in `/tmp/{documentId}.pdf` for pipeline processing
- Returns `{ documentId, status: "UPLOADING" }` immediately (pipeline runs async)
- `GET /api/documents/:id/status` returns current status and `errorMessage` if set

**Acceptance:** Upload a valid PDF → receive `documentId`. Upload a `.txt` file → receive 400 with descriptive error. Upload a 51 MB file → receive 413.

---

### TASK-005 — Google Document AI OCR integration
**Agent:** Antigravity
**Depends on:** TASK-004

- Integrate `@google-cloud/documentai` SDK
- Send uploaded PDF to Document AI processor; handle async operation polling
- Parse response: extract text blocks with `pageNumber`, `blockIndex`, bounding box, `charStart`, `charEnd`
- Segment into paragraph-level chunks (max 512 tokens; 1-paragraph overlap at boundaries)
- Assign stable `chunkId` per chunk (deterministic hash of `documentId + pageNumber + blockIndex`)
- Update document status to `OCR` → `EXTRACTING` as pipeline progresses
- On Document AI error: set status `ERROR`, set `errorMessage`, do not crash the process

**Acceptance:** Upload a known test PDF with at least 3 pages. After processing, query `chunks` collection and confirm: correct page numbers, non-empty text, bounding box coordinates present, no chunk exceeds 512 tokens.

---

### TASK-006 — Embedding pipeline
**Agent:** Antigravity
**Depends on:** TASK-005

- Integrate Google `text-embedding-004` via the Vertex AI or Generative AI SDK
- Batch-embed all chunks for a document (batch size 20 to stay within API limits)
- Store embedding vectors in `chunks.embedding` field
- Update document status to `INDEXING` during this phase, then `READY`
- Retry failed embedding calls up to 3 times with exponential backoff

**Acceptance:** After processing, every chunk for the test document has a 768-element float array in `embedding`. Document status transitions to `READY`.

---

### TASK-007 — Upload UI with progress stages
**Agent:** Antigravity
**Depends on:** TASK-004

- `DocumentUploader` component: drag-and-drop zone + file picker button
- Shows progress bar with discrete stage labels: Uploading → OCR → Extracting → Indexing → Ready
- Polls `GET /api/documents/:id/status` every 2 seconds until status is `READY` or `ERROR`
- On `ERROR`: displays `errorMessage` in a red alert, allows re-upload
- Rejects non-PDF files client-side before upload with inline error

**Acceptance:** Upload a PDF and observe all 5 status stages render in order. Upload a `.jpg` file and see client-side rejection. Simulate server returning `ERROR` status and verify error display.

---

## Phase 2: Structured Extraction with Proof Mode

### TASK-008 — Gemini structured extraction call
**Agent:** Antigravity
**Depends on:** TASK-006

- Integrate Gemini API (`@google/generative-ai` SDK) for the extraction call
- Construct the extraction prompt using the full document text (concatenated from stored chunks)
- Instruct Gemini to return strict JSON matching the extraction schema defined in design.md
- Parse and validate the response JSON against the schema (use Zod for validation)
- On schema validation failure: retry once; on second failure set document to `ERROR` with message "Extraction schema validation failed"
- Store raw Gemini response hash in `auditLogs`

**Acceptance:** Run extraction on the test document. Confirm the returned JSON passes Zod schema validation. Confirm an `auditLog` record exists with a non-null `promptHash` and `responseHash`.

---

### TASK-009 — VERIFIED_LAW label upgrade logic
**Agent:** Copilot
**Depends on:** TASK-008

- After Gemini extraction, scan all `DOCUMENT_FACT` claims for statutory citation patterns
- Regex patterns to match (non-exhaustive, extendable): `\d+\s+U\.S\.C\.\s+§`, `\d+\s+C\.F\.R\.\s+§`, `[A-Z][a-z]+\s+Act\s+of\s+\d{4}`, `Article\s+[IVXLC]+`, `Section\s+\d+`
- Claims matching any pattern are upgraded from `DOCUMENT_FACT` → `VERIFIED_LAW`
- The matched citation string is stored in a `statutoryCitation` field on the claim
- This logic must be a pure function: `upgradeToVerifiedLaw(claims: Claim[]): Claim[]`

**Acceptance:** Unit test: inject a claim containing "42 U.S.C. § 1983" → verify label becomes `VERIFIED_LAW`. Inject a claim with no statutory pattern → verify label stays `DOCUMENT_FACT`.

---

### TASK-010 — Citation Verification Function (core implementation)
**Agent:** Copilot
**Depends on:** TASK-006, TASK-008

This is the trust boundary of the system. Implement with full care.

- Implement `verifyCitation(input: VerificationInput): Promise<VerificationResult>` as described in design.md
- Step 1: Fetch cited chunks from MongoDB by `chunkId`
- Step 2: Tokenize using a simple whitespace + punctuation tokenizer (no external NLP library); compute token-level Jaccard similarity between claim and each chunk
- Step 3: Compute cosine similarity between claim embedding (embed on demand via `text-embedding-004`) and stored chunk embeddings
- Step 4: Apply thresholds from env vars (with defaults 0.25 / 0.80)
- Step 5: Return `VerificationResult` with `verified`, `matchScore`, `matchedPassage`, `method`
- Handle edge cases: empty `citedChunkIds` → `verified: false`; chunk not found in DB → skip that chunk, log warning

**Acceptance:** See TASK-011 for full test suite. Smoke test: run on an extracted claim from the test document and confirm the result structure matches the interface.

---

### TASK-011 — Citation Verification Function test suite
**Agent:** Kiro
**Depends on:** TASK-010

Write a complete unit test suite (Jest) for `verifyCitation`:

| Test case | Expected result |
|---|---|
| Claim is verbatim substring of chunk | `verified: true`, `method: lexical` |
| Claim is semantically similar but lexically different | `verified: true`, `method: semantic` |
| Claim is unrelated to all cited chunks | `verified: false` |
| `citedChunkIds` is empty array | `verified: false`, `matchScore: 0` |
| Cited chunk does not exist in DB | `verified: false`, warning logged |
| Single word claim against long chunk | correct Jaccard calculation verified |
| Thresholds overridden via env vars | behavior reflects new thresholds |

All DB calls must be mocked (no real MongoDB connection in unit tests).

**Acceptance:** `npm test` runs all cases, 100% pass, coverage report shows 100% line coverage of the verification function file.

---

### TASK-012 — Store extraction results with verification
**Agent:** Antigravity
**Depends on:** TASK-010, TASK-009

- After extraction and VERIFIED_LAW upgrade, run `verifyCitation` on every claim
- Store the full extraction result (all claims + verification results) in the `extractions` collection
- `GET /api/documents/:id/extraction` returns the stored extraction JSON

**Acceptance:** After full pipeline run on test document, query the extraction endpoint and confirm every claim has a `verification` object with `verified` field and `matchScore`.

---

### TASK-013 — Extraction results UI (Proof Mode badges)
**Agent:** Copilot
**Depends on:** TASK-012

- `ProofBadge` component: pill/badge rendering for each label with correct colors (green / blue / amber / red)
- `ExtractionPanel` component: groups claims by category (parties, dates, obligations, etc.)
- Each claim shows: claim text, `ProofBadge`, matched passage (truncated, expandable), verification checkmark or ✗
- `AI_INFERENCE` / `UNVERIFIED` claims render with a tooltip showing `reasoning` and `confidence`
- `UNVERIFIED` claims display a red banner: *"This item could not be verified against the document. Independent review required."*
- Failed verification claims (verified: false) show a distinct icon from unverified-label claims

**Acceptance:** Load the test document extraction in the UI. Confirm all four badge types render with correct colors. Click an `AI_INFERENCE` claim tooltip and see `reasoning` text. Confirm `UNVERIFIED` banner appears only on UNVERIFIED-label items.

---

## Phase 3: Source-Linked Q&A

### TASK-014 — RAG retrieval endpoint
**Agent:** Antigravity
**Depends on:** TASK-006

- `POST /api/documents/:id/qa` accepts `{ question: string }`
- Embed the question using `text-embedding-004`
- Run Atlas Vector Search on `chunks` filtered by `documentId`, return top 5 by cosine similarity
- Return retrieved chunks (with page numbers and text) to be used in TASK-015

**Acceptance:** POST a question about a known clause in the test document. Confirm the 5 returned chunks include the page containing that clause. POST a nonsense question and confirm 5 chunks are still returned (system does not fail on low-relevance queries).

---

### TASK-015 — Gemini Q&A with citation-grounded prompt
**Agent:** Antigravity
**Depends on:** TASK-014

- Build the Q&A prompt per design.md (system prompt forbids speculation, demands `INSUFFICIENT_EVIDENCE` fallback)
- Call Gemini with the retrieved chunks + question
- Parse the response: extract answer text and inline citation references (`[page X, clause Y]`)
- Map inline citations back to `chunkId`s via page number matching
- If response is exactly `INSUFFICIENT_EVIDENCE`: return `{ answer: null, insufficient: true }`
- Log call to `auditLogs` and save result to `qaLogs`

**Acceptance:** Ask a question that is clearly answerable from the test document → receive answer with at least one citation. Ask a question with no answer in the document → receive `insufficient: true` response.

---

### TASK-016 — Q&A citation verification + proof labeling
**Agent:** Copilot
**Depends on:** TASK-015, TASK-010

- After receiving the Q&A answer, run `verifyCitation` on the full answer text against the cited chunk IDs
- If `verified: true`: label the answer `DOCUMENT_FACT` or `AI_INFERENCE` based on whether the answer is verbatim vs. synthesized (use lexical vs. semantic method field from verification result)
- If `verified: false`: downgrade to `UNVERIFIED`, prepend warning to response
- Update the `qaLogs` record with the verification result and final `proofLabel`

**Acceptance:** The Q&A endpoint response always includes `proofLabel` and `verification` fields. A verified answer never carries `UNVERIFIED` label. A synthetic answer (no direct lexical match) carries `AI_INFERENCE`. An unverified answer carries `UNVERIFIED` and a `warning` string.

---

### TASK-017 — Q&A panel UI + PDF viewer source highlighting
**Agent:** Copilot
**Depends on:** TASK-016

- `QAPanel` component: question input (textarea + submit), answer display area
- Answer text renders with inline citation links (e.g., `[p.3]`); clicking a citation fires an event
- Side panel shows source chunk text when citation is clicked
- `PDFViewer` component (PDF.js): renders the document PDF; scrolls to and highlights the bounding box of the cited chunk when a citation is clicked
- `INSUFFICIENT_EVIDENCE` state: input area disabled with message *"The document does not contain sufficient evidence to answer this question."*
- `UNVERIFIED` answer renders with a red banner above the answer text

**Acceptance:** Ask an answerable question, click an inline citation, and confirm: side panel shows the source text, PDF viewer scrolls to and highlights the correct passage. Ask an unanswerable question and confirm the insufficient evidence message appears with no answer text.

---

## Phase 4: What-If Scenarios

### TASK-018 — Scenario template modules
**Agent:** Copilot
**Depends on:** nothing (pure data)

- Create `/server/scenarios/breach.ts`, `termination.ts`, `jurisdiction.ts` as described in design.md
- Each exports: `id`, `name`, `promptModifier`, `focusCategories`
- Create `GET /api/scenarios` endpoint that returns the list of available templates (id + name + description)
- No LLM calls in this task

**Acceptance:** `GET /api/scenarios` returns exactly 3 templates with correct IDs: `SCENARIO_BREACH`, `SCENARIO_TERMINATION`, `SCENARIO_JURISDICTION`.

---

### TASK-019 — Scenario extraction pipeline
**Agent:** Antigravity
**Depends on:** TASK-012, TASK-018

- `POST /api/documents/:id/scenario/:templateId` triggers a scenario run
- Uses the already-stored document text (no re-OCR, no re-embedding)
- Builds extraction prompt by combining base prompt + scenario `promptModifier`
- Runs full pipeline: Gemini extraction → VERIFIED_LAW upgrade → Citation Verification Function → store in `extractions` with `scenarioId` set
- Returns the scenario extraction result in the same structure as the baseline extraction

**Acceptance:** Run `SCENARIO_BREACH` on the test document. Confirm a new record appears in `extractions` with `scenarioId: "SCENARIO_BREACH"`. Confirm claims in the result skew toward obligation/penalty categories compared to the baseline extraction.

---

### TASK-020 — Scenario comparison UI
**Agent:** Antigravity
**Depends on:** TASK-019, TASK-013

- `ScenarioPanel` component: dropdown to select a template, "Run Scenario" button
- While running: shows spinner with message "Running [Scenario Name] analysis…"
- Results displayed in a two-column layout: Baseline extraction | Scenario extraction
- Claims present in scenario but not in baseline are highlighted with a "New in scenario" badge
- Claims with different `proofLabel` between baseline and scenario are flagged with a "Label changed" indicator
- All Proof Mode badges and verification status are rendered identically to `ExtractionPanel`

**Acceptance:** Run a scenario from the UI, confirm two-column layout renders. Confirm "New in scenario" badges appear for claims only present in the scenario result.

---

## Phase 5: Brief Export

### TASK-021 — Brief PDF generation (server-side)
**Agent:** Antigravity
**Depends on:** TASK-012

- Implement `GET /api/documents/:id/export` endpoint (accepts optional `?scenarioId=` query param)
- Use `pdfkit` to generate the PDF per the structure in FR-6.3
- Proof Mode labels rendered as text labels (not color — PDFs are often printed black-and-white)
- Flagged Items section: all `AI_INFERENCE` and `UNVERIFIED` claims in a dedicated appendix
- Footer on every page: *"Generated by Certus. AI_INFERENCE and UNVERIFIED items require independent legal review."*
- Stream the PDF response (`Content-Type: application/pdf`, `Content-Disposition: attachment`)
- No LLM calls in this function

**Acceptance:** Call the export endpoint for the processed test document. The downloaded PDF opens without errors, contains the correct document metadata, includes at least one claim with its proof label, and has the required footer. Generation completes within 10 seconds for a 20-page document.

---

### TASK-022 — Export button UI
**Agent:** Antigravity
**Depends on:** TASK-021

- `ExportButton` component: renders in the document header once status is `READY`
- If a scenario has been run, shows two export options: "Export Baseline Brief" and "Export Scenario Brief: [Name]"
- Shows a loading spinner while the PDF is being generated (tracks response time)
- On success: triggers file download via browser
- On error: shows toast notification with error message

**Acceptance:** Click export button, confirm download dialog appears with a valid PDF filename. If scenario was run, confirm both export options are present and each downloads a different brief.

---

## Phase 6: Integration & Hardening

### TASK-023 — End-to-end pipeline integration test
**Agent:** Kiro
**Depends on:** all Phase 1–5 tasks

- Write an integration test (using a real test PDF with known content) that runs the full pipeline:
  1. Upload PDF
  2. Poll status until `READY`
  3. Fetch extraction, confirm at least 5 claims
  4. Run one Q&A question with a known answer; confirm `verified: true` result
  5. Run `SCENARIO_BREACH`; confirm scenario extraction stored
  6. Call export endpoint; confirm HTTP 200 and `Content-Type: application/pdf`
- Use a small (3-page) synthetic test PDF to keep test fast

**Acceptance:** Integration test passes end-to-end in under 90 seconds. All 6 pipeline steps complete without errors.

---

### TASK-024 — Error boundary and graceful degradation
**Agent:** Antigravity
**Depends on:** TASK-005, TASK-008, TASK-015

- If Google Document AI is unreachable: set document status to `ERROR`, surface message "OCR service unavailable. Please try again."
- If Gemini is unreachable: set document to `ERROR` for extraction; for Q&A, return a specific error response (do not return a blank answer)
- Frontend: wrap `ExtractionPanel`, `QAPanel`, and `ScenarioPanel` in React error boundaries
- A global banner appears if the API server is unreachable: *"Certus is currently unable to reach its AI services. Document text is available but AI features are disabled."*

**Acceptance:** Mock Gemini to return 503. Confirm document enters `ERROR` state with a user-readable message. Confirm OCR-extracted text is still accessible via the status endpoint.

---

### TASK-025 — Audit log query endpoint
**Agent:** Antigravity
**Depends on:** TASK-008, TASK-015

- `GET /api/documents/:id/audit` returns all `auditLog` entries for a document, ordered by timestamp
- Response includes: `callType`, `promptHash`, `responseHash`, `modelVersion`, `timestamp`
- No raw prompt or response text is returned (hashes only, for privacy)

**Acceptance:** After running extraction + Q&A on test document, call the audit endpoint and confirm at least 2 log entries exist (one `EXTRACTION`, one `QA`) with non-null hashes.

---

### TASK-026 — Post-task test hook
**Agent:** Kiro
**Depends on:** TASK-003

- Create a Kiro `postTaskExecution` hook that runs `npm run lint && npm run typecheck` after any spec task is marked complete
- If lint or typecheck fails, the hook output surfaces the error list in the agent chat
- This ensures no task is marked complete with type errors or lint violations outstanding

**Acceptance:** Introduce a deliberate TypeScript error in a source file, mark a task complete, and confirm the hook fires and surfaces the error.

---

## Task Summary

| Task | Description | Agent | Phase |
|---|---|---|---|
| TASK-001 | Monorepo scaffolding | Antigravity | 0 |
| TASK-002 | MongoDB Atlas + schema | Antigravity | 0 |
| TASK-003 | Lint/type-check hooks | Kiro | 0 |
| TASK-004 | Upload endpoint | Antigravity | 1 |
| TASK-005 | Document AI OCR | Antigravity | 1 |
| TASK-006 | Embedding pipeline | Antigravity | 1 |
| TASK-007 | Upload UI + progress | Antigravity | 1 |
| TASK-008 | Gemini extraction call | Antigravity | 2 |
| TASK-009 | VERIFIED_LAW upgrade | Copilot | 2 |
| TASK-010 | Citation Verification Function | Copilot | 2 |
| TASK-011 | Verification function tests | Kiro | 2 |
| TASK-012 | Store extraction + verification | Antigravity | 2 |
| TASK-013 | Extraction UI + Proof badges | Copilot | 2 |
| TASK-014 | RAG retrieval endpoint | Antigravity | 3 |
| TASK-015 | Gemini Q&A call | Antigravity | 3 |
| TASK-016 | Q&A verification + labeling | Copilot | 3 |
| TASK-017 | Q&A UI + PDF highlighting | Copilot | 3 |
| TASK-018 | Scenario template modules | Copilot | 4 |
| TASK-019 | Scenario extraction pipeline | Antigravity | 4 |
| TASK-020 | Scenario comparison UI | Antigravity | 4 |
| TASK-021 | Brief PDF generation | Antigravity | 5 |
| TASK-022 | Export button UI | Antigravity | 5 |
| TASK-023 | E2E integration test | Kiro | 6 |
| TASK-024 | Error boundaries + degradation | Antigravity | 6 |
| TASK-025 | Audit log endpoint | Antigravity | 6 |
| TASK-026 | Post-task test hook | Kiro | 6 |
