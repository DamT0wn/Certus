import { mockAnswerClaims, mockExtractClaims, mockScenarioClaims } from "../mocks/legalAnalysisMocks";

const PAGED_CONTRACT = `[Page 1]
Maple Consulting shall deliver a design report by October 30, 2026.

[Page 2]
Either party may terminate this agreement on fifteen days written notice.
The consultant shall deliver completed work upon termination.`;

describe("document-grounded mock analysis", () => {
  test("keeps simulated extraction tied to the actual source page", () => {
    const claims = mockExtractClaims(PAGED_CONTRACT);
    expect(claims).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourcePage: 1, sourceText: expect.stringContaining("design report") }),
      expect.objectContaining({ sourcePage: 2, sourceText: expect.stringContaining("fifteen days") }),
    ]));
  });

  test("builds a realistic scenario from uploaded clauses instead of canned facts", () => {
    const claims = mockScenarioClaims("What if either party exits early?", PAGED_CONTRACT);
    expect(claims[0]).toEqual(expect.objectContaining({
      label: "AI_INFERENCE",
      sourcePage: 2,
      sourceText: expect.stringContaining("fifteen days"),
    }));
    expect(claims.some((claim) => claim.text.includes("Sarah Jenkins"))).toBe(false);
  });

  test("answers from the most relevant sentence rather than the page preamble", () => {
    const claims = mockAnswerClaims("What payment is required?", [{
      pageNumber: 1,
      text: "Fictional example for product testing. Cedar Studio shall pay a fixed fee of $7,500 within thirty days of receipt.",
    }]);
    expect(claims[0]).toEqual(expect.objectContaining({
      sourcePage: 1,
      sourceText: expect.stringContaining("$7,500"),
    }));
  });
});
