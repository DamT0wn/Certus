---
inclusion: always
---

# Certus — Core Steering Rule: Proof Mode

## Mandatory principle — applies to every task in this project

**LLM output is never the sole source of truth.**

Every factual claim produced by any LLM (Gemini or otherwise) must pass through the deterministic Citation Verification Function before it is shown to the user. This is not a recommendation — it is a hard architectural constraint.

## What this means in practice

- **Never** render a Gemini response directly in the UI. It must first pass through `verifyCitation()`.
- **Never** label a claim `DOCUMENT_FACT` or `VERIFIED_LAW` based on Gemini's own assertion. Labels are assigned by the backend after verification.
- **Never** add a code path that bypasses the verification function for speed, simplicity, or convenience.
- The `UNVERIFIED` label is not an error state — it is the correct output when a claim cannot be grounded. Surface it honestly.
- If verification infrastructure is unavailable (DB down, embedding API down), the correct behavior is to block the response, not to show unverified output with a warning.

## Proof Mode label rules

| Label | Who assigns it | Condition |
|---|---|---|
| `DOCUMENT_FACT` | Backend (post-verification) | Claim verified with lexical or semantic match; lexical method |
| `VERIFIED_LAW` | Backend (post VERIFIED_LAW upgrade function) | Claim contains a matched statutory citation pattern |
| `AI_INFERENCE` | Backend (post-verification) | Claim verified semantically but not lexically; or Gemini flagged it |
| `UNVERIFIED` | Backend (post-verification) | Verification failed OR Gemini explicitly marked it UNVERIFIED |

## Files where this rule is most critical

- `server/lib/verifyCitation.ts` — the trust boundary; must remain LLM-free
- `server/routes/qa.ts` — must call verifyCitation before constructing response
- `server/services/extraction.ts` — must call verifyCitation on every claim before storing
- Any new route that surfaces AI-generated content to the client

## Do not add to this project

- LLM-as-judge patterns (using a second LLM to validate the first LLM's output) — not a substitute for deterministic verification
- Auto-approval of Gemini output based on confidence scores alone
- Client-side verification logic — verification runs server-side only
