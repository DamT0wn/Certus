# Certus — System Design

## Core Principle (Steering Rule)

**LLM output is never the sole source of truth.** Every factual claim produced by Gemini must pass through the deterministic Citation Verification Function before it is displayed to the user. This rule applies at every layer — extraction, Q&A, and scenario runs — without exception.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        React Frontend                        │
│  Upload UI │ PDF Viewer (PDF.js) │ Q&A Panel │ Scenario UI  │
│                  Tailwind CSS + Proof Mode badges            │
└───────────────────────┬─────────────────────────────────────┘
                        │ REST / JSON
┌───────────────────────▼─────────────────────────────────────┐
│                   Express / Node.js API                      │
│                                                              │
│  /upload  │  /extract  │  /qa  │  /scenario  │  /export     │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │           Citation Verification Function             │    │
│  │   (deterministic — runs before every response)      │    │
│  └─────────────────────────────────────────────────────┘    │
└────┬──────────────┬───────────────┬────────────────────┬────┘
     │              │               │                    │
     ▼              ▼               ▼                    ▼
Google Doc AI   Gemini API   text-embedding-004   MongoDB Atlas
   (OCR)       (extraction      (embeddings)      (Vector Search
               + Q&A + JSON                       + document store)
               structured
               output)
```

---

## Component Design

### 1. Frontend

**Technology:** React 18, Tailwind CSS, PDF.js

**Key components:**

| Component | Responsibility |
|---|---|
| `DocumentUploader` | Drag-and-drop upload, progress stages, error states |
| `PDFViewer` | Renders PDF with PDF.js; highlights source chunks on citation click |
| `ExtractionPanel` | Displays structured extraction results with Proof Mode badge per claim |
| `QAPanel` | Question input, answer display, inline citation links, source side-panel |
| `ScenarioPanel` | Template selector, side-by-side baseline vs. scenario diff view |
| `ProofBadge` | Reusable label component: color-coded by proof type, tooltip with reasoning |
| `ExportButton` | Triggers brief export, shows download progress |

**Proof Mode badge colors:**
- `DOCUMENT_FACT` → green
- `VERIFIED_LAW` → blue
- `AI_INFERENCE` → amber (with confidence score)
- `UNVERIFIED` → red (with warning banner)

**State management:** React Context + useReducer for document state. No external state library for MVP.

---

### 2. Backend API

**Technology:** Node.js 20, Express 4

**Routes:**

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/documents/upload` | Accepts PDF, triggers OCR pipeline |
| `GET` | `/api/documents/:id/status` | Polls processing status |
| `GET` | `/api/documents/:id/extraction` | Returns structured extraction JSON |
| `POST` | `/api/documents/:id/qa` | Accepts question, returns verified answer |
| `POST` | `/api/documents/:id/scenario/:templateId` | Runs scenario template |
| `GET` | `/api/documents/:id/export` | Streams PDF brief |

**Middleware:**
- Request validation (Joi schemas) on all POST routes
- API key injection (all external keys via `process.env`, never forwarded to client)
- Request/response logging with content hashing for audit trail

---

### 3. Document Processing Pipeline

```
PDF Upload
    │
    ▼
Google Document AI (OCR)
    │  returns: pages[], blocks[], text, bounding boxes
    ▼
Segment & Normalize
    │  splits into chunks by page + paragraph boundary
    │  assigns chunkId, pageNumber, blockIndex, charOffset
    ▼
text-embedding-004
    │  embeds each chunk
    ▼
MongoDB Atlas Insert
    │  stores chunk text, embedding, coordinates, documentId
    ▼
Gemini Structured Extraction
    │  prompt: document text → JSON schema
    │  validates JSON schema on response
    ▼
Citation Verification Function
    │  runs on every extracted claim
    ▼
Store Extraction Results
    │  stores claims with proofLabel + verificationResult
    ▼
Document status → READY
```

**Chunking strategy:** Paragraph-level chunks, max 512 tokens. Overlapping window of 1 paragraph for boundary continuity. Each chunk stores: `{ chunkId, documentId, pageNumber, blockIndex, charStart, charEnd, text, embedding }`.

---

### 4. Gemini Integration

**Extraction prompt contract:**

Gemini is called with a system prompt that demands strict JSON output. Example schema:

```json
{
  "parties": [
    {
      "name": "string",
      "role": "string",
      "proofLabel": "DOCUMENT_FACT | AI_INFERENCE | UNVERIFIED",
      "citedChunkIds": ["string"],
      "confidence": 0.0,
      "reasoning": "string | null"
    }
  ],
  "dates": [ /* same structure */ ],
  "obligations": [ /* same structure */ ],
  "rights": [ /* same structure */ ],
  "penalties": [ /* same structure */ ],
  "governingLaw": { /* same structure */ },
  "definedTerms": [ /* same structure */ ]
}
```

`VERIFIED_LAW` is not assigned by Gemini — it is assigned post-extraction when the backend confirms a statutory reference against a known pattern (e.g., regex match against citation format "U.S.C. §", "CFR §", etc.). Gemini labels such items `DOCUMENT_FACT` initially; the backend upgrades the label.

**Q&A prompt contract:**

```
System: You are a legal document analyst. Answer ONLY using the provided context chunks.
For each sentence in your answer, append [page X, clause Y] citation.
If the context does not support an answer, respond with exactly: INSUFFICIENT_EVIDENCE
Do not speculate. Do not use general legal knowledge not present in the document.

Context: {retrievedChunks}
Question: {userQuestion}
```

---

### 5. Citation Verification Function

This is the system's trust boundary. It is implemented as a pure function with no LLM calls.

```typescript
interface VerificationInput {
  claim: string;
  citedChunkIds: string[];
  documentId: string;
}

interface VerificationResult {
  verified: boolean;
  matchScore: number;          // max of lexical and semantic scores
  matchedPassage: string | null;
  method: 'lexical' | 'semantic' | 'none';
}

async function verifyCitation(input: VerificationInput): Promise<VerificationResult>
```

**Algorithm:**

1. Fetch cited chunks from MongoDB by `chunkId` (deterministic DB lookup)
2. Tokenize claim and each chunk; compute token-level Jaccard similarity
3. Fetch pre-stored chunk embeddings; compute cosine similarity with claim embedding
4. Take max score across all cited chunks
5. Apply thresholds (env-configurable):
   - Lexical Jaccard ≥ `VERIFY_LEXICAL_THRESHOLD` (default 0.25) → verified
   - Cosine similarity ≥ `VERIFY_SEMANTIC_THRESHOLD` (default 0.80) → verified
6. Return result with matched passage text for UI display

**Why deterministic:** Both Jaccard similarity and cosine similarity over stored vectors are pure math — given the same inputs they always return the same output. No LLM is involved.

---

### 6. MongoDB Atlas Schema

**Collection: `documents`**
```json
{
  "_id": "ObjectId",
  "filename": "string",
  "uploadedAt": "ISODate",
  "pageCount": "number",
  "status": "UPLOADING | OCR | EXTRACTING | INDEXING | READY | ERROR",
  "errorMessage": "string | null"
}
```

**Collection: `chunks`**
```json
{
  "_id": "ObjectId",
  "documentId": "ObjectId",
  "pageNumber": "number",
  "blockIndex": "number",
  "charStart": "number",
  "charEnd": "number",
  "text": "string",
  "embedding": "[number]"  // 768-dim, indexed with Atlas Vector Search
}
```

**Collection: `extractions`**
```json
{
  "_id": "ObjectId",
  "documentId": "ObjectId",
  "scenarioId": "string | null",
  "createdAt": "ISODate",
  "claims": [
    {
      "claimId": "string",
      "category": "string",
      "text": "string",
      "proofLabel": "DOCUMENT_FACT | VERIFIED_LAW | AI_INFERENCE | UNVERIFIED",
      "citedChunkIds": ["string"],
      "confidence": "number | null",
      "reasoning": "string | null",
      "verification": {
        "verified": "boolean",
        "matchScore": "number",
        "matchedPassage": "string | null",
        "method": "string"
      }
    }
  ]
}
```

**Collection: `qaLogs`**
```json
{
  "_id": "ObjectId",
  "documentId": "ObjectId",
  "question": "string",
  "answer": "string | INSUFFICIENT_EVIDENCE",
  "retrievedChunkIds": ["string"],
  "proofLabel": "string",
  "verification": { /* VerificationResult */ },
  "createdAt": "ISODate",
  "geminiCallId": "string"
}
```

**Collection: `auditLogs`**
```json
{
  "_id": "ObjectId",
  "documentId": "ObjectId",
  "callType": "EXTRACTION | QA | SCENARIO",
  "promptHash": "string",
  "responseHash": "string",
  "modelVersion": "string",
  "timestamp": "ISODate"
}
```

**Vector Search Index (Atlas):** Configured on `chunks.embedding`, cosine similarity, 768 dimensions.

---

### 7. What-If Scenario Templates

Each template is a module that exports a `promptModifier` string and a `focusCategories` array:

```typescript
// scenarios/breach.ts
export const SCENARIO_BREACH = {
  id: 'SCENARIO_BREACH',
  name: 'Breach of Contract',
  promptModifier: `
    Focus extraction on: obligation clauses, performance standards,
    breach triggers, cure periods, and penalty/damages provisions.
    Flag any ambiguous obligation language as AI_INFERENCE.
  `,
  focusCategories: ['obligations', 'penalties', 'dates']
};
```

The pipeline is identical — OCR output is already stored, so scenarios only re-invoke Gemini with the modified prompt against the same stored document text.

---

### 8. Brief Export

**Library:** `pdfkit` (Node.js)

**Generation flow:**
1. Fetch extraction from `extractions` collection
2. Fetch Q&A log (if any) from `qaLogs`
3. Compose PDF sections in order (see FR-6.3)
4. Stream response to client with `Content-Type: application/pdf`

The brief is generated server-side; no LLM is involved in formatting.

---

### 9. API Key & Environment Configuration

```
# Google Document AI
GOOGLE_DOCAI_PROJECT_ID=
GOOGLE_DOCAI_LOCATION=
GOOGLE_DOCAI_PROCESSOR_ID=
GOOGLE_APPLICATION_CREDENTIALS=

# Gemini
GEMINI_API_KEY=
GEMINI_MODEL=gemini-1.5-pro

# Embeddings
GOOGLE_EMBEDDING_MODEL=text-embedding-004

# MongoDB
MONGODB_URI=
MONGODB_DB_NAME=certus

# Verification thresholds
VERIFY_LEXICAL_THRESHOLD=0.25
VERIFY_SEMANTIC_THRESHOLD=0.80

# App
PORT=3001
MAX_UPLOAD_SIZE_MB=50
```

---

## Data Flow Diagram — Q&A Request

```
User types question
        │
        ▼
Frontend → POST /api/documents/:id/qa
        │
        ▼
Backend: embed question (text-embedding-004)
        │
        ▼
Atlas Vector Search → top-5 chunks
        │
        ▼
Gemini (grounded prompt + chunks) → raw answer with citations
        │
        ▼
Citation Verification Function (deterministic)
        │
   ┌────┴────┐
verified?    not verified?
   │              │
   ▼              ▼
display       downgrade to UNVERIFIED
answer        show with warning banner
with badge
```

---

## Post-MVP / Roadmap

The following features are explicitly out of scope for this MVP. They are listed here to prevent scope creep and to frame future planning.

| Feature | Rationale for deferral |
|---|---|
| **Evidence Graph / Neo4j** | Requires entity resolution pipeline and graph query layer; significant infrastructure addition |
| **Continuous legal-change monitoring** | Needs external legal database subscriptions (Westlaw, Lexis) and scheduled update pipelines |
| **Multi-document matter search** | Cross-document vector search and deduplication adds indexing complexity beyond MVP |
| **Multilingual support** | OCR and embedding model multilingual tuning, UI i18n — separate workstream |
| **User authentication / multi-tenancy** | Auth layer (JWT/OAuth), per-user data isolation — deliberately excluded to keep MVP stateless |
| **Real-time collaboration** | WebSocket layer, conflict resolution — post-MVP |

---

## Key Design Decisions & Rationale

**Why deterministic verification instead of LLM-as-judge?**
LLMs can hallucinate agreement. A cosine similarity threshold over stored vectors is reproducible, auditable, and gives identical results on re-run. This is the system's core trust guarantee.

**Why chunk at paragraph level?**
Legal documents have dense, self-contained paragraphs. Sentence-level chunks lose context; page-level chunks are too coarse for precise citation. Paragraph-level balances retrieval precision with citation granularity.

**Why Google Document AI over pdf-parse?**
Legal PDFs are often scanned or have complex layouts (tables, multi-column). Document AI returns bounding boxes and layout structure needed for precise source linking in the PDF viewer.

**Why not stream Gemini responses?**
Structured JSON output requires the full response to validate schema. Streaming partial JSON would complicate validation and could expose unverified fragments to the UI.
