import { ProofLabel } from "../models";

/**
 * MOCK IMPLEMENTATION ONLY.
 *
 * These deterministic helpers simulate model and embedding output while keeping
 * every result grounded in the document the user actually uploaded. Keep all
 * simulated AI behavior in this module so live integrations remain auditable.
 */
export interface MockClaim {
  text: string;
  label: ProofLabel;
  sourcePage: number;
  sourceText: string;
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.replace(/^\[Page \d+\]\s*/, "").trim())
    .filter((sentence) => sentence.length > 24);
}

function matchingSentences(text: string, patterns: RegExp[], limit: number): string[] {
  const candidates = sentences(text);
  const matches = candidates.filter((sentence) => patterns.some((pattern) => pattern.test(sentence)));
  return [...new Set(matches)].slice(0, limit);
}

function pageFor(text: string, source: string): number {
  const pageSections = [...text.matchAll(/\[Page (\d+)\]\s*([\s\S]*?)(?=\n\n\[Page \d+\]|$)/g)];
  const page = pageSections.find((match) => match[2].includes(source));
  return page ? Number(page[1]) : 0;
}

export function mockExtractClaims(documentText: string): MockClaim[] {
  const selected = matchingSentences(
    documentText,
    [/\bshall\b/i, /\bmust\b/i, /\bmay\b/i, /\bterminat/i, /\bnotice\b/i, /\bpayment|fee|invoice\b/i, /\bgoverning law|jurisdiction|venue|arbitr/i],
    16
  );

  return selected.map((sourceText) => ({
    text: sourceText,
    label: "DOCUMENT_FACT",
    sourcePage: pageFor(documentText, sourceText),
    sourceText,
  }));
}

export function mockAnswerClaims(
  question: string,
  relevantChunks: { text: string; pageNumber: number }[]
): MockClaim[] {
  const normalizedQuestion = question.toLowerCase();
  const questionTokens = new Set(normalizedQuestion.match(/[a-z0-9$]+/g)?.filter((token) => token.length > 2) || []);
  const candidates = relevantChunks.flatMap((chunk) =>
    sentences(chunk.text).map((text) => {
      const normalizedText = text.toLowerCase();
      const textTokens = new Set(normalizedText.match(/[a-z0-9$]+/g) || []);
      const overlap = [...questionTokens].filter((token) => textTokens.has(token)).length;
      const intentBoost =
        (/pay|payment|fee|invoice|cost/.test(normalizedQuestion) && /\$|pay|payment|fee|invoice/.test(normalizedText) ? 3 : 0) +
        (/terminat|notice|exit/.test(normalizedQuestion) && /terminat|notice|exit/.test(normalizedText) ? 3 : 0);
      return { text, pageNumber: chunk.pageNumber, score: overlap + intentBoost };
    })
  );
  const source = candidates
    .filter(({ text }) => text.length >= 30)
    .sort((a, b) => b.score - a.score)[0];

  return source
    ? [{ text: source.text, label: "DOCUMENT_FACT", sourcePage: source.pageNumber, sourceText: source.text }]
    : [{
        text: "The uploaded document does not contain enough matching evidence to answer this question.",
        label: "UNVERIFIED",
        sourcePage: 0,
        sourceText: "",
      }];
}

export function mockScenarioClaims(scenarioPrompt: string, documentText: string): MockClaim[] {
  const prompt = scenarioPrompt.toLowerCase();
  const patterns = prompt.includes("jurisdiction") || prompt.includes("venue")
    ? [/\bgoverning law|jurisdiction|venue|arbitr/i]
    : /terminat|resign|early|exit/.test(prompt)
      ? [/\bterminat|notice|renew|expire|cure\b/i]
      : [/\bbreach|default|cure|penalt|remed|indemn/i];

  const selected = matchingSentences(documentText, patterns, 4);
  if (!selected.length) {
    return [{
      text: "No clause in the uploaded document directly addresses this scenario; counsel should review the omission before relying on an outcome.",
      label: "UNVERIFIED",
      sourcePage: 0,
      sourceText: "",
    }];
  }

  return selected.map((sourceText, index) => ({
    text: index === 0
      ? `The scenario is directly affected by this clause: ${sourceText}`
      : sourceText,
    label: index === 0 ? "AI_INFERENCE" : "DOCUMENT_FACT",
    sourcePage: pageFor(documentText, sourceText),
    sourceText,
  }));
}

export function mockEmbedding(text: string, dimensions = 768): number[] {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  let state = hash >>> 0;
  const vector = new Array<number>(dimensions);
  let norm = 0;
  for (let i = 0; i < dimensions; i += 1) {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    const normalized = ((value ^ (value >>> 14)) >>> 0) / 4294967296 - 0.5;
    vector[i] = normalized;
    norm += normalized * normalized;
  }
  const magnitude = Math.sqrt(norm) || 1;
  return vector.map((value) => Math.round((value / magnitude) * 1_000_000) / 1_000_000);
}
