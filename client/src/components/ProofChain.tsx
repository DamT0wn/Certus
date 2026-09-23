import { useState } from "react";
import { ChevronDown, ChevronUp, FileText, Scale, Cpu, UserCheck, ShieldCheck } from "lucide-react";
import type { Claim } from "../api/client";

interface ProofChainProps {
  claim: Claim;
  defaultExpanded?: boolean;
}

export function ProofChain({ claim, defaultExpanded = false }: ProofChainProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const isFact = claim.label === "DOCUMENT_FACT";
  const isLaw = claim.label === "VERIFIED_LAW";
  const isInference = claim.label === "AI_INFERENCE";
  const isUnverified = claim.label === "UNVERIFIED";

  return (
    <div className="mt-2.5 rounded-[4px] border border-[#E4E1D8] bg-[#FAF9F6] overflow-hidden text-xs transition-certus">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[#F2EFE9] text-[#14171F] transition-certus select-none"
      >
        <div className="flex items-center gap-2">
          {/* Subtle Brass Seal Indicator */}
          <div className="w-3.5 h-3.5 rounded-[3px] bg-[#1B2A4A] text-[#B08D57] flex items-center justify-center text-[9px] font-mono-legal font-bold">
            §
          </div>
          <span className="font-mono-legal font-semibold text-[10.5px] tracking-wider text-[#14171F] uppercase">
            PROOF CHAIN™
          </span>
          <span className="text-[10px] text-[#525866] font-sans-ui">
            {isFact ? "Document-anchored Fact" : isInference ? "Grounded AI Inference" : isLaw ? "Legal Doctrine Authority" : "Citation Gate Reject"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[#868C98]">
          <span className="text-[9.5px] uppercase font-mono-legal tracking-wider">
            {expanded ? "Close" : "Audit"}
          </span>
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </div>
      </button>

      {expanded && (
        <div className="p-3 border-t border-[#E4E1D8] bg-[#FFFFFF] space-y-2.5 font-sans-ui">
          {/* Step 1: Document Evidence */}
          <div className="flex items-start gap-2.5 relative">
            <div className="flex flex-col items-center">
              <div
                className={`w-4.5 h-4.5 rounded-[3px] flex items-center justify-center shrink-0 ${
                  claim.sourceText
                    ? "bg-[#F2F6F3] text-[#2F5233] border border-[#C2D6C6]"
                    : "bg-[#FAF9F6] text-[#868C98] border border-[#E4E1D8]"
                }`}
              >
                <FileText className="w-2.5 h-2.5" />
              </div>
              <div className="w-px h-6 bg-[#E4E1D8] my-0.5" />
            </div>
            <div className="flex-1 pb-1">
              <div className="flex items-center justify-between">
                <span className="text-[9.5px] font-mono-legal font-semibold text-[#868C98] uppercase tracking-wider">
                  01 · Document Evidence
                </span>
                {claim.sourcePage ? (
                  <span className="text-[9.5px] font-mono-legal text-[#2F5233] bg-[#F2F6F3] px-1.5 py-0.2 rounded-[2px] border border-[#C2D6C6]">
                    Page {claim.sourcePage}
                  </span>
                ) : (
                  <span className="text-[9.5px] font-mono-legal text-[#868C98]">External Doctrine</span>
                )}
              </div>
              {claim.sourceText ? (
                <p className="mt-0.5 text-[11.5px] font-serif-legal italic text-[#2A2F3D] bg-[#FAF9F6] p-1.5 rounded-[3px] border border-[#E4E1D8] leading-relaxed">
                  "{claim.sourceText}"
                </p>
              ) : (
                <p className="mt-0.5 text-[11px] font-sans-ui text-[#868C98] italic">
                  No direct document text cited.
                </p>
              )}
            </div>
          </div>

          {/* Step 2: Deterministic Verification Gate */}
          <div className="flex items-start gap-2.5 relative">
            <div className="flex flex-col items-center">
              <div
                className={`w-4.5 h-4.5 rounded-[3px] flex items-center justify-center shrink-0 ${
                  claim.verification?.verified !== false && !isUnverified
                    ? "bg-[#F2F6F3] text-[#2F5233] border border-[#C2D6C6]"
                    : "bg-[#F9F1F1] text-[#8C3A3A] border border-[#E4C3C3]"
                }`}
              >
                <ShieldCheck className="w-2.5 h-2.5" />
              </div>
              <div className="w-px h-6 bg-[#E4E1D8] my-0.5" />
            </div>
            <div className="flex-1 pb-1">
              <div className="flex items-center justify-between">
                <span className="text-[9.5px] font-mono-legal font-semibold text-[#868C98] uppercase tracking-wider">
                  02 · Deterministic Gate
                </span>
                <span
                  className={`text-[9.5px] font-mono-legal font-semibold px-1.5 py-0.2 rounded-[2px] border ${
                    claim.verification?.verified !== false && !isUnverified
                      ? "bg-[#F2F6F3] text-[#2F5233] border-[#C2D6C6]"
                      : "bg-[#F9F1F1] text-[#8C3A3A] border-[#E4C3C3]"
                  }`}
                >
                  {claim.verification?.verified !== false && !isUnverified ? "PASSED (100% Grounded)" : "FAILED (Unmatched)"}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-[#525866]">
                {claim.verification?.reason ||
                  (isFact
                    ? "Exact substring match confirmed in document OCR stream."
                    : isLaw
                    ? "General legal authority — verified independent doctrine."
                    : isUnverified
                    ? "Citation check failed: source text not found verbatim in contract."
                    : "Text grounded in contractual provision with verified semantic match.")}
              </p>
            </div>
          </div>

          {/* Step 3: Legal Authority & Jurisprudence */}
          <div className="flex items-start gap-2.5 relative">
            <div className="flex flex-col items-center">
              <div className="w-4.5 h-4.5 rounded-[3px] bg-[#FAF9F6] text-[#B08D57] border border-[#E4E1D8] flex items-center justify-center shrink-0">
                <Scale className="w-2.5 h-2.5" />
              </div>
              <div className="w-px h-6 bg-[#E4E1D8] my-0.5" />
            </div>
            <div className="flex-1 pb-1">
              <div className="flex items-center justify-between">
                <span className="text-[9.5px] font-mono-legal font-semibold text-[#868C98] uppercase tracking-wider">
                  03 · Legal Authority
                </span>
                <span className="text-[9.5px] text-[#B08D57] font-mono-legal">Delaware Law</span>
              </div>
              <p className="mt-0.5 text-[11px] text-[#525866]">
                {isLaw
                  ? "Delaware jurisprudence requires reasonable duration and geographic bounds for covenant enforcement."
                  : "Contract interpretation under objective plain meaning doctrine."}
              </p>
            </div>
          </div>

          {/* Step 4: AI Inference / Reasoning */}
          <div className="flex items-start gap-2.5 relative">
            <div className="flex flex-col items-center">
              <div className="w-4.5 h-4.5 rounded-[3px] bg-[#FBF7F0] text-[#8A6D3B] border border-[#E5D5B8] flex items-center justify-center shrink-0">
                <Cpu className="w-2.5 h-2.5" />
              </div>
              <div className="w-px h-6 bg-[#E4E1D8] my-0.5" />
            </div>
            <div className="flex-1 pb-1">
              <div className="flex items-center justify-between">
                <span className="text-[9.5px] font-mono-legal font-semibold text-[#868C98] uppercase tracking-wider">
                  04 · Reasoned Inference
                </span>
                <span className="text-[9.5px] text-[#8A6D3B] font-mono-legal">Structured Output</span>
              </div>
              <p className="mt-0.5 text-[11px] text-[#2A2F3D]">
                {claim.text}
              </p>
            </div>
          </div>

          {/* Step 5: Counsel Review State */}
          <div className="flex items-start gap-2.5">
            <div className="w-4.5 h-4.5 rounded-[3px] bg-[#1B2A4A] text-[#FAF9F6] border border-[#2B3E68] flex items-center justify-center shrink-0">
              <UserCheck className="w-2.5 h-2.5 text-[#B08D57]" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-[9.5px] font-mono-legal font-semibold text-[#868C98] uppercase tracking-wider">
                  05 · Counsel Review State
                </span>
                <span className="text-[9.5px] font-mono-legal bg-[#FAF9F6] text-[#14171F] px-1.5 py-0.2 rounded-[2px] border border-[#E4E1D8]">
                  Work Product
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-[#525866]">
                {isInference || isUnverified
                  ? "Attorney review recommended to confirm enforceability and factual context."
                  : "Material factual clause verified for incorporation into legal memorandum."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
