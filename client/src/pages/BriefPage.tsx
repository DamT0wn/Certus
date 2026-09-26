import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getBrief, apiError } from "../api/client";
import type { Claim, BriefData } from "../api/client";
import { AppHeader } from "../components/AppHeader";
import { ProofBadge } from "../components/ProofLabelChip";
import {
  Printer,
  Copy,
  Check,
  ChevronLeft,
  ShieldCheck,
  AlertCircle,
  Scale,
  FileText,
} from "lucide-react";

export function BriefPage() {
  const { id } = useParams<{ id: string }>();
  const [brief, setBrief] = useState<BriefData | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");


  useEffect(() => {
    if (!id) return;
    getBrief(id).then(setBrief).catch(err => setError(apiError(err)));
  }, [id]);

  const handleCopyMarkdown = async () => {
    if (!brief) return;
    const text = `# CERTUS LEGAL INTELLIGENCE MEMORANDUM
Document: ${brief.filename}
Generated: ${new Date(brief.generatedAt).toLocaleString()}
Classification: CONFIDENTIAL ATTORNEY WORK PRODUCT

## 01 · EXECUTIVE SUMMARY & SYNOPSIS
This memorandum provides a citation-gated audit of ${brief.filename}. ${brief.stats.verifiedCount} of ${brief.stats.totalClaims} claims passed the citation gate. ${brief.stats.flaggedCount} claims require review. Mode: ${brief.mode}.\nContent SHA-256: ${brief.contentHash}

## 02 · MATERIAL VERIFIED FACTS
${brief.verifiedFacts?.map((f: Claim, i: number) => `${i + 1}. ${f.text} [Page ${f.sourcePage || "N/A"}]\n   "${f.sourceText || ""}"`).join("\n\n")}

## 03 · APPLICABLE GOVERNING LAW & DOCTRINE
${brief.applicableLaw?.map((l: Claim, i: number) => `${i + 1}. ${l.text}`).join("\n")}

## 04 · FLAGGED INFERENCES & EXPOSURE ANALYSIS
${brief.flaggedInferences?.map((inf: Claim, i: number) => `${i + 1}. ${inf.text}`).join("\n")}

## 05 · CITATION GATE ALERTS & UNVERIFIED CLAIMS
${brief.openQuestions?.map((q: Claim, i: number) => `${i + 1}. ${q.text} (Reason: ${q.verification?.reason || "Ungrounded in source text"})`).join("\n")}

## 06 · DOCUMENT Q&A TRANSCRIPT
${brief.qaTranscript?.map((message) => `${message.role === "user" ? "Question" : "Answer"}: ${message.text}`).join("\n\n") || "No document questions recorded."}

## 07 · SCENARIO COMPARISONS
${brief.scenarioComparisons?.map((scenario, i) => `${i + 1}. ${scenario.prompt}\n${scenario.claims.map((claim) => `   - [${claim.label}] ${claim.text}`).join("\n")}`).join("\n\n") || "No scenarios recorded."}
`;
    try { await navigator.clipboard.writeText(text); setCopied(true); }
    catch { setError("Clipboard access failed. Use Print / Export PDF instead."); }
    setTimeout(() => setCopied(false), 2000);
  };

  if (!brief) {
    return (
      <div className="min-h-screen flex flex-col bg-[#FAF9F6] text-[#14171F] font-sans-ui">
        <AppHeader documentId={id} />
        <div className="flex-1 flex items-center justify-center">
          <div className="p-8 bg-[#FFFFFF] border border-[#E4E1D8] rounded-[6px] shadow-2xs text-center max-w-sm">
            <div className="w-10 h-10 rounded-[4px] bg-[#FAF9F6] border border-[#E4E1D8] text-[#B08D57] flex items-center justify-center mx-auto mb-3 animate-pulse">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="font-serif-display font-semibold text-[#14171F] text-sm mb-1">
              {error ? "Brief unavailable" : "Typesetting Legal Memorandum…"}
            </h3>
            <p className="text-xs text-[#525866] leading-relaxed">
              {error || "Aggregating citations and review flags…"}
            </p>
            {error && <button className="mt-4 underline" onClick={() => window.location.reload()}>Retry</button>}
          </div>
        </div>
      </div>
    );
  }

  const generatedDate = new Date(brief.generatedAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#14171F] flex flex-col font-sans-ui selection:bg-[#B08D57]/20 selection:text-[#1B2A4A]">
      {/* Global Application Header (hidden in print) */}
      <div className="print:hidden">
        <AppHeader documentId={id} documentName={brief.filename} />
      </div>

      {/* Action Toolbar Header (hidden in print) */}
      <div className="print:hidden sticky top-0 z-20 bg-[#FFFFFF]/95 backdrop-blur-xs border-b border-[#E4E1D8] px-6 py-3 shadow-2xs">
        <div className="brief-toolbar max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to={`/document/${id}`}
              className="inline-flex items-center gap-1 text-xs font-mono-legal text-[#525866] hover:text-[#14171F] bg-[#FAF9F6] hover:bg-[#FFFFFF] border border-[#E4E1D8] px-2.5 py-1.5 rounded-[4px] transition-certus"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Back to Analysis</span>
            </Link>
            <div className="h-4 w-px bg-[#E4E1D8]" />
            <span className="text-xs font-serif-display font-semibold text-[#14171F]">
              Lawyer-Ready Brief · Formal Memorandum
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyMarkdown}
              className="inline-flex items-center gap-1.5 text-xs font-sans-ui font-medium text-[#525866] hover:text-[#14171F] bg-[#FAF9F6] hover:bg-[#FFFFFF] border border-[#E4E1D8] hover:border-[#B08D57] px-3 py-1.5 rounded-[4px] transition-certus shadow-2xs"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[var(--certus-forest)]" /> : <Copy className="w-3.5 h-3.5 text-[#868C98]" />}
              <span>{copied ? "Copied Markdown" : "Copy Memo"}</span>
            </button>

            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#1B2A4A] hover:bg-[#111B30] text-[#FAF9F6] px-3.5 py-1.5 rounded-[4px] transition-certus shadow-2xs border border-[#1B2A4A]"
            >
              <Printer className="w-3.5 h-3.5 text-[#B08D57]" />
              <span>Print / Export PDF</span>
            </button>
          </div>
        </div>
      </div>

      {error && <p role="alert" className="p-3 text-[var(--certus-brick)]">{error}</p>}
      {/* Main Editorial Memorandum Document Sheet (Typeset Legal Document) */}
      <main className="max-w-4xl mx-auto w-full p-6 sm:p-10 my-6 print:my-0 print:p-0 flex-1">
        <div className="memo-sheet bg-[#FFFFFF] rounded-[6px] print:rounded-none shadow-sm print:shadow-none border border-[#E4E1D8] print:border-none p-10 sm:p-16 transition-certus">
          {/* Formal Letterhead-Style Memorandum Header */}
          <div className="border-b-2 border-[#1B2A4A] pb-8 mb-8">
            <div className="flex items-center justify-between text-xs font-mono-legal text-[#868C98] mb-6">
              <div className="flex items-center gap-2">
                {/* Geometric Brass Verification Seal Motif */}
                <div className="w-5 h-5 rounded-[3px] bg-[#1B2A4A] flex items-center justify-center text-[#B08D57] text-[10px] font-bold border border-[#2B3E68]">
                  §
                </div>
                <span className="font-bold tracking-widest text-[#1B2A4A]">
                  CERTUS LEGAL INTELLIGENCE
                </span>
              </div>
              <span className="bg-[#FAF9F6] text-[#1B2A4A] px-2.5 py-0.5 rounded-[3px] font-semibold border border-[#E4E1D8] uppercase tracking-wider text-[10px]">
                CONFIDENTIAL ATTORNEY WORK PRODUCT
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-serif-display font-semibold text-[#14171F] tracking-tight mb-2 leading-snug">
              Legal Document Audit &amp; Citation Brief
            </h1>
            <p className="text-sm font-serif-legal italic text-[#525866]">
              Comprehensive evidentiary review of contractual covenants, general doctrine, and exposure risks.
            </p>

            {/* Tabular Metadata Strip: Mono Labels + Serif Values */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-[#EDEAE2]">
              <div>
                <span className="text-[9.5px] font-mono-legal font-bold text-[#868C98] uppercase tracking-wider block">
                  DOCUMENT
                </span>
                <span className="font-serif-legal font-semibold text-[#14171F] text-[13px] truncate block mt-0.5" title={brief.filename}>
                  {brief.filename}
                </span>
              </div>
              <div>
                <span className="text-[9.5px] font-mono-legal font-bold text-[#868C98] uppercase tracking-wider block">
                  DATE GENERATED
                </span>
                <span className="font-serif-legal text-[#14171F] text-[13px] block mt-0.5">
                  {generatedDate}
                </span>
              </div>
              <div>
                <span className="text-[9.5px] font-mono-legal font-bold text-[#868C98] uppercase tracking-wider block">
                  VERIFICATION
                </span>
                <span className="font-mono-legal text-[var(--certus-forest)] text-[12px] font-medium block mt-0.5 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-[var(--certus-forest)]" />
                  Citation pass rate: {brief.stats.verificationRate}%
                </span>
              </div>
              <div>
                <span className="text-[9.5px] font-mono-legal font-bold text-[#868C98] uppercase tracking-wider block">
                  PAGES REVIEWED
                </span>
                <span className="font-serif-legal text-[#14171F] text-[13px] block mt-0.5">
                  {brief.pageCount}
                </span>
              </div>
            </div>
          </div>

          {/* Section 01: Executive Summary */}
          <div className="mb-10">
            <div className="flex items-center justify-between pb-1 mb-3 border-b border-[#E4E1D8]">
              <h2 className="text-[11px] font-mono-legal font-semibold uppercase tracking-wider text-[#868C98]">
                01 · EXECUTIVE SUMMARY &amp; SYNOPSIS
              </h2>
            </div>
            <div className="bg-[#FAF9F6] border border-[#E4E1D8] rounded-[4px] p-5 text-[14.5px] leading-[1.75] text-[#14171F] font-serif-legal">
              This memorandum audits the material terms of <strong className="font-semibold text-[#14171F]">{brief.filename}</strong>. 
              {" "}{brief.stats.totalClaims} claims were extracted; {brief.stats.verifiedCount} passed as document facts or independently verified law, and {brief.stats.flaggedCount} require review. Citation matching checks textual support, not legal validity.
              {brief.mode === "mock" && <strong className="block mt-2">Demo analysis — AI responses are simulated.</strong>}
            </div>
          </div>

          {/* Section 02: Material Verified Facts */}
          <div className="mb-10">
            <div className="flex items-center justify-between pb-1 mb-4 border-b border-[#E4E1D8]">
              <h2 className="text-[11px] font-mono-legal font-semibold uppercase tracking-wider text-[#868C98]">
                02 · MATERIAL VERIFIED FACTS ({brief.verifiedFacts?.length || 0})
              </h2>
              <span className="text-[10px] font-mono-legal text-[var(--certus-forest)] bg-[var(--certus-forest-bg)] px-2 py-0.5 rounded-[2px] border border-[var(--certus-forest-border)]">
                {brief.verifiedFacts.length} citation-gated facts
              </span>
            </div>

            <div className="space-y-4">
              {brief.verifiedFacts?.map((fact: Claim, idx: number) => (
                <div
                  key={idx}
                  className="p-4 rounded-[4px] border border-[#E4E1D8] bg-[#FFFFFF] hover:border-[#B08D57]/70 transition-certus"
                >
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-[2px] bg-[#FAF9F6] text-[#1B2A4A] flex items-center justify-center text-[10px] font-bold font-mono-legal border border-[#E4E1D8]">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <ProofBadge label="DOCUMENT_FACT" size="sm" />
                    </div>
                    {fact.sourcePage && (
                      <span className="text-[10px] font-mono-legal text-[#525866] bg-[#FAF9F6] px-2 py-0.5 rounded-[2px] border border-[#E4E1D8]">
                        SOURCE: P. {fact.sourcePage}
                      </span>
                    )}
                  </div>

                  <p className="text-[14.5px] text-[#14171F] font-serif-legal font-medium mb-2.5 leading-snug">
                    {fact.text}
                  </p>

                  {fact.sourceText && (
                    <blockquote className="text-[13px] font-serif-legal italic text-[#2A2F3D] bg-[#FAF9F6] border-l-2 border-[#B08D57] pl-3 py-1 rounded-r-[2px] leading-relaxed">
                      "{fact.sourceText}"
                    </blockquote>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Section 03: Applicable Law */}
          {brief.applicableLaw?.length > 0 && (
            <div className="mb-10">
              <div className="flex items-center justify-between pb-1 mb-4 border-b border-[#E4E1D8]">
                <h2 className="text-[11px] font-mono-legal font-semibold uppercase tracking-wider text-[#868C98]">
                  03 · APPLICABLE GOVERNING LAW &amp; CANONS ({brief.applicableLaw.length})
                </h2>
                <span className="text-[10px] font-mono-legal text-[var(--certus-law)] bg-[var(--certus-law-bg)] px-2 py-0.5 rounded-[2px] border border-[var(--certus-law-border)]">
                  Legal authority
                </span>
              </div>

              <div className="space-y-3">
                {brief.applicableLaw.map((law: Claim, idx: number) => (
                  <div
                    key={idx}
                    className="p-4 rounded-[4px] border border-[var(--certus-law-border)] bg-[var(--certus-law-bg)]/40"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Scale className="w-3.5 h-3.5 text-[var(--certus-law)]" />
                      <ProofBadge label="VERIFIED_LAW" size="sm" />
                      <span className="text-[10px] font-mono-legal text-[var(--certus-law)]">Common Law Authority</span>
                    </div>
                    <p className="text-[14px] font-serif-legal text-[#14171F] leading-relaxed">
                      {law.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 04: Flagged Inferences */}
          {brief.flaggedInferences?.length > 0 && (
            <div className="mb-10">
              <div className="flex items-center justify-between pb-1 mb-4 border-b border-[#E4E1D8]">
                <h2 className="text-[11px] font-mono-legal font-semibold uppercase tracking-wider text-[#868C98]">
                  04 · FLAGGED INFERENCES &amp; EXPOSURE ANALYSIS ({brief.flaggedInferences.length})
                </h2>
                <span className="text-[10px] font-mono-legal text-[var(--certus-ochre)] bg-[var(--certus-ochre-bg)] px-2 py-0.5 rounded-[2px] border border-[var(--certus-ochre-border)]">
                  Attorney Review Recommended
                </span>
              </div>

              <div className="space-y-3">
                {brief.flaggedInferences.map((inf: Claim, idx: number) => (
                  <div
                    key={idx}
                    className="p-4 rounded-[4px] border border-[var(--certus-ochre-border)] bg-[var(--certus-ochre-bg)]/40"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <ProofBadge label="AI_INFERENCE" size="sm" />
                      {inf.sourcePage && (
                        <span className="text-[10.5px] font-mono-legal text-[var(--certus-ochre)]">
                          Related Clause: Page {inf.sourcePage}
                        </span>
                      )}
                    </div>
                    <p className="text-[14px] font-serif-legal text-[#14171F] mb-2 leading-relaxed">
                      {inf.text}
                    </p>
                    {inf.sourceText && (
                      <p className="text-[12.5px] font-serif-legal italic text-[#525866] bg-[#FFFFFF] p-2 rounded-[3px] border border-[var(--certus-ochre-border)]">
                        Grounding sentence: "{inf.sourceText}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 05: Citation Gate Alerts & Unverified Claims */}
          {brief.openQuestions?.length > 0 && (
            <div className="mb-10">
              <div className="flex items-center justify-between pb-1 mb-4 border-b border-[#E4E1D8]">
                <h2 className="text-[11px] font-mono-legal font-semibold uppercase tracking-wider text-[#868C98]">
                  05 · CITATION GATE ALERTS &amp; UNVERIFIED CLAIMS ({brief.openQuestions.length})
                </h2>
                <span className="text-[10px] font-mono-legal text-[var(--certus-brick)] bg-[var(--certus-brick-bg)] px-2 py-0.5 rounded-[2px] border border-[var(--certus-brick-border)]">
                  Verification Gate Rejection
                </span>
              </div>

              <div className="space-y-3">
                {brief.openQuestions.map((unv: Claim, idx: number) => (
                  <div
                    key={idx}
                    className="p-4 rounded-[4px] border-2 border-[var(--certus-brick-border)] bg-[var(--certus-brick-bg)]/30"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-[var(--certus-brick)]" />
                        <ProofBadge label="UNVERIFIED" size="sm" />
                      </div>
                      <span className="text-[10px] font-mono-legal text-[var(--certus-brick)] font-semibold">
                        UNGROUNDED STATEMENT
                      </span>
                    </div>
                    <p className="text-[14px] font-serif-legal text-[#14171F] mb-2 font-medium">
                      {unv.text}
                    </p>
                    <p className="text-xs font-sans-ui text-[var(--certus-brick)] bg-[#FFFFFF] p-2 rounded-[3px] border border-[var(--certus-brick-border)]">
                      <strong>Audit Gate Note:</strong> {unv.verification?.reason || "This proposition could not be verified in the source text. Automatically gated as unverified."}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(brief.qaTranscript?.length > 0 || brief.scenarioComparisons?.length > 0) && (
            <section className="mt-8 space-y-6" aria-labelledby="audit-context-heading">
              <h2 id="audit-context-heading" className="font-serif-display font-semibold text-lg text-[#14171F] border-b border-[#E4E1D8] pb-2">
                06 · REVIEW CONTEXT &amp; SCENARIO RECORD
              </h2>

              {brief.qaTranscript?.length > 0 && (
                <div>
                  <h3 className="font-mono-legal text-[11px] font-semibold uppercase tracking-wider text-[#525866] mb-2">Document Q&amp;A transcript</h3>
                  <ol className="space-y-2">
                    {brief.qaTranscript.map((message, index) => (
                      <li key={`${message.createdAt}:${index}`} className="p-3 bg-[#FAF9F6] border border-[#E4E1D8] rounded-[4px] text-sm">
                        <strong className="font-mono-legal text-[10px] uppercase tracking-wider text-[#525866]">{message.role === "user" ? "Question" : "Gated answer"}</strong>
                        <p className="mt-1 font-serif-legal text-[#14171F]">{message.text}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {brief.scenarioComparisons?.length > 0 && (
                <div>
                  <h3 className="font-mono-legal text-[11px] font-semibold uppercase tracking-wider text-[#525866] mb-2">Scenario comparison record</h3>
                  <div className="space-y-3">
                    {brief.scenarioComparisons.map((scenario, index) => (
                      <article key={`${scenario.createdAt}:${index}`} className="p-3 border border-[#E4E1D8] rounded-[4px]">
                        <p className="font-semibold text-sm text-[#14171F]">{scenario.prompt}</p>
                        <ul className="mt-2 space-y-1 text-xs text-[#525866]">
                          {scenario.claims.map((claim) => (
                            <li key={`${claim.sourcePage ?? 0}:${claim.label}:${claim.text}`}>
                              <span className="font-mono-legal font-semibold">{claim.label.replaceAll("_", " ")}:</span> {claim.text}
                            </li>
                          ))}
                        </ul>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Mandatory Epistemic Honesty Disclaimer & Audit Footer (FR-6.3) */}
          <div className="mt-10 p-3.5 bg-[#FAF9F6] border border-[#E4E1D8] rounded-[4px] text-xs font-serif-legal text-[#525866] italic text-center select-none">
            {brief.disclaimer || "This brief was generated by Certus. All AI_INFERENCE and UNVERIFIED items require independent legal review."}
          </div>

          <div className="mt-6 pt-4 border-t border-[#E4E1D8] text-[10px] text-[#868C98] font-mono-legal flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 select-none">
            <div>
              <span className="font-bold text-[#14171F] block">
                CERTUS PROOF MODE™ · DETERMINISTIC CITATION GATE AUDIT TRAIL
              </span>
              <span>All contractual assertions gated against OCR token registry.</span>
            </div>
            <div className="text-left sm:text-right max-w-full sm:max-w-[45%] break-all">
              <span>Content SHA-256: {brief.contentHash}</span>
              <span className="block text-[#868C98]">
                VERIFIED: {brief.stats?.verifiedCount ?? 0} · FLAGGED: {brief.stats?.flaggedCount ?? 0} · RATE: {brief.stats?.verificationRate ?? 0}%
              </span>
            </div>
          </div>
        </div>
      </main>

    </div>
  );
}
