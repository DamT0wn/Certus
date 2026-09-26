import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { verifyCitation } from "./verifyCitation";
import { ProofLabel } from "../models";
import {
  mockAnswerClaims,
  mockEmbedding,
  mockExtractClaims,
  mockScenarioClaims,
} from "../mocks/legalAnalysisMocks";

let genAIClient: GoogleGenerativeAI | null = null;
function getGenAI(): GoogleGenerativeAI {
  if (!genAIClient) {
    genAIClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
  }
  return genAIClient;
}

const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-2.5-flash";

function withTimeout<T>(operation: Promise<T>, milliseconds: number, label: string): Promise<T> {
  return Promise.race([
    operation,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${milliseconds}ms`)), milliseconds)),
  ]);
}

/** Every claim Gemini returns must match this exact shape. */
const claimSchema = {
  type: SchemaType.OBJECT,
  properties: {
    claims: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          text: { type: SchemaType.STRING, description: "The claim, fact, or answer text." },
          label: {
            type: SchemaType.STRING,
            enum: ["DOCUMENT_FACT", "VERIFIED_LAW", "AI_INFERENCE", "UNVERIFIED"],
            description:
              "DOCUMENT_FACT = stated verbatim/directly in the document. VERIFIED_LAW is reserved for independently verified legal authority; do not emit this label. AI_INFERENCE = your reasoning/interpretation, not directly stated. UNVERIFIED = you are not confident and have no solid citation.",
          },
          sourcePage: {
            type: SchemaType.NUMBER,
            description: "Page number this claim is grounded in, if any. Use 0 if none.",
          },
          sourceText: {
            type: SchemaType.STRING,
            description:
              "The exact verbatim text from the document that supports this claim. Empty string if none exists.",
          },
        },
        required: ["text", "label", "sourcePage", "sourceText"],
      },
    },
  },
  required: ["claims"],
};

export interface RawClaim {
  text: string;
  label: ProofLabel;
  sourcePage: number;
  sourceText: string;
}

export interface VerifiedClaim extends RawClaim {
  verification: { verified: boolean; confidence: number; reason?: string };
  /** Label as originally returned by Gemini, kept for audit even if downgraded */
  originalLabel: ProofLabel;
}

async function callGeminiStructured(prompt: string): Promise<RawClaim[]> {
  const model = getGenAI().getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: claimSchema as any,
    },
  });

  const result = await withTimeout(model.generateContent(prompt), 60_000, "Gemini request");
  const text = result.response.text();
  const parsed = JSON.parse(text) as { claims: RawClaim[] };
  if (!Array.isArray(parsed.claims) || parsed.claims.some(c =>
    typeof c.text !== "string" || typeof c.sourceText !== "string" ||
    !Number.isInteger(c.sourcePage) || !["DOCUMENT_FACT", "VERIFIED_LAW", "AI_INFERENCE", "UNVERIFIED"].includes(c.label)
  )) throw new Error("AI returned an invalid claim payload");
  return parsed.claims;
}

/**
 * Runs every claim through the deterministic verification gate.
 * A claim Gemini tagged as DOCUMENT_FACT/VERIFIED_LAW/AI_INFERENCE that
 * fails verification is downgraded to UNVERIFIED — the model's own
 * confidence is never taken at face value.
 *
 * FR-2.4: Claims labeled AI_INFERENCE or UNVERIFIED must include a confidence
 * score (0.0-1.0) and a reasoning field explaining the inference chain.
 */
export function gateClaims(claims: RawClaim[], documentFullText: string): VerifiedClaim[] {
  return claims.map((claim) => {
    const verification = verifyCitation(
      claim.text,
      claim.sourceText,
      claim.sourcePage,
      documentFullText
    );

    // Document matching cannot authenticate external legal authority.
    const isLaw = claim.label === "VERIFIED_LAW";
    const finalLabel: ProofLabel = verification.verified && !isLaw ? claim.label : "UNVERIFIED";
    const vResult = isLaw
      ? { verified: false, confidence: 0, reason: "External legal authority has not been independently verified" }
      : { ...verification };

    // Enforce FR-2.4: AI_INFERENCE and UNVERIFIED must always carry confidence and reasoning
    if (finalLabel === "AI_INFERENCE") {
      vResult.reason = vResult.reason || "Logical inference grounded in verified contract text; requires legal confirmation";
    } else if (finalLabel === "UNVERIFIED") {
      vResult.reason = vResult.reason || "Citation gate rejected: citation absent or failed substantive support check";
    }

    return {
      ...claim,
      originalLabel: claim.label,
      label: finalLabel,
      verification: vResult,
    };
  });
}


export async function extractFactsFromDocument(
  documentFullText: string
): Promise<VerifiedClaim[]> {
  // MOCK MODE — replace with real Google Cloud call when GCP credentials are ready
  if (process.env.MOCK_MODE === "true") {
    return gateClaims(mockExtractClaims(documentFullText), documentFullText);
  }

  // Real Gemini call
  const prompt = `You are analyzing a legal document. Extract the key facts, obligations, dates, parties, and risks.

For EVERY claim you produce:
- Quote the exact verbatim sourceText from the document that supports it (do not paraphrase the citation).
- Give the page number if identifiable, else 0.
- Label it DOCUMENT_FACT if stated directly in the document, UNVERIFIED for external legal rules without independent authority verification, AI_INFERENCE if it's your interpretation, UNVERIFIED if you're not confident.

Document:
"""
${documentFullText}
"""`;

  const rawClaims = await callGeminiStructured(prompt);
  return gateClaims(rawClaims, documentFullText);
}

export async function answerQuestionWithCitations(
  question: string,
  relevantChunks: { text: string; pageNumber: number }[],
  documentFullText: string
): Promise<VerifiedClaim[]> {
  // MOCK MODE — replace with real Google Cloud call when GCP credentials are ready
  if (process.env.MOCK_MODE === "true") {
    return gateClaims(mockAnswerClaims(question, relevantChunks), documentFullText);
  }

  // Real Gemini call
  const context = relevantChunks
    .map((c) => `[Page ${c.pageNumber}] ${c.text}`)
    .join("\n\n");

  const prompt = `Answer the user's question using ONLY the document excerpts below. If the excerpts do not contain enough information to answer confidently, you MUST return a single claim with label UNVERIFIED and sourceText "" explaining that there is insufficient evidence — do not guess.

Document excerpts:
"""
${context}
"""

Question: ${question}

For every claim in your answer, quote the exact verbatim sourceText and page number it came from.`;

  const rawClaims = await callGeminiStructured(prompt);
  return gateClaims(rawClaims, documentFullText);
}

export async function runWhatIfScenario(
  scenarioPrompt: string,
  documentFullText: string
): Promise<VerifiedClaim[]> {
  // MOCK MODE — replace with real Google Cloud call when GCP credentials are ready
  if (process.env.MOCK_MODE === "true") {
    return gateClaims(mockScenarioClaims(scenarioPrompt, documentFullText), documentFullText);
  }

  // Real Gemini call
  const prompt = `You are analyzing a hypothetical scenario against a legal document.

Scenario: ${scenarioPrompt}

Document:
"""
${documentFullText}
"""

Explain what would likely happen under this document if this scenario occurred. For every claim, quote the exact verbatim sourceText and page number it is grounded in, and label it appropriately (DOCUMENT_FACT, VERIFIED_LAW, AI_INFERENCE, or UNVERIFIED).`;

  const rawClaims = await callGeminiStructured(prompt);
  return gateClaims(rawClaims, documentFullText);
}

export async function embedText(text: string): Promise<number[]> {
  // MOCK MODE — replace with real Google Cloud call when GCP credentials are ready
  if (process.env.MOCK_MODE === "true") {
    return mockEmbedding(text, 768);
  }

  const model = getGenAI().getGenerativeModel({
    model: process.env.EMBEDDING_MODEL || "text-embedding-004",
  });
  const result = await withTimeout(model.embedContent(text), 30_000, "Gemini embedding request");
  return result.embedding.values;
}
