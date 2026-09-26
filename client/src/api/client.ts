import axios from "axios";
import {
  mockAskQuestion,
  mockExtractDocument,
  mockGetBrief,
  mockGetDocument,
  mockRunWhatIf,
  mockSearchCaseLaw,
  mockUploadDocument,
} from "./browserMock";

export const browserMockEnabled = import.meta.env.VITE_USE_BROWSER_MOCK !== "false";

export const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL || "/api", timeout: 120000 });

export function apiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (["SERVER_NOT_CONFIGURED", "DATABASE_UNAVAILABLE", "API_INITIALIZATION_FAILED"].includes(error.response?.data?.code)) {
      return "The service is temporarily unavailable. Please try again later.";
    }
    const detail = error.response?.data?.error;
    if (typeof detail === "string") return detail;
    if (detail && typeof detail.message === "string") return detail.message;
    return error.code === "ECONNABORTED" ? "The request timed out. Please retry." : error.message;
  }
  return error instanceof Error ? error.message : "Request failed. Please retry.";
}

api.interceptors.request.use((config) => {
  const sessionId = sessionStorage.getItem("certus_demo_session");
  if (sessionId) config.headers.Authorization = `Bearer ${sessionId}`;
  return config;
});

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
  if (browserMockEnabled) return mockUploadDocument(file);
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post("/documents/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data as { documentId: string; status: string; filename: string; pageCount: number };
}

export async function extractDocument(documentId: string) {
  if (browserMockEnabled) return mockExtractDocument(documentId);
  const { data } = await api.post(`/documents/${documentId}/extract`);
  return data.facts as Claim[];
}

export async function getDocument(documentId: string) {
  if (browserMockEnabled) return mockGetDocument(documentId);
  const { data } = await api.get(`/documents/${documentId}`);
  return data as { document: LegalDocumentData; facts: Claim[] };
}

export async function askQuestion(documentId: string, question: string) {
  if (browserMockEnabled) return mockAskQuestion(documentId, question);
  const { data } = await api.post("/chat", { documentId, question });
  return data.claims as Claim[];
}

export async function runWhatIf(documentId: string, scenarioPrompt: string) {
  if (browserMockEnabled) return mockRunWhatIf(documentId, scenarioPrompt);
  const { data } = await api.post(`/documents/${documentId}/whatif`, { scenarioPrompt });
  return data.claims as Claim[];
}

export async function getBrief(documentId: string) {
  if (browserMockEnabled) return mockGetBrief(documentId);
  const { data } = await api.get(`/documents/${documentId}/brief`);
  return data.brief as BriefData;
}

export interface CaseLawSearch {
  provider: "CourtListener" | "Mock research";
  query: string;
  retrievedAt: string;
  notice?: string;
  results: { id: number; caseName: string; court: string; dateFiled: string | null; citations: string[]; url: string; snippet: string; status: string }[];
}

export async function searchCaseLaw(query: string): Promise<CaseLawSearch> {
  if (browserMockEnabled) return mockSearchCaseLaw(query);
  const { data } = await api.get("/research/cases", { params: { q: query }, timeout: 20000 });
  return data;
}
