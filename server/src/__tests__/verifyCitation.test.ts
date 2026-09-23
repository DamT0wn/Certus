import { verifyCitation } from "../services/verifyCitation";

const DOCUMENT_TEXT = `
EMPLOYMENT AGREEMENT

Section 4.2: The Employee shall provide the Employer with sixty (60) days
written notice prior to resignation. Failure to provide such notice may
result in forfeiture of accrued bonus payments.

Section 7.1: This Agreement shall be governed by the laws of the State
of Delaware.

Section 9.3: The Employer may terminate this Agreement at any time for
cause, including but not limited to gross misconduct or breach of
confidentiality obligations.
`;

describe("verifyCitation", () => {
  test("exact match: claim directly supported by an exact substring citation", () => {
    const result = verifyCitation(
      "The employee must give 60 days written notice before resigning.",
      "The Employee shall provide the Employer with sixty (60) days written notice prior to resignation.",
      2,
      DOCUMENT_TEXT
    );
    expect(result.verified).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  test("fuzzy OCR-noise match: citation has whitespace/OCR artifacts but is still the same passage", () => {
    const noisySource = "The  Employee   shall provide the Employer with sixty (60)\ndays written  notice prior to  resignation.";
    const result = verifyCitation(
      "60 days notice is required before resignation.",
      noisySource,
      2,
      DOCUMENT_TEXT
    );
    expect(result.verified).toBe(true);
  });

  test("unrelated text: citation exists in document but does not support the claim", () => {
    const result = verifyCitation(
      "The employee is entitled to unlimited paid vacation.",
      "This Agreement shall be governed by the laws of the State of Delaware.",
      3,
      DOCUMENT_TEXT
    );
    expect(result.verified).toBe(false);
    expect(result.reason).toMatch(/does not substantively support/);
  });

  test("missing citation: no sourceText provided at all", () => {
    const result = verifyCitation(
      "The employee must give 60 days notice.",
      null,
      null,
      DOCUMENT_TEXT
    );
    expect(result.verified).toBe(false);
    expect(result.reason).toMatch(/no citation provided/);
  });

  test("citation not found in document at all (hallucinated quote)", () => {
    const result = verifyCitation(
      "The employee gets a company car.",
      "The Employer shall provide a company vehicle to the Employee.",
      1,
      DOCUMENT_TEXT
    );
    expect(result.verified).toBe(false);
    expect(result.reason).toMatch(/not found in source document/);
  });

  test("empty document text is handled safely", () => {
    const result = verifyCitation("claim", "source", 1, "");
    expect(result.verified).toBe(false);
    expect(result.reason).toMatch(/document text unavailable/);
  });

  test("empty or whitespace-only citation is rejected", () => {
    const result = verifyCitation("Some valid claim", "   \n\t  ", 1, DOCUMENT_TEXT);
    expect(result.verified).toBe(false);
    expect(result.reason).toMatch(/no citation provided/);
  });

  test("respects configurable VERIFY_LEXICAL_THRESHOLD environment variable", () => {
    const originalEnv = process.env.VERIFY_LEXICAL_THRESHOLD;
    try {
      // Set high threshold -> should reject moderate overlap
      process.env.VERIFY_LEXICAL_THRESHOLD = "0.95";
      const highRes = verifyCitation(
        "Notice is required before resignation.",
        "The Employee shall provide the Employer with sixty (60) days written notice prior to resignation.",
        2,
        DOCUMENT_TEXT
      );
      expect(highRes.verified).toBe(false);

      // Set low threshold -> should accept
      process.env.VERIFY_LEXICAL_THRESHOLD = "0.10";
      const lowRes = verifyCitation(
        "Notice is required before resignation.",
        "The Employee shall provide the Employer with sixty (60) days written notice prior to resignation.",
        2,
        DOCUMENT_TEXT
      );
      expect(lowRes.verified).toBe(true);
    } finally {
      process.env.VERIFY_LEXICAL_THRESHOLD = originalEnv;
    }
  });

  test("handles smart quotes, casing differences, and punctuation drift", () => {
    const result = verifyCitation(
      "Agreement governed by Delaware state law.",
      "“This Agreement shall be governed by the laws of the State of Delaware.”",
      3,
      DOCUMENT_TEXT
    );
    expect(result.verified).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.4);
  });
});

