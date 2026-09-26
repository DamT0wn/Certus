import type { BriefData, CaseLawSearch, Claim, LegalDocumentData } from "./client";

interface StoredMockDocument {
  document: LegalDocumentData;
  facts: Claim[];
  qaTranscript: BriefData["qaTranscript"];
  scenarioComparisons: BriefData["scenarioComparisons"];
}

const DOCUMENT_PREFIX = "certus_mock_document_";
const MAX_FILE_SIZE = 50 * 1024 * 1024;

function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function storageKey(documentId: string): string {
  return `${DOCUMENT_PREFIX}${documentId}`;
}

function load(documentId: string): StoredMockDocument {
  const raw = sessionStorage.getItem(storageKey(documentId));
  if (!raw) throw new Error("This demo document is no longer available. Return to Intake and load it again.");
  return JSON.parse(raw) as StoredMockDocument;
}

function save(record: StoredMockDocument): void {
  sessionStorage.setItem(storageKey(record.document._id), JSON.stringify(record));
}

function sanitizedFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 180) || "document.pdf";
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 24);
}

function claimFromSource(sourceText: string, pageNumber: number, label: Claim["label"] = "DOCUMENT_FACT"): Claim {
  return {
    text: sourceText,
    label,
    sourcePage: pageNumber,
    sourceText,
    verification: {
      verified: true,
      confidence: label === "AI_INFERENCE" ? 0.88 : 1,
      reason: label === "AI_INFERENCE"
        ? "Deterministic demo inference grounded in the cited contract clause; attorney review required."
        : "Exact source passage found on the cited page.",
    },
  };
}

function unverified(text: string): Claim {
  return {
    text,
    label: "UNVERIFIED",
    sourcePage: null,
    sourceText: null,
    verification: { verified: false, confidence: 0, reason: "No matching passage was found in the uploaded document." },
  };
}

async function parsePdf(file: File): Promise<{ pageNumber: number; text: string }[]> {
  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (new TextDecoder().decode(header) !== "%PDF-") throw new Error("Only valid PDF documents are accepted.");

  const [{ getDocument, GlobalWorkerOptions }, workerModule] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  GlobalWorkerOptions.workerSrc = workerModule.default;
  const pdf = await getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: { pageNumber: number; text: string }[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? `${item.str}${item.hasEOL ? "\n" : " "}` : ""))
      .join("")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
    pages.push({ pageNumber, text });
  }

  if (!pages.some((page) => page.text.length > 0)) {
    throw new Error("This PDF has no readable text. The self-contained demo does not perform scanned-document OCR.");
  }
  return pages;
}

export async function mockUploadDocument(file: File) {
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Unsupported file type: Only PDF documents are accepted.");
  }
  if (file.size > MAX_FILE_SIZE) throw new Error("PDF exceeds the 50 MB upload limit.");

  const ocrPages = await parsePdf(file);
  const documentId = randomId();
  const document: LegalDocumentData = {
    _id: documentId,
    sessionId: sessionStorage.getItem("certus_demo_session") || "browser-demo",
    filename: sanitizedFilename(file.name),
    mimeType: "application/pdf",
    mode: "mock",
    status: "ocr_done",
    ocrText: ocrPages.map((page) => page.text).join("\n\n"),
    ocrPages,
    uploadedAt: new Date().toISOString(),
  };
  save({ document, facts: [], qaTranscript: [], scenarioComparisons: [] });
  return { documentId, status: document.status, filename: document.filename, pageCount: ocrPages.length };
}

export async function mockExtractDocument(documentId: string): Promise<Claim[]> {
  const record = load(documentId);
  const patterns = /\bshall\b|\bmust\b|\bmay\b|terminat|notice|payment|fee|invoice|governing law|jurisdiction|venue|arbitr/i;
  const facts = record.document.ocrPages
    ?.flatMap((page) => sentences(page.text).filter((sentence) => patterns.test(sentence)).map((sentence) => claimFromSource(sentence, page.pageNumber)))
    .slice(0, 16) ?? [];

  record.facts = facts.length > 0
    ? facts
    : [unverified("The demo could not identify a material obligation in this document; attorney review is required.")];
  record.document.status = "ready";
  save(record);
  return record.facts;
}

export async function mockGetDocument(documentId: string) {
  const record = load(documentId);
  return { document: record.document, facts: record.facts };
}

function bestMatchingClaim(record: StoredMockDocument, prompt: string): Claim | null {
  const promptTokens = new Set(prompt.toLowerCase().match(/[a-z0-9$]+/g)?.filter((token) => token.length > 2) ?? []);
  const candidates = (record.document.ocrPages ?? []).flatMap((page) =>
    sentences(page.text).map((text) => {
      const normalized = text.toLowerCase();
      const overlap = [...promptTokens].filter((token) => normalized.includes(token)).length;
      const intentBoost =
        (/pay|payment|fee|invoice|cost/.test(prompt.toLowerCase()) && /\$|pay|payment|fee|invoice/.test(normalized) ? 3 : 0) +
        (/terminat|notice|exit/.test(prompt.toLowerCase()) && /terminat|notice|exit/.test(normalized) ? 3 : 0);
      return { text, pageNumber: page.pageNumber, score: overlap + intentBoost };
    }),
  );
  const best = candidates.filter((candidate) => candidate.text.length >= 30).sort((a, b) => b.score - a.score)[0];
  return best && best.score > 0 ? claimFromSource(best.text, best.pageNumber) : null;
}

export async function mockAskQuestion(documentId: string, question: string): Promise<Claim[]> {
  const record = load(documentId);
  const claims = [bestMatchingClaim(record, question) ?? unverified("The uploaded document does not contain enough matching evidence to answer this question.")];
  const createdAt = new Date().toISOString();
  record.qaTranscript.push({ role: "user", text: question, createdAt });
  record.qaTranscript.push({ role: "assistant", text: claims.map((claim) => claim.text).join(" "), claims, createdAt });
  save(record);
  return claims;
}

export async function mockRunWhatIf(documentId: string, scenarioPrompt: string): Promise<Claim[]> {
  const record = load(documentId);
  const prompt = scenarioPrompt.toLowerCase();
  const pattern = prompt.includes("jurisdiction") || prompt.includes("venue")
    ? /governing law|jurisdiction|venue|arbitr/i
    : /terminat|resign|early|exit/.test(prompt)
      ? /terminat|notice|renew|expire|cure/i
      : /breach|default|cure|penalt|remed|indemn/i;
  const matches = (record.document.ocrPages ?? []).flatMap((page) =>
    sentences(page.text).filter((sentence) => pattern.test(sentence)).map((text) => ({ text, pageNumber: page.pageNumber })),
  ).slice(0, 4);
  const claims = matches.length > 0
    ? matches.map((match, index) => {
        const claim = claimFromSource(match.text, match.pageNumber, index === 0 ? "AI_INFERENCE" : "DOCUMENT_FACT");
        if (index === 0) claim.text = `The scenario is directly affected by this clause: ${match.text}`;
        return claim;
      })
    : [unverified("No clause in the uploaded document directly addresses this scenario; counsel should review the omission before relying on an outcome.")];
  record.scenarioComparisons.push({ prompt: scenarioPrompt, claims, createdAt: new Date().toISOString() });
  save(record);
  return claims;
}

async function sha256(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function mockGetBrief(documentId: string): Promise<BriefData> {
  const record = load(documentId);
  const verifiedFacts = record.facts.filter((claim) => claim.label === "DOCUMENT_FACT" && claim.verification?.verified);
  const flaggedInferences = record.facts.filter((claim) => claim.label === "AI_INFERENCE");
  const openQuestions = record.facts.filter((claim) => claim.label === "UNVERIFIED" || !claim.verification?.verified);
  const flaggedCount = flaggedInferences.length + openQuestions.length;
  return {
    mode: "mock",
    contentHash: await sha256({ pages: record.document.ocrPages, facts: record.facts, qa: record.qaTranscript, scenarios: record.scenarioComparisons }),
    documentId,
    filename: record.document.filename,
    generatedAt: new Date().toISOString(),
    pageCount: record.document.ocrPages?.length || 1,
    stats: {
      totalClaims: record.facts.length,
      verifiedCount: verifiedFacts.length,
      flaggedCount,
      verificationRate: record.facts.length ? Math.round((verifiedFacts.length / record.facts.length) * 100) : 0,
    },
    verifiedFacts,
    applicableLaw: [],
    flaggedInferences,
    openQuestions,
    qaTranscript: record.qaTranscript,
    scenarioComparisons: record.scenarioComparisons,
    disclaimer: "Self-contained browser demo. Deterministic mock analysis is not legal advice; all conclusions require independent attorney review.",
  };
}

export async function mockSearchCaseLaw(query: string): Promise<CaseLawSearch> {
  return {
    provider: "Mock research",
    query,
    retrievedAt: new Date().toISOString(),
    results: [],
    notice: "External case-law search is disabled in this self-contained demo. No query or document data left your browser.",
  };
}
