# Certus

A legal document assistant that labels every claim it makes as `DOCUMENT_FACT`,
`VERIFIED_LAW`, `AI_INFERENCE`, or `UNVERIFIED`, backed by a deterministic
citation-verification gate — no claim reaches the UI without passing a check
that it's actually grounded in the source document.

Status: **backend logic + core verification proven working** (unit-tested,
compiles, boots). Frontend scaffolded and building. Live Google Cloud +
MongoDB Atlas calls are wired but untested against real credentials — you
need to plug those in (see below).

## What's real right now

- ✅ `verifyCitation` — the core differentiator. 6/6 unit tests passing.
- ✅ Server compiles clean (`tsc --noEmit`), boots, health check responds.
- ✅ Client compiles clean, production build succeeds (`npm run build`).
- ⚠️ Document AI / Gemini / MongoDB Atlas calls are real SDK code but
  **untested against live credentials** — this repo has no GCP project or
  Atlas cluster attached. That's the next step for you.

## Running in mock mode

Certus includes an end-to-end **Mock Mode** (`MOCK_MODE=true` in `server/.env`) allowing you to run, test, and demo the entire application immediately **without needing active Google Cloud Document AI, Gemini API, or MongoDB Atlas credentials**.

### How Mock Mode Works:
- **Zero-Config Database**: If `MONGODB_URI` contains placeholder credentials (e.g. `<cluster>`), the server automatically boots an in-memory MongoDB instance using `mongodb-memory-server`.
- **Realistic OCR Simulation (`documentAiService.ts`)**: `runOcr()` parses uploaded plain text/PDF files or returns a realistic 3-page Executive Employment Agreement preserving the multi-page structure for chunking and page-numbered citations.
- **Deterministic Embeddings & Structured Claims (`geminiService.ts`)**: `embedText()` generates deterministic 768-dimensional normalized vectors. The extraction, chat Q&A, and what-if functions synthesize document-grounded claims.
- **Real Proof Mode Citation Verification**: Crucially, mock claims **still pass through the actual `gateClaims()` / `verifyCitation()` engine** — verifying citations deterministically against source document text and downgrading unverified or hallucinated claims to `UNVERIFIED`.
- **In-Memory Vector Search (`vectorSearchService.ts`)**: `retrieveRelevantChunks()` bypasses the Atlas `$vectorSearch` requirement by performing in-memory token relevance matching over chunks stored in MongoDB.

### Quick Start in Mock Mode:
1. Ensure `server/.env` has `MOCK_MODE=true`.
2. Start server:
   ```bash
   cd server
   npm run dev    # or: npm run build && npm start
   ```
3. Start client:
   ```bash
   cd client
   npm run dev    # http://localhost:5173
   ```
4. Open `http://localhost:5173`, click **"1-Click Demo Login"** (or register your own account), and click **"📄 Load Sample Contract (PDF)"** (or drag & drop your own contract).
5. Explore extracted claims, ask questions in chat, run what-if scenarios, and view the lawyer-ready brief!

### Swapping to Real Credentials Later:
Every mock branch is marked with `// MOCK MODE — replace with real Google Cloud call when GCP credentials are ready`. To switch to live services:
1. Set `MOCK_MODE=false` in `server/.env`.
2. Fill in:
   - `MONGODB_URI`: Live Atlas cluster with the `embedding_index` vector search index.
   - `GCP_PROJECT_ID`, `DOCAI_PROCESSOR_ID`, `GOOGLE_APPLICATION_CREDENTIALS`: Google Document AI processor & credentials.
   - `GEMINI_API_KEY`: Google AI Studio Gemini API key.
3. Restart the server. No controller, route, or client code changes are required.

## Setup

### 1. Backend
```
cd server
cp .env.example .env      # fill in real values, see below
npm install                # already done in this build, but for a fresh clone:
npm run dev                 # http://localhost:5000
```

Required to fill into `.env`:
- `MONGODB_URI` — a MongoDB Atlas cluster (needs a Vector Search index — see below)
- `GCP_PROJECT_ID`, `DOCAI_PROCESSOR_ID`, `GOOGLE_APPLICATION_CREDENTIALS` — a Document AI OCR processor + service account JSON
- `GEMINI_API_KEY` — from Google AI Studio

### 2. MongoDB Atlas Vector Search index
On the `chunks` collection, create a vector index named `embedding_index`:
```json
{
  "fields": [
    { "type": "vector", "path": "embedding", "numDimensions": 768, "similarity": "cosine" },
    { "type": "filter", "path": "documentId" }
  ]
}
```

### 3. Frontend
```
cd client
npm install
npm run dev    # http://localhost:5173, proxies /api to :5000
```

## Architecture

```
client/  React + TS + Tailwind v4 + React Router
  api/client.ts        — typed API wrapper
  components/          — ProofLabelChip, ClaimCard (shared claim rendering)
  pages/                — UploadPage, DocumentPage (chat + what-if), BriefPage

server/  Express + TS + Mongoose
  models/               — User, LegalDocument, ExtractedFact, Chunk, ChatSession
  services/
    documentAiService.ts    — OCR via Google Document AI
    geminiService.ts        — structured extraction/Q&A/what-if, ALL claims gated through verifyCitation
    verifyCitation.ts        — deterministic verification, no LLM call, fully unit tested
    vectorSearchService.ts  — chunking + embeddings + Atlas Vector Search retrieval
  controllers/ + routes/    — REST API
```

## API

| Route | Purpose |
|---|---|
| `POST /api/auth/register`, `/login` | Auth |
| `POST /api/documents/upload` | Upload file → OCR → chunk+embed |
| `POST /api/documents/:id/extract` | Run Proof Mode extraction |
| `GET /api/documents/:id` | Get document + extracted facts |
| `POST /api/chat` | Ask a question, get cited/labeled claims |
| `POST /api/documents/:id/whatif` | Run a what-if scenario |
| `GET /api/documents/:id/brief` | Lawyer-ready brief |

## Next steps (in priority order)
1. Wire real GCP credentials, test OCR against a real PDF
2. Test Gemini structured-output calls against real documents, tune the extraction prompt
3. Build/verify the Atlas Vector Search index actually returns sane results
4. Wire the PDF.js viewer to actually render + highlight (currently a page-number placeholder in DocumentPage)
5. Polish UI (this pass prioritized working logic over visual design)
