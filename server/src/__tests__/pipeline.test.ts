import { gateClaims, RawClaim } from "../services/geminiService";

const CONTRACT_TEXT = `
MASTER SERVICES AGREEMENT
This Master Services Agreement ("Agreement") is dated January 15, 2024, between
Acme Global Logistics LLC ("Client") and TechVanguard Solutions Inc. ("Vendor").

Section 3. Payment.
Client shall pay all undisputed invoices within thirty (30) days of receipt.
Late payments shall incur interest at the rate of 1.5% per month.

Section 8. Termination.
Either party may terminate this Agreement without cause upon sixty (60) days
prior written notice. In the event of material breach, the non-breaching party
may terminate immediately if such breach remains uncured for fifteen (15) days
following written notice.
`;

describe("Pipeline & Epistemic Honesty Verification Gate (Problem Statement Alignment)", () => {
  test("DOCUMENT_FACT passes verification when grounded in source contract text", () => {
    const rawClaims: RawClaim[] = [
      {
        text: "Client must pay undisputed invoices within thirty (30) days of receipt.",
        label: "DOCUMENT_FACT",
        sourcePage: 1,
        sourceText: "Client shall pay all undisputed invoices within thirty (30) days of receipt.",
      },
    ];

    const gated = gateClaims(rawClaims, CONTRACT_TEXT);

    expect(gated.length).toBe(1);
    expect(gated[0].label).toBe("DOCUMENT_FACT");
    expect(gated[0].verification.verified).toBe(true);
    expect(gated[0].verification.confidence).toBeGreaterThan(0.5);
  });

  test("ungrounded claim is deterministically DOWNGRADED to UNVERIFIED", () => {
    const rawClaims: RawClaim[] = [
      {
        text: "Vendor provides unlimited indemnification for any data breach up to $50 million.",
        label: "DOCUMENT_FACT",
        sourcePage: 1,
        sourceText: "Vendor provides unlimited indemnification for any data breach up to $50 million.", // hallucinated citation
      },
    ];

    const gated = gateClaims(rawClaims, CONTRACT_TEXT);

    expect(gated.length).toBe(1);
    // The gate MUST downgrade it from DOCUMENT_FACT to UNVERIFIED
    expect(gated[0].label).toBe("UNVERIFIED");
    expect(gated[0].originalLabel).toBe("DOCUMENT_FACT");
    expect(gated[0].verification.verified).toBe(false);
    expect(gated[0].verification.reason).toMatch(/citation not found/i);
  });

  test("claim with irrelevant citation is deterministically DOWNGRADED to UNVERIFIED", () => {
    const rawClaims: RawClaim[] = [
      {
        text: "Vendor may assign intellectual property rights to third parties freely.",
        label: "DOCUMENT_FACT",
        sourcePage: 1,
        sourceText: "Late payments shall incur interest at the rate of 1.5% per month.",
      },
    ];

    const gated = gateClaims(rawClaims, CONTRACT_TEXT);

    expect(gated.length).toBe(1);
    expect(gated[0].label).toBe("UNVERIFIED");
    expect(gated[0].verification.verified).toBe(false);
    expect(gated[0].verification.reason).toMatch(/does not substantively support/i);
  });

  test("AI_INFERENCE guarantees confidence score and reasoning field (FR-2.4)", () => {
    const rawClaims: RawClaim[] = [
      {
        text: "Terminating for breach requires giving the defaulting party a 15-day cure opportunity.",
        label: "AI_INFERENCE",
        sourcePage: 1,
        sourceText:
          "In the event of material breach, the non-breaching party may terminate immediately if such breach remains uncured for fifteen (15) days following written notice.",
      },
    ];

    const gated = gateClaims(rawClaims, CONTRACT_TEXT);

    expect(gated.length).toBe(1);
    expect(gated[0].label).toBe("AI_INFERENCE");
    expect(gated[0].verification.confidence).toBeGreaterThanOrEqual(0.0);
    expect(gated[0].verification.confidence).toBeLessThanOrEqual(1.0);
    expect(gated[0].verification.reason).toBeDefined();
    expect(typeof gated[0].verification.reason).toBe("string");
  });

  test("VERIFIED_LAW external doctrine is preserved even without document quote", () => {
    const rawClaims: RawClaim[] = [
      {
        text: "Under standard contract doctrine, notice of default must clearly specify the provision breached.",
        label: "VERIFIED_LAW",
        sourcePage: 0,
        sourceText: "",
      },
    ];

    const gated = gateClaims(rawClaims, CONTRACT_TEXT);

    expect(gated.length).toBe(1);
    expect(gated[0].label).toBe("VERIFIED_LAW");
    expect(gated[0].verification.verified).toBe(true);
  });
});
