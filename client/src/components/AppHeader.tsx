import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { CertusLogo } from "./CertusLogo";
import { Search, Shield, HelpCircle, LogOut, ChevronDown } from "lucide-react";

interface AppHeaderProps {
  documentId?: string;
  documentName?: string;
  onOpenSearch?: () => void;
  onOpenShortcuts?: () => void;
  demoToken?: string | null;
  demoName?: string;
  onEndDemo?: () => void;
  onStartDemo?: () => void;
}

export function AppHeader({
  documentId,
  documentName,
  onOpenSearch,
  onOpenShortcuts,
  demoToken,
  demoName,
  onEndDemo,
  onStartDemo,
}: AppHeaderProps) {
  const location = useLocation();
  const [showTrustTooltip, setShowTrustTooltip] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const isAnalysisActive = location.pathname.startsWith("/document/") && !location.pathname.endsWith("/brief");
  const isBriefActive = location.pathname.endsWith("/brief");

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-[#1B2A4A] focus:text-white focus:rounded focus:outline-none focus:ring-2 focus:ring-[#B08D57] font-semibold text-xs"
      >
        Skip to main content
      </a>

      <header
        role="banner"
        className="app-header h-16 bg-[#FFFFFF] border-b border-[#E4E1D8] px-6 flex items-center justify-between z-30 shrink-0 select-none"
      >
        {/* LEFT: Certus Logo & Subtitle */}
        <div className="flex items-center gap-8">
          <Link
            to="/"
            aria-label="Certus Home"
            className="hover:opacity-90 transition-certus focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B2A4A] rounded"
          >
            <CertusLogo size="md" />
          </Link>

          {/* Global Navigation Tabs: Underline indicator instead of filled pill */}
          <nav
            role="navigation"
            aria-label="Main Navigation"
            className="hidden xl:flex items-center gap-6 text-[13px] font-sans-ui h-16"
          >

          <Link
            to="/"
            className={`h-full flex items-center border-b-2 transition-certus ${
              location.pathname === "/"
                ? "border-[#1B2A4A] text-[#14171F] font-semibold"
                : "border-transparent text-[#525866] hover:text-[#14171F]"
            }`}
          >
            Intake &amp; Documents
          </Link>

          {documentId ? (
            <Link
              to={`/document/${documentId}`}
              className={`h-full flex items-center border-b-2 transition-certus ${
                isAnalysisActive
                  ? "border-[#1B2A4A] text-[#14171F] font-semibold"
                  : "border-transparent text-[#525866] hover:text-[#14171F]"
              }`}
            >
              Analysis Workspace
            </Link>
          ) : (
            <span
              className="h-full flex items-center border-b-2 border-transparent text-[#868C98]/60 cursor-not-allowed select-none"
              title="Select or upload a document first"
            >
              Analysis Workspace
            </span>
          )}

          {documentId ? (
            <Link
              to={`/document/${documentId}/brief`}
              className={`h-full flex items-center border-b-2 transition-certus ${
                isBriefActive
                  ? "border-[#B08D57] text-[#14171F] font-semibold"
                  : "border-transparent text-[#525866] hover:text-[#14171F]"
              }`}
            >
              Lawyer-Ready Brief
            </Link>
          ) : (
            <span
              className="h-full flex items-center border-b-2 border-transparent text-[#868C98]/60 cursor-not-allowed select-none"
              title="Generate a brief from an active document"
            >
              Lawyer-Ready Brief
            </span>
          )}
        </nav>
      </div>

      {/* RIGHT: Search, Trust Badge, Shortcuts, Auth */}
      <div className="flex items-center gap-3">
        {documentName && (
          <span className="hidden xl:inline-block text-[11px] font-mono-legal text-[#525866] bg-[#FAF9F6] px-2.5 py-1 rounded-[4px] border border-[#E4E1D8] max-w-[220px] truncate">
            {documentName}
          </span>
        )}

        {/* Global Search Trigger */}
        <button
          onClick={onOpenSearch}
          className="flex items-center gap-2 bg-[#FAF9F6] hover:bg-[#FFFFFF] text-[#525866] hover:text-[#14171F] border border-[#E4E1D8] hover:border-[#B08D57] px-3 py-1.5 rounded-[6px] text-xs transition-certus font-sans-ui"
          title="Search Certus (Ctrl+K or ⌘K)"
        >
          <Search className="w-3.5 h-3.5 text-[#868C98]" />
          <span className="hidden sm:inline">Search claims or commands...</span>
          <kbd className="hidden sm:inline-block px-1.5 py-0.2 bg-[#FFFFFF] border border-[#E4E1D8] rounded font-mono-legal text-[10px] text-[#868C98]">
            ⌘K
          </kbd>
        </button>

        {/* Quiet Trust Indicator with Popover */}
        <div className="relative">
          <button
            type="button"
            onMouseEnter={() => setShowTrustTooltip(true)}
            onMouseLeave={() => setShowTrustTooltip(false)}
            onFocus={() => setShowTrustTooltip(true)}
            onBlur={() => setShowTrustTooltip(false)}
            onClick={() => setShowTrustTooltip((visible) => !visible)}
            aria-expanded={showTrustTooltip}
            aria-describedby={showTrustTooltip ? "proof-mode-description" : undefined}
            className="flex items-center gap-1.5 bg-[#FAF9F6] text-[var(--certus-forest)] border border-[var(--certus-forest-border)] px-2.5 py-1 rounded-[4px] text-xs font-mono-legal font-medium cursor-help transition-certus"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--certus-forest)]" />
            <span className="hidden sm:inline uppercase tracking-wider text-[10.5px]">Proof Mode Active</span>
            <span className="sm:hidden text-[10.5px]">GATED</span>
          </button>

          {showTrustTooltip && (
            <div id="proof-mode-description" role="tooltip" className="absolute right-0 top-9 w-68 p-3.5 bg-[#1B2A4A] text-[#FAF9F6] text-xs rounded-[6px] shadow-xl z-50 border border-[#2B3E68] animate-subtle-fade font-sans-ui">
              <div className="flex items-center gap-1.5 font-serif-display font-semibold text-[#B08D57] mb-1">
                <Shield className="w-3.5 h-3.5 text-[#B08D57]" />
                <span>Deterministic Citation Gate</span>
              </div>
              <p className="text-[11.5px] text-[#E8E6DF] leading-relaxed">
                Claims are deterministically gated against source contract OCR tokens. Unsupported statements are automatically downgraded to <strong className="text-[var(--certus-brick-border)]">UNVERIFIED</strong>.
              </p>
            </div>
          )}
        </div>

        {/* Keyboard shortcut trigger */}
        {onOpenShortcuts && (
          <button
            onClick={onOpenShortcuts}
            className="p-1.5 text-[#868C98] hover:text-[#14171F] hover:bg-[#FAF9F6] rounded-[4px] border border-transparent hover:border-[#E4E1D8] transition-certus"
            title="Keyboard shortcuts (?)"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        )}

        {/* Temporary demo-session menu; this is not user authentication. */}
        {demoToken ? (
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              aria-expanded={showUserMenu}
              aria-haspopup="menu"
              className="flex items-center gap-2 bg-[#FAF9F6] hover:bg-[#FFFFFF] border border-[#E4E1D8] hover:border-[#B08D57] px-2.5 py-1 rounded-[6px] text-xs transition-certus"
            >
              <div className="w-5 h-5 rounded-[4px] bg-[#1B2A4A] text-[#B08D57] flex items-center justify-center text-[10px] font-mono-legal font-bold">
                D
              </div>
              <span className="font-medium text-[#14171F] max-w-[120px] truncate hidden md:inline font-sans-ui">
                {demoName || "Demo session"}
              </span>
              <ChevronDown className="w-3 h-3 text-[#868C98]" />
            </button>

            {showUserMenu && (
              <div role="menu" className="absolute right-0 top-9 w-52 bg-[#FFFFFF] border border-[#E4E1D8] rounded-[6px] shadow-lg py-1 z-50 text-xs animate-subtle-fade font-sans-ui">
                <div className="px-3.5 py-2.5 border-b border-[#E4E1D8]">
                  <div className="font-semibold text-[#14171F] truncate">{demoName || "Demo session"}</div>
                  <div className="text-[10px] font-mono-legal text-[#868C98]">Temporary · no account created</div>
                </div>
                {onEndDemo && (
                  <button
                    role="menuitem"
                    onClick={() => {
                      setShowUserMenu(false);
                      onEndDemo();
                    }}
                    className="w-full text-left px-3.5 py-2 text-[var(--certus-brick)] hover:bg-[var(--certus-brick-bg)] flex items-center gap-2 transition-certus"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>End demo session</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ) : onStartDemo ? (
          <button
            onClick={onStartDemo}
            className="text-xs font-semibold bg-[#1B2A4A] hover:bg-[#111B30] text-white px-3.5 py-1.5 rounded-[6px] transition-certus shadow-2xs font-sans-ui border border-[#1B2A4A]"
          >
            Mock Sign In
          </button>
        ) : null}
      </div>
    </header>
    </>
  );
}
