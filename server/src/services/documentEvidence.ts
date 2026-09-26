import { createHash } from "crypto";
import { VerifiedClaim } from "./geminiService";
import { verifyCitation } from "./verifyCitation";

export function verifyDocumentPages(claims: VerifiedClaim[], pages: { pageNumber: number; text: string }[]): VerifiedClaim[] {
  return claims.map(claim => {
    if (!claim.sourceText || claim.originalLabel === "VERIFIED_LAW") return claim;
    const page = claim.sourcePage > 0
      ? pages.find(p => p.pageNumber === claim.sourcePage)
      : pages.find(p => p.text.replace(/\s+/g, " ").includes(claim.sourceText.replace(/\s+/g, " ")));
    const verification = verifyCitation(claim.text, claim.sourceText, page?.pageNumber, page?.text || "");
    return { ...claim, sourcePage: page?.pageNumber || 0, label: verification.verified ? claim.label : "UNVERIFIED", verification };
  });
}

export function evidenceHash(text: string, claims: unknown[]): string {
  return createHash("sha256").update(JSON.stringify({ version: 1, text, claims })).digest("hex");
}
