import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { verifyCitation } from "./verifyCitation";
import { ProofLabel } from "../models";

let genAIClient: GoogleGenerativeAI | null = null;
function getGenAI(): GoogleGenerativeAI {
  if (!genAIClient) {
    genAIClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
  }
  return genAIClient;
}

const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-2.5-flash";

/** Deterministic pseudo-random vector generator for mock embeddings (768 dimensions) */
function generateDeterministicVector(text: string, dimensions = 768): number[] {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  let s = hash >>> 0;
  const vec: number[] = new Array(dimensions);
  let norm = 0;
  for (let i = 0; i < dimensions; i++) {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    const val = ((t ^ (t >>> 14)) >>> 0) / 4294967296 - 0.5;
    vec[i] = val;
    norm += val * val;
  }
  const mag = Math.sqrt(norm) || 1;
  return vec.map((v) => Math.round((v / mag) * 1000000) / 1000000);
}

/** Helper to extract sentences from document text matching one or more regex patterns */
function findSentenceMatching(text: string, regexes: RegExp[]): string | null {
  const sentences = text
    .split(/(?<=[.?!])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
  for (const r of regexes) {
    const found = sentences.find((s) => r.test(s));
    if (found) return found;
  }
  return null;
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
              "DOCUMENT_FACT = stated verbatim/directly in the document. VERIFIED_LAW = a legal rule you are confident is accurate general law (not from this doc). AI_INFERENCE = your reasoning/interpretation, not directly stated. UNVERIFIED = you are not confident and have no solid citation.",
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

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const parsed = JSON.parse(text) as { claims: RawClaim[] };
  return parsed.claims || [];
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

    // VERIFIED_LAW is allowed to lack an in-document citation (it's general
    // law, not drawn from this doc) — don't downgrade purely for that reason.
    const isLawClaimWithoutDocCitation =
      claim.label === "VERIFIED_LAW" && (!claim.sourceText || claim.sourceText.trim() === "");

    const finalLabel: ProofLabel =
      verification.verified || isLawClaimWithoutDocCitation ? claim.label : "UNVERIFIED";

    let vResult = isLawClaimWithoutDocCitation
      ? { verified: true, confidence: 0.85, reason: "External authoritative legal doctrine" }
      : { ...verification };

    // Enforce FR-2.4: AI_INFERENCE and UNVERIFIED must always carry confidence and reasoning
    if (finalLabel === "AI_INFERENCE") {
      vResult.confidence = vResult.confidence > 0 ? vResult.confidence : 0.75;
      vResult.reason = vResult.reason || "Logical inference grounded in verified contract text; requires legal confirmation";
    } else if (finalLabel === "UNVERIFIED") {
      vResult.confidence = vResult.confidence > 0 ? vResult.confidence : 0.2;
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
    console.log("[certus] MOCK GEMINI: Extracting facts from document text");
    const rawClaims: RawClaim[] = [];

    // Fact 1: Position / Parties
    const partySentence = findSentenceMatching(documentFullText, [/entered into as of/i, /serve as/i, /between/i]);
    if (partySentence) {
      rawClaims.push({
        text: `The agreement is entered into with Sarah Jenkins serving as Vice President of Engineering reporting to the Chief Technology Officer.`,
        label: "DOCUMENT_FACT",
        sourcePage: 1,
        sourceText: partySentence,
      });
    }

    // Fact 2: Compensation
    const salarySentence = findSentenceMatching(documentFullText, [/initial annual base salary/i, /base salary/i, /\$240,000/i]);
    if (salarySentence) {
      rawClaims.push({
        text: `The Company shall pay Executive an initial annual base salary of $240,000 in accordance with standard payroll practices.`,
        label: "DOCUMENT_FACT",
        sourcePage: 1,
        sourceText: salarySentence,
      });
    }

    // Fact 3: Restrictive Covenants / Non-compete
    const nonCompeteSentence = findSentenceMatching(documentFullText, [/twelve \(12\) months/i, /competing enterprise/i, /non-competition/i]);
    if (nonCompeteSentence) {
      rawClaims.push({
        text: `Executive is subject to a non-competition restriction for twelve (12) months following termination within North America.`,
        label: "DOCUMENT_FACT",
        sourcePage: 2,
        sourceText: nonCompeteSentence,
      });

      rawClaims.push({
        text: `During the twelve (12) months following termination, restricting Executive from any competing enterprise within North America may face judicial scrutiny.`,
        label: "AI_INFERENCE",
        sourcePage: 2,
        sourceText: nonCompeteSentence,
      });
    }

    // Fact 4: Termination notice
    const noticeSentence = findSentenceMatching(documentFullText, [/sixty \(60\) days/i, /notice of resignation/i, /written notice/i]);
    if (noticeSentence) {
      rawClaims.push({
        text: `Executive may terminate employment by providing at least sixty (60) days prior written notice to the Company.`,
        label: "DOCUMENT_FACT",
        sourcePage: 3,
        sourceText: noticeSentence,
      });
    }

    // Fact 5: Governing law
    const lawSentence = findSentenceMatching(documentFullText, [/laws of the State of Delaware/i, /arbitration administered by JAMS/i]);
    if (lawSentence) {
      rawClaims.push({
        text: `The agreement is governed by the laws of the State of Delaware with dispute resolution via binding arbitration.`,
        label: "DOCUMENT_FACT",
        sourcePage: 3,
        sourceText: lawSentence,
      });
    }

    // Verified Law: General doctrine without in-doc citation
    rawClaims.push({
      text: "Under Delaware corporate and employment jurisprudence, non-compete covenants must be strictly reasonable in duration and geographic scope to be enforceable.",
      label: "VERIFIED_LAW",
      sourcePage: 0,
      sourceText: "",
    });

    // Unverified claim: Claim tagged as DOCUMENT_FACT but with hallucinated sourceText to prove gate verification downgrades it
    rawClaims.push({
      text: "Executive is entitled to full immediate acceleration of all unvested equity options upon any change of control.",
      label: "DOCUMENT_FACT", // Gemini tagged as fact
      sourcePage: 1,
      sourceText: "In the event of a change in corporate control, 100% of all unvested stock options shall accelerate immediately.", // NOT in document
    });

    // Pass every claim through the real deterministic gate
    return gateClaims(rawClaims, documentFullText);
  }

  // Real Gemini call
  const prompt = `You are analyzing a legal document. Extract the key facts, obligations, dates, parties, and risks.

For EVERY claim you produce:
- Quote the exact verbatim sourceText from the document that supports it (do not paraphrase the citation).
- Give the page number if identifiable, else 0.
- Label it DOCUMENT_FACT if stated directly in the document, VERIFIED_LAW if it's a general legal rule you're confident about (not from this doc), AI_INFERENCE if it's your interpretation, UNVERIFIED if you're not confident.

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
    console.log(`[certus] MOCK GEMINI: Answering question "${question}"`);
    const qLower = question.toLowerCase();
    const rawClaims: RawClaim[] = [];

    // Check what topic question relates to
    if (qLower.includes("salary") || qLower.includes("pay") || qLower.includes("bonus") || qLower.includes("compensation")) {
      const sentence = findSentenceMatching(documentFullText, [/initial annual base salary of \$240,000/i, /discretionary bonus/i]);
      if (sentence) {
        rawClaims.push({
          text: `The Company shall pay Executive an initial annual base salary of $240,000, with eligibility for a discretionary bonus target of 25%.`,
          label: "DOCUMENT_FACT",
          sourcePage: 1,
          sourceText: sentence,
        });
      }
    } else if (qLower.includes("non-compete") || qLower.includes("compete") || qLower.includes("restrict") || qLower.includes("covenant")) {
      const sentence = findSentenceMatching(documentFullText, [/twelve \(12\) months following termination/i, /competing enterprise/i]);
      if (sentence) {
        rawClaims.push({
          text: `Executive is prohibited for twelve (12) months following termination from engaging in or performing services for any competing enterprise within North America.`,
          label: "DOCUMENT_FACT",
          sourcePage: 2,
          sourceText: sentence,
        });
        rawClaims.push({
          text: `The twelve-month non-compete restriction across North America constitutes a significant restraint on post-termination employment opportunities.`,
          label: "AI_INFERENCE",
          sourcePage: 2,
          sourceText: sentence,
        });
      }
    } else if (qLower.includes("resign") || qLower.includes("notice") || qLower.includes("terminate") || qLower.includes("severance")) {
      const sentence = findSentenceMatching(documentFullText, [/sixty \(60\) days prior written notice/i, /continuation of base salary for six \(6\) months/i]);
      if (sentence) {
        rawClaims.push({
          text: `Executive may terminate employment by providing at least sixty (60) days prior written notice, and termination without Cause includes continuation of base salary for six months.`,
          label: "DOCUMENT_FACT",
          sourcePage: 3,
          sourceText: sentence,
        });
      }
    } else if (qLower.includes("law") || qLower.includes("delaware") || qLower.includes("dispute") || qLower.includes("court") || qLower.includes("arbitration")) {
      const sentence = findSentenceMatching(documentFullText, [/laws of the State of Delaware/i, /administered by JAMS/i]);
      if (sentence) {
        rawClaims.push({
          text: `The Agreement is governed by the laws of the State of Delaware and requires confidential binding arbitration administered by JAMS in Wilmington, Delaware.`,
          label: "DOCUMENT_FACT",
          sourcePage: 3,
          sourceText: sentence,
        });
      }
    } else {
      // General question: use relevant chunks or first grounded sentence
      const bestChunk = relevantChunks[0];
      const chunkSentence = bestChunk
        ? findSentenceMatching(bestChunk.text, [/.{30,}/])
        : findSentenceMatching(documentFullText, [/.{30,}/]);

      if (chunkSentence) {
        rawClaims.push({
          text: `According to the document text, ${chunkSentence.slice(0, 150)}.`,
          label: "DOCUMENT_FACT",
          sourcePage: bestChunk?.pageNumber || 1,
          sourceText: chunkSentence,
        });
      } else {
        rawClaims.push({
          text: "The document excerpts do not provide sufficient evidentiary grounds to answer this question definitively.",
          label: "UNVERIFIED",
          sourcePage: 0,
          sourceText: "",
        });
      }
    }

    return gateClaims(rawClaims, documentFullText);
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
    console.log(`[certus] MOCK GEMINI: Running what-if scenario "${scenarioPrompt}"`);
    const sLower = scenarioPrompt.toLowerCase();
    const rawClaims: RawClaim[] = [];

    if (sLower.includes("resign") || sLower.includes("notice") || sLower.includes("early")) {
      const sentence = findSentenceMatching(documentFullText, [/early resignation without sufficient notice/i, /sixty \(60\) days prior written notice/i]);
      if (sentence) {
        rawClaims.push({
          text: `In the event of early resignation without sufficient notice, accrued bonuses and unvested equity shall be forfeited immediately.`,
          label: "DOCUMENT_FACT",
          sourcePage: 3,
          sourceText: sentence,
        });
        rawClaims.push({
          text: `Resigning early without sufficient notice results in immediate forfeiture of accrued bonuses and unvested equity.`,
          label: "AI_INFERENCE",
          sourcePage: 3,
          sourceText: sentence,
        });
      }
      rawClaims.push({
        text: "Under Delaware contract law, express conditions precedent to severance or bonus eligibility are strictly enforced as written.",
        label: "VERIFIED_LAW",
        sourcePage: 0,
        sourceText: "",
      });
    } else if (sLower.includes("breach")) {
      const sentence = findSentenceMatching(documentFullText, [/material breach of this Agreement/i, /terminate employment immediately for Cause/i]);
      if (sentence) {
        rawClaims.push({
          text: `Cause includes material breach of this Agreement, fraud, embezzlement, or felony conviction.`,
          label: "DOCUMENT_FACT",
          sourcePage: 3,
          sourceText: sentence,
        });
        rawClaims.push({
          text: `Committing a material breach of this Agreement constitutes Cause and forfeits base salary severance continuation.`,
          label: "AI_INFERENCE",
          sourcePage: 3,
          sourceText: sentence,
        });
      }
      rawClaims.push({
        text: "Under general contract principles, a prior material breach by an employee discharges the employer's obligation to pay post-termination severance.",
        label: "VERIFIED_LAW",
        sourcePage: 0,
        sourceText: "",
      });
    } else {
      // Missed deadline or general scenario
      const noticeSentence = findSentenceMatching(documentFullText, [/written notice/i, /prior written notice/i]);
      if (noticeSentence) {
        rawClaims.push({
          text: `Any deadline or termination notice under this Agreement must be delivered as prior written notice in accordance with contractual terms.`,
          label: "DOCUMENT_FACT",
          sourcePage: 3,
          sourceText: noticeSentence,
        });
        rawClaims.push({
          text: `Failure to meet required written notice deadlines may prevent the assertion of contractual remedies or severance rights.`,
          label: "AI_INFERENCE",
          sourcePage: 3,
          sourceText: noticeSentence,
        });
      }
      rawClaims.push({
        text: "Delaware courts enforce time-sensitive notice provisions where failure to timely notify causes material prejudice to the counterparty.",
        label: "VERIFIED_LAW",
        sourcePage: 0,
        sourceText: "",
      });
    }

    return gateClaims(rawClaims, documentFullText);
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
    return generateDeterministicVector(text, 768);
  }

  const model = getGenAI().getGenerativeModel({
    model: process.env.EMBEDDING_MODEL || "text-embedding-004",
  });
  const result = await model.embedContent(text);
  return result.embedding.values;
}
