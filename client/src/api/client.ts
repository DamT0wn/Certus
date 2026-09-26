import axios from "axios";

export const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL || "/api", timeout: 120000 });

export function apiError(error: unknown): string {
  if (axios.isAxiosError(error)) return error.response?.data?.error || (error.code === "ECONNABORTED" ? "The request timed out. Please retry." : error.message);
  return error instanceof Error ? error.message : "Request failed. Please retry.";
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("certus_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
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
  ownerId: string;
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
  disclaimer: string;
}

export async function login(email: string, password: string) {
  const { data } = await api.post("/auth/login", { email, password });
  return data.token as string;
}

export async function register(email: string, password: string) {
  const { data } = await api.post("/auth/register", { email, password });
  return data.token as string;
}

export async function uploadDocument(file: File) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post("/documents/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data as { documentId: string; status: string; filename: string; pageCount: number };
}

export async function extractDocument(documentId: string) {
  const { data } = await api.post(`/documents/${documentId}/extract`);
  return data.facts as Claim[];
}

export async function getDocument(documentId: string) {
  const { data } = await api.get(`/documents/${documentId}`);
  return data as { document: LegalDocumentData; facts: Claim[] };
}

export async function askQuestion(documentId: string, question: string) {
  const { data } = await api.post("/chat", { documentId, question });
  return data.claims as Claim[];
}

export async function runWhatIf(documentId: string, scenarioPrompt: string) {
  const { data } = await api.post(`/documents/${documentId}/whatif`, { scenarioPrompt });
  return data.claims as Claim[];
}

export async function getBrief(documentId: string) {
  const { data } = await api.get(`/documents/${documentId}/brief`);
  return data.brief as BriefData;
}

export interface CaseLawSearch {
  provider: "CourtListener";
  query: string;
  retrievedAt: string;
  results: { id: number; caseName: string; court: string; dateFiled: string | null; citations: string[]; url: string; snippet: string; status: string }[];
}

export async function searchCaseLaw(query: string): Promise<CaseLawSearch> {
  const { data } = await api.get("/research/cases", { params: { q: query }, timeout: 20000 });
  return data;
}
