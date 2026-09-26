import { gateClaims } from "../services/geminiService";
import { verifyDocumentPages, evidenceHash } from "../services/documentEvidence";

const quote = "The client shall pay a fixed fee of $7,500 within thirty days.";
const pages = [{ pageNumber: 1, text: "First page with unrelated text." }, { pageNumber: 2, text: quote }];
test("rejects a citation assigned to the wrong page", () => {
  const claims = gateClaims([{ text: quote, sourceText: quote, sourcePage: 1, label: "DOCUMENT_FACT" }], quote);
  expect(verifyDocumentPages(claims, pages)[0].label).toBe("UNVERIFIED");
});
test("resolves an unspecified page from actual source text", () => {
  const claims = gateClaims([{ text: quote, sourceText: quote, sourcePage: 0, label: "DOCUMENT_FACT" }], quote);
  expect(verifyDocumentPages(claims, pages)[0].sourcePage).toBe(2);
});
test("content digest is repeatable and changes when evidence changes", () => {
  expect(evidenceHash(quote, [])).toMatch(/^[a-f0-9]{64}$/);
  expect(evidenceHash(quote, [])).toBe(evidenceHash(quote, []));
  expect(evidenceHash(quote, [])).not.toBe(evidenceHash(quote + " changed", []));
});
