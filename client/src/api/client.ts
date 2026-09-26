export function apiError(error: unknown): string {
  return error instanceof Error ? error.message : "Request failed. Please retry.";
}

export type ProofLabel = "DOCUMENT_FACT" | "VERIFIED_LAW" | "AI_INFERENCE" | "UNVERIFIED";

export interface ClaimVerification {
  verified: boolean;
  confidence: number;
  reason?: string;
}

export interface Claim {
  text: string;
  label: ProofLabel;
  sourcePage: number | null;
  sourceText: string | null;
  verification?: ClaimVerification;
}

export interface LegalDocumentData {
  mode?: "mock" | "live";
  _id: string;
  sessionId: string;
  filename: string;
  mimeType: string;
  status: "uploaded" | "ocr_processing" | "ocr_done" | "extracting" | "ready" | "failed";
  ocrText?: string;
  ocrPages?: { pageNumber: number; text: string }[];
  uploadedAt: string;
}

export interface BriefStats {
  totalClaims: number;
  verifiedCount: number;
  flaggedCount: number;
  verificationRate: number;
}

export interface BriefData {
  contentHash: string;
  mode: "mock" | "live";
  documentId: string;
  filename: string;
  generatedAt: string;
  pageCount: number;
  stats: BriefStats;
  verifiedFacts: Claim[];
  applicableLaw: Claim[];
  flaggedInferences: Claim[];
  openQuestions: Claim[];
  qaTranscript: { role: "user" | "assistant"; text: string; claims?: Claim[]; createdAt: string }[];
  scenarioComparisons: { prompt: string; claims: Claim[]; createdAt: string }[];
  disclaimer: string;
}

export function createDemoSession() {
  const randomBytes = crypto.getRandomValues(new Uint8Array(12));
  const sessionId = Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return { sessionId, displayName: `Demo ${sessionId.slice(-4).toUpperCase()}` };
}

export async function uploadDocument(file: File) {
  const { mockUploadDocument } = await import("./browserMock");
  return mockUploadDocument(file);
}

export async function extractDocument(documentId: string) {
  const { mockExtractDocument } = await import("./browserMock");
  return mockExtractDocument(documentId);
}

export async function getDocument(documentId: string) {
  const { mockGetDocument } = await import("./browserMock");
  return mockGetDocument(documentId);
}

export async function askQuestion(documentId: string, question: string) {
  const { mockAskQuestion } = await import("./browserMock");
  return mockAskQuestion(documentId, question);
}

export async function runWhatIf(documentId: string, scenarioPrompt: string) {
  const { mockRunWhatIf } = await import("./browserMock");
  return mockRunWhatIf(documentId, scenarioPrompt);
}

export async function getBrief(documentId: string) {
  const { mockGetBrief } = await import("./browserMock");
  return mockGetBrief(documentId);
}

export interface CaseLawSearch {
  provider: "CourtListener" | "Mock research";
  query: string;
  retrievedAt: string;
  notice?: string;
  results: { id: number; caseName: string; court: string; dateFiled: string | null; citations: string[]; url: string; snippet: string; status: string }[];
}

export async function searchCaseLaw(query: string): Promise<CaseLawSearch> {
  const { mockSearchCaseLaw } = await import("./browserMock");
  return mockSearchCaseLaw(query);
}
