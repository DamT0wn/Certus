interface CertusLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  subtitle?: boolean;
}

export function CertusLogo({
  className = "",
  size = "md",
  showText = true,
  subtitle = true,
}: CertusLogoProps) {
  const iconSizes = {
    sm: "w-7 h-7",
    md: "w-8 h-8",
    lg: "w-10 h-10",
  };

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Precision Forged Navy & Brass Geometric Verification Seal */}
      <div
        className={`${iconSizes[size]} relative rounded-md bg-[#1B2A4A] flex items-center justify-center text-white shadow-2xs border border-[#2B3E68] overflow-hidden shrink-0`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full p-1.5"
        >
          {/* Subtle Outer Concentric Seal Ring */}
          <circle
            cx="16"
            cy="16"
            r="12.5"
            stroke="#B08D57"
            strokeWidth="0.85"
            strokeOpacity="0.45"
            strokeDasharray="1.5 2"
          />

          {/* Inner Grounding Circle */}
          <circle cx="16" cy="16" r="9.5" stroke="#B08D57" strokeWidth="1" strokeOpacity="0.85" />

          {/* Architectural Certus 'C' Path */}
          <path
            d="M20.5 11.8C19.4 10.4 17.6 9.5 15.4 9.5C11.8 9.5 8.9 12.4 8.9 16C8.9 19.6 11.8 22.5 15.4 22.5C17.6 22.5 19.4 21.6 20.5 20.2"
            stroke="#FAF9F6"
            strokeWidth="2.2"
            strokeLinecap="round"
          />

          {/* Verification Anchor Node in Signature Muted Brass */}
          <circle cx="20.5" cy="16" r="2.2" fill="#B08D57" />
          <circle cx="20.5" cy="16" r="0.9" fill="#1B2A4A" />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-serif-display font-semibold tracking-tight text-[#14171F] text-[18px] leading-none">
              CERTUS
            </span>
            <span className="text-[9px] font-mono-legal font-semibold tracking-wider text-[var(--certus-brass-dark)] bg-[var(--certus-brass-light)] px-2 py-0.5 rounded-full border border-[var(--certus-brass-border)] uppercase">
              PROOFS
            </span>
          </div>
          {subtitle && (
            <span className="text-[11px] font-sans-ui text-[#525866] tracking-tight leading-tight mt-0.5">
              Legal Intelligence Workstation
            </span>
          )}
        </div>
      )}
    </div>
  );
}
