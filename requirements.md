# Certus — MVP Requirements

## Overview

Certus is a legal document assistant that enforces epistemic honesty at the UI layer. Every AI-generated claim is tagged with one of four proof labels before it reaches the user. The system refuses to surface answers without a verifiable citation.

---

## Functional Requirements

### FR-1: Document Upload & OCR

**FR-1.1** Users can upload PDF documents (max 50 MB) via drag-and-drop or file picker.

**FR-1.2** The system sends uploaded PDFs to Google Document AI for OCR and layout extraction.

**FR-1.3** The extraction pipeline stores the following per document:
- Full text content, segmented by page
- Bounding-box coordinates for each text block
- Page number and block index for every extracted segment
- Document metadata (filename, upload timestamp, page count)

**FR-1.4** Extracted segments are embedded using `text-embedding-004` and stored in MongoDB Atlas with Vector Search indexing.

**FR-1.5** The upload UI displays a progress indicator with discrete stages: Uploading → OCR → Extracting → Indexing → Ready.

**FR-1.6** Unsupported file types (non-PDF) are rejected at upload with a clear error message. Password-protected PDFs surface a specific error.

---

### FR-2: Gemini Structured Extraction with Proof Mode Tagging

**FR-2.1** After OCR, Gemini is invoked to extract structured legal facts from the document text.

**FR-2.2** Gemini must return output as strict JSON conforming to a defined schema (see Design). Any response that fails JSON schema validation is rejected and retried once; on second failure the pipeline errors with a user-visible message.

**FR-2.3** Every extracted claim in the JSON output carries a `proofLabel` field. Valid values:

| Label | Meaning |
|---|---|
| `DOCUMENT_FACT` | Claim is a verbatim or near-verbatim lift from the document text |
| `VERIFIED_LAW` | Claim references a statute/regulation that can be externally confirmed |
| `AI_INFERENCE` | Claim is a reasonable inference from document facts but not stated explicitly |
| `UNVERIFIED` | Claim cannot be grounded; surfaces with a warning, not as a finding |

**FR-2.4** Claims labeled `AI_INFERENCE` or `UNVERIFIED` must include a `confidence` score (0.0–1.0) and a `reasoning` field explaining the inference chain.

**FR-2.5** The extraction schema captures at minimum: parties, dates, obligations, rights, penalties, governing law, and defined terms.

**FR-2.6** All Gemini calls are logged (prompt hash, response hash, timestamp, model version) for audit purposes.

---

### FR-3: Source-Linked Q&A (RAG)

**FR-3.1** Users can ask free-text questions about the uploaded document.

**FR-3.2** The system retrieves the top-k (default k=5) most semantically relevant chunks from MongoDB Atlas Vector Search using the question embedding.

**FR-3.3** Gemini generates an answer grounded exclusively in the retrieved chunks. The system prompt explicitly instructs Gemini to cite specific page numbers and clause identifiers, or respond with the literal string `"INSUFFICIENT_EVIDENCE"` if the retrieved context does not support an answer.

**FR-3.4** Every sentence in a Q&A answer carries an inline citation linking to the source chunk (page number + character offset range).

**FR-3.5** If Gemini returns `"INSUFFICIENT_EVIDENCE"`, the UI displays: *"The document does not contain sufficient evidence to answer this question."* No answer text is shown.

**FR-3.6** Each Q&A answer is passed through the Citation Verification Function (FR-4) before display. Answers that fail verification are downgraded: their `proofLabel` is set to `UNVERIFIED` and a banner is shown.

**FR-3.7** The Q&A panel displays the source chunk(s) in a side panel, with the relevant passage highlighted, so users can read the original text.

---

### FR-4: Citation Verification Function

**FR-4.1** A deterministic (non-LLM) function runs after every Gemini response. It is the only gate between LLM output and user display.

**FR-4.2** The function accepts: `(claim: string, citedChunkIds: string[], documentId: string)` and returns `{ verified: boolean, matchScore: number, matchedPassage: string | null }`.

**FR-4.3** Verification logic:
1. Retrieve the cited chunks from MongoDB by ID.
2. Compute normalized lexical overlap (token-level Jaccard similarity) between the claim and the cited chunk text.
3. Compute semantic similarity (cosine similarity between claim embedding and chunk embedding).
4. Apply thresholds: lexical ≥ 0.25 OR semantic ≥ 0.80 → `verified: true`.
5. If neither threshold is met → `verified: false`.

**FR-4.4** Threshold values are configurable via environment variables (`VERIFY_LEXICAL_THRESHOLD`, `VERIFY_SEMANTIC_THRESHOLD`) without code changes.

**FR-4.5** The verification result is stored alongside every displayed claim in MongoDB for audit/export.

**FR-4.6** The verification function must have 100% unit test coverage across pass, fail, edge (empty chunk, null citation) cases.

---

### FR-5: What-If Scenario Templates

**FR-5.1** The system provides exactly 3 hardcoded scenario templates:

| Template ID | Name | Description |
|---|---|---|
| `SCENARIO_BREACH` | Breach of Contract | Re-runs extraction highlighting obligation clauses, penalty triggers, and cure periods |
| `SCENARIO_TERMINATION` | Early Termination | Re-runs extraction focusing on termination rights, notice requirements, and exit fees |
| `SCENARIO_JURISDICTION` | Jurisdiction Challenge | Re-runs extraction surfacing governing law, venue, and arbitration clauses |

**FR-5.2** Each scenario passes a scenario-specific system prompt modifier to the extraction pipeline; the rest of the pipeline (OCR → embed → verify) is identical to the standard flow.

**FR-5.3** Scenario outputs are displayed in a dedicated panel alongside the baseline extraction, with differences visually flagged.

**FR-5.4** Scenario results carry the same Proof Mode labels and pass through the same Citation Verification Function as standard extractions.

**FR-5.5** Users can run any scenario on any already-processed document without re-uploading.

---

### FR-6: Lawyer-Ready Brief Export

**FR-6.1** Users can export a structured brief for any processed document (with or without a scenario overlay).

**FR-6.2** The brief is generated as a PDF file.

**FR-6.3** Brief content includes:
- Document metadata header (filename, upload date, page count)
- Structured extraction summary grouped by category (parties, dates, obligations, etc.)
- Proof Mode label shown next to every fact
- All `AI_INFERENCE` and `UNVERIFIED` items flagged in a separate "Flagged Items" section
- Citation verification pass/fail status per claim
- Q&A transcript (if any), with citations
- Scenario comparison table (if a scenario was run)
- Footer: *"This brief was generated by Certus. All AI_INFERENCE and UNVERIFIED items require independent legal review."*

**FR-6.4** The brief must be exportable within 10 seconds for documents up to 50 pages.

---

## Non-Functional Requirements

**NFR-1 Security:** API keys are never exposed to the frontend. All external API calls originate from the backend.

**NFR-2 Data retention:** Uploaded documents and extracted data are stored per-session. No cross-user data sharing.

**NFR-3 Latency:** OCR + extraction pipeline completes within 60 seconds for a 20-page document. Q&A responses return within 10 seconds.

**NFR-4 Auditability:** Every LLM call is logged with a content hash. Logs are queryable by document ID.

**NFR-5 Graceful degradation:** If Gemini is unavailable, the system surfaces the OCR text and disables AI features with a clear banner rather than failing silently.

---

## Out of Scope (MVP)

- Evidence Graph / Neo4j integration
- Continuous legal-change monitoring
- Multi-document matter search
- Multilingual support
- User authentication / multi-tenancy
- Real-time collaboration

---

## Glossary

| Term | Definition |
|---|---|
| Proof Mode | The labeling + verification system that tags every AI claim before display |
| Citation Verification Function | The deterministic function (FR-4) that is the sole gate between LLM output and user display |
| Chunk | A page-segmented text block stored in MongoDB with its embedding and source coordinates |
| Brief | The exported lawyer-ready PDF summary |
