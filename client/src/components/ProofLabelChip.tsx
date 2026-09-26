import type { ProofLabel } from "../api/client";
import { CheckCircle2, Scale, Sparkles, AlertTriangle } from "lucide-react";

interface ProofBadgeProps {
  label: ProofLabel;
  reason?: string;
  confidence?: number;
  size?: "sm" | "md";
  showIcon?: boolean;
}

const BADGE_CONFIG: Record<
  ProofLabel,
  {
    text: string;
    shortText: string;
    borderCol: string;
    textCol: string;
    bgCol: string;
    description: string;
    icon: typeof CheckCircle2;
  }
> = {
  DOCUMENT_FACT: {
    text: "DOCUMENT FACT",
    shortText: "FACT",
    borderCol: "border-[var(--certus-forest-border)]",
    textCol: "text-[var(--certus-forest)]",
    bgCol: "bg-[var(--certus-forest-bg)]",
    description: "Verified verbatim against source document OCR stream",
    icon: CheckCircle2,
  },
  VERIFIED_LAW: {
    text: "VERIFIED LAW",
    shortText: "LAW",
    borderCol: "border-[var(--certus-law-border)]",
    textCol: "text-[var(--certus-law)]",
    bgCol: "bg-[var(--certus-law-bg)]",
    description: "Requires independently verified legal authority",
    icon: Scale,
  },
  AI_INFERENCE: {
    text: "AI INFERENCE",
    shortText: "INFERENCE",
    borderCol: "border-[var(--certus-ochre-border)]",
    textCol: "text-[var(--certus-ochre)]",
    bgCol: "bg-[var(--certus-ochre-bg)]",
    description: "Reasoned interpretation requiring human attorney confirmation",
    icon: Sparkles,
  },
  UNVERIFIED: {
    text: "UNVERIFIED",
    shortText: "UNVERIFIED",
    borderCol: "border-[var(--certus-brick-border)]",
    textCol: "text-[var(--certus-brick)]",
    bgCol: "bg-[var(--certus-brick-bg)]",
    description: "Citation gate rejected — ungrounded or absent from source contract",
    icon: AlertTriangle,
  },
};

export function ProofBadge({
  label,
  reason,
  confidence,
  size = "md",
  showIcon = true,
}: ProofBadgeProps) {
  const cfg = BADGE_CONFIG[label] || BADGE_CONFIG.UNVERIFIED;
  const tooltip = reason ? `${cfg.description} • ${reason}` : cfg.description;
  const IconComponent = cfg.icon;

  const accessibleLabel = `${cfg.text}: ${cfg.description}${
    confidence !== undefined ? ` with ${Math.round(confidence * 100)} percent confidence` : ""
  }`;

  return (
    <span
      role="status"
      aria-label={accessibleLabel}
      title={tooltip}
      className={`inline-flex items-center gap-1.5 font-mono font-semibold tracking-wider uppercase rounded border ${
        cfg.borderCol
      } ${cfg.textCol} ${cfg.bgCol} select-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
        size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-[11px] px-2 py-0.75"
      }`}
    >
      {showIcon && (
        <IconComponent
          aria-hidden="true"
          className={size === "sm" ? "w-3 h-3 shrink-0" : "w-3.5 h-3.5 shrink-0"}
        />
      )}
      <span>{cfg.text}</span>
      {confidence !== undefined && (
        <span
          aria-hidden="true"
          className="opacity-75 text-[9.5px] font-mono ml-0.5 font-normal"
        >
          {Math.round(confidence * 100)}%
        </span>
      )}
    </span>
  );
}

// Backward-compatibility export
export function ProofLabelChip({
  label,
  reason,
}: {
  label: ProofLabel;
  reason?: string;
}) {
  return <ProofBadge label={label} reason={reason} />;
}
