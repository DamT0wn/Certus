import type { MouseEvent } from "react";
import type { Claim } from "../api/client";
import { ProofBadge } from "./ProofLabelChip";
import { ProofChain } from "./ProofChain";
import { ArrowUpRight, ShieldCheck, AlertCircle } from "lucide-react";

interface ClaimCardProps {
  claim: Claim;
  isSelected?: boolean;
  onSelect?: () => void;
  onCitationClick?: (page: number, text?: string) => void;
  showProofChain?: boolean;
}

export function ClaimCard({
  claim,
  isSelected = false,
  onSelect,
  onCitationClick,
  showProofChain = true,
}: ClaimCardProps) {
  const isUnverified = claim.label === "UNVERIFIED";
  const isLaw = claim.label === "VERIFIED_LAW";

  const handleCitationClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (claim.sourcePage && onCitationClick) {
      onCitationClick(claim.sourcePage, claim.sourceText || undefined);
    }
  };

  return (
    <div
      onClick={onSelect}
      className={`group relative rounded-[6px] transition-certus border cursor-pointer ${
        isSelected
          ? "bg-[#FFFFFF] border-[#1B2A4A] shadow-xs"
          : "bg-[#FFFFFF] border-[#E4E1D8] hover:border-[#B08D57]/70"
      } p-3.5 mb-2`}
    >
      {/* Active Left Rail: Deep Forged Navy / Brass Accent */}
      {isSelected && (
        <div className="absolute left-0 top-2 bottom-2 w-[3px] bg-[#1B2A4A] rounded-r-xs" />
      )}

      {/* Header: Evidence badge & Citation indicator */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <ProofBadge
            label={claim.label}
            reason={claim.verification?.reason}
            confidence={claim.verification?.confidence}
            size="sm"
          />
          {claim.verification?.verified && !isUnverified && (
            <span
              title="Verified by deterministic citation gate"
              className="inline-flex items-center text-[10px] font-mono-legal text-[var(--certus-forest)] bg-[var(--certus-forest)]/[0.06] px-1.5 py-0.5 rounded-[3px] border border-[var(--certus-forest)]/30"
            >
              <ShieldCheck className="w-2.5 h-2.5 mr-1 text-[var(--certus-forest)]" />
              Verified
            </span>
          )}
          {isUnverified && (
            <span
              title="Citation gate rejected: statement could not be grounded in source text"
              className="inline-flex items-center text-[10px] font-mono-legal text-[var(--certus-brick)] bg-[var(--certus-brick)]/[0.06] px-1.5 py-0.5 rounded-[3px] border border-[var(--certus-brick)]/30"
            >
              <AlertCircle className="w-2.5 h-2.5 mr-1 text-[var(--certus-brick)]" />
              Gate Reject
            </span>
          )}
        </div>

        {claim.sourcePage ? (
          <button
            type="button"
            onClick={handleCitationClick}
            className="inline-flex items-center gap-1 text-[10.5px] font-mono-legal font-medium text-[#525866] hover:text-[#B08D57] hover:bg-[#FAF9F6] px-1.5 py-0.5 rounded-[3px] border border-[#E4E1D8] hover:border-[#B08D57] transition-certus select-none"
            title={`Focus citation on Page ${claim.sourcePage}`}
          >
            <span>P.{String(claim.sourcePage).padStart(2, "0")}</span>
            <ArrowUpRight className="w-3 h-3 text-[#868C98] group-hover:text-[#B08D57] transition-certus" />
          </button>
        ) : (
          <span className="text-[10px] font-mono-legal text-[#868C98]">Doctrine</span>
        )}
      </div>

      {/* Claim Body Text */}
      <p className="text-[13px] leading-snug font-sans-ui text-[#14171F] font-normal">
        {claim.text}
      </p>

      {/* Quoted Legal Source Text with Muted Brass Left Rule */}
      {claim.sourceText ? (
        <div className="mt-2.5 pt-2 border-t border-[#EDEAE2]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9.5px] font-mono-legal font-semibold tracking-wider text-[#868C98] uppercase">
              VERBATIM SOURCE TEXT
            </span>
            {claim.sourcePage && (
              <span className="text-[9.5px] font-mono-legal text-[#868C98]">
                Page {claim.sourcePage}
              </span>
            )}
          </div>
          <blockquote className="text-[12.5px] font-serif-legal italic text-[#2A2F3D] border-l-2 border-[#B08D57] pl-2.5 py-0.5 bg-[#FAF9F6] rounded-r-[3px] leading-relaxed">
            "{claim.sourceText}"
          </blockquote>
        </div>
      ) : isLaw ? (
        <div className="mt-2 text-[11px] font-serif-legal italic text-[var(--certus-law)] bg-[var(--certus-law-bg)] p-2 rounded-[4px] border border-[var(--certus-law-border)]">
          External legal authority requires an independently checked source.
        </div>
      ) : null}

      {/* Signature Proof Chain Expandable */}
      {showProofChain && <ProofChain claim={claim} defaultExpanded={false} />}
    </div>
  );
}
