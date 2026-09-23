/**
 * Deterministic citation verification.
 *
 * This function is the one piece of Certus that is NOT allowed to trust
 * the LLM. Every claim Gemini produces (a fact, a law reference, an
 * inference) carries a `sourceText` + `sourcePage` it claims to be
 * grounded in. Before that claim is ever shown to a user, it must pass
 * through here. If it fails, the claim's label is downgraded to
 * UNVERIFIED regardless of what the model originally tagged it as.
 *
 * Deliberately NOT another LLM call: this has to be fast, deterministic,
 * and auditable. Two checks:
 *   1. Does the cited sourceText actually appear in the document
 *      (allowing for OCR noise / whitespace drift)?
 *   2. Does the claim text share enough substantive content with the
 *      cited sourceText to plausibly be "supported by" it, rather than
 *      just topically adjacent?
 */

export interface VerificationResult {
  verified: boolean;
  confidence: number; // 0..1
  reason?: string;
}

const STOPWORDS = new Set([
  "the", "a", "an", "of", "to", "and", "or", "in", "on", "for", "is", "are",
  "was", "were", "be", "been", "by", "with", "as", "at", "this", "that",
  "it", "its", "shall", "will", "may", "must", "not", "any", "such",
]);

/** Lowercase, strip punctuation, collapse whitespace, drop stopwords -> token set */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s%$.]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map((t) => {
      // Light stemming for common legal inflections (e.g. terminating/terminate, days/day)
      if (t.endsWith("ing") && t.length > 5) return t.slice(0, -3);
      if (t.endsWith("ed") && t.length > 4) return t.slice(0, -2);
      if (t.endsWith("s") && !t.endsWith("ss") && t.length > 3) return t.slice(0, -1);
      return t;
    });
}

/** Normalize whitespace/OCR artifacts and strip quotation marks for substring matching */
function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019'"]/g, "")
    .replace(/[\u201c\u201d]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Fuzzy containment: is `needle` findable in `haystack` allowing minor OCR drift? */
function fuzzyContains(haystack: string, needle: string): { found: boolean; ratio: number } {
  const h = normalizeForMatch(haystack);
  const n = normalizeForMatch(needle);
  if (n.length === 0) return { found: false, ratio: 0 };

  if (h.includes(n)) return { found: true, ratio: 1 };

  // Sliding-window token overlap: find the best-matching window in haystack
  // of similar length to needle, and score token overlap.
  const needleTokens = tokenize(n);
  if (needleTokens.length === 0) return { found: false, ratio: 0 };

  const haystackWords = h.split(" ");
  const windowSize = Math.max(needleTokens.length, 3);
  let bestRatio = 0;

  for (let i = 0; i <= Math.max(0, haystackWords.length - 1); i += 1) {
    const window = haystackWords.slice(i, i + windowSize + 5).join(" ");
    const windowTokens = new Set(tokenize(window));
    if (windowTokens.size === 0) continue;
    const overlap = needleTokens.filter((t) => windowTokens.has(t)).length;
    const ratio = overlap / needleTokens.length;
    if (ratio > bestRatio) bestRatio = ratio;
    if (bestRatio === 1) break;
  }

  const containmentThreshold = process.env.VERIFY_CONTAINMENT_THRESHOLD
    ? parseFloat(process.env.VERIFY_CONTAINMENT_THRESHOLD)
    : 0.85;

  return { found: bestRatio >= containmentThreshold, ratio: bestRatio };
}

/** Does claimText share enough substantive tokens with sourceText to be "supported"? */
function claimSupportedBySource(claimText: string, sourceText: string): number {
  const claimTokens = new Set(tokenize(claimText));
  const sourceTokens = new Set(tokenize(sourceText));
  if (claimTokens.size === 0) return 0;

  let shared = 0;
  claimTokens.forEach((t) => {
    if (sourceTokens.has(t)) shared += 1;
  });

  return shared / claimTokens.size;
}

export function verifyCitation(
  claimText: string,
  sourceText: string | null | undefined,
  sourcePage: number | null | undefined,
  documentFullText: string
): VerificationResult {
  if (!sourceText || sourceText.trim().length === 0) {
    return { verified: false, confidence: 0, reason: "no citation provided" };
  }

  if (!documentFullText || documentFullText.trim().length === 0) {
    return { verified: false, confidence: 0, reason: "document text unavailable" };
  }

  // Step 1: does the cited text actually exist in the document?
  const containment = fuzzyContains(documentFullText, sourceText);
  if (!containment.found) {
    return {
      verified: false,
      confidence: Math.round(containment.ratio * 100) / 100,
      reason: "citation not found in source document",
    };
  }

  // Step 2: does the claim actually follow from that cited text?
  // FR-4.3 standard threshold: lexical >= 0.25
  const lexicalThreshold = process.env.VERIFY_LEXICAL_THRESHOLD
    ? parseFloat(process.env.VERIFY_LEXICAL_THRESHOLD)
    : 0.25;

  const supportRatio = claimSupportedBySource(claimText, sourceText);

  if (supportRatio < lexicalThreshold) {
    return {
      verified: false,
      confidence: Math.round(supportRatio * 100) / 100,
      reason: "citation does not substantively support claim",
    };
  }

  // Combine both signals into a single confidence score.
  const confidence = Math.round(((containment.ratio + supportRatio) / 2) * 100) / 100;

  return { verified: true, confidence };
}


