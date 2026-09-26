import { useState, useEffect, useRef, type ReactNode } from "react";
import { ZoomIn, ZoomOut, Search, Sparkles, FileCheck, Bookmark } from "lucide-react";
import type { Claim } from "../api/client";

interface DocumentViewerProps {
  filename: string;
  ocrPages: { pageNumber: number; text: string }[];
  activePage: number | null;
  selectedClaim: Claim | null;
  claims: Claim[];
  onPageChange: (page: number) => void;
  onSentenceClick?: (claim: Claim) => void;
}

export function DocumentViewer({
  filename,
  ocrPages = [],
  activePage,
  selectedClaim,
  claims = [],
  onPageChange,
  onSentenceClick,
}: DocumentViewerProps) {
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAnnotations, setShowAnnotations] = useState(true);
  const pageRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const containerRef = useRef<HTMLDivElement>(null);

  const displayPages = ocrPages;

  useEffect(() => {
    if (activePage && pageRefs.current[activePage]) {
      pageRefs.current[activePage]?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [activePage, selectedClaim]);

  const handleZoom = (delta: number) => {
    setZoomLevel((prev) => Math.min(140, Math.max(80, prev + delta)));
  };

  const getClaimsForPage = (pageNumber: number) => {
    return claims.filter((c) => c.sourcePage === pageNumber);
  };

  const renderFormattedParagraphs = (pageText: string, pageNumber: number) => {
    const paragraphs = pageText.split("\n\n").filter(Boolean);
    const pageClaims = getClaimsForPage(pageNumber);

    return paragraphs.map((para, pIdx) => {
      const isSearchMatch =
        searchQuery.trim().length > 1 &&
        para.toLowerCase().includes(searchQuery.toLowerCase());

      let highlightedElements: ReactNode = para;

      if (showAnnotations && pageClaims.length > 0) {
        for (const claim of pageClaims) {
          if (!claim.sourceText) continue;

          const cleanSource = claim.sourceText.trim();
          if (cleanSource.length > 10 && para.includes(cleanSource)) {
            const isTarget = selectedClaim?.sourceText === claim.sourceText;
            const parts = para.split(cleanSource);

            let highlightClass = "citation-highlight-fact";
            if (claim.label === "AI_INFERENCE") highlightClass = "citation-highlight-inference";
            else if (claim.label === "VERIFIED_LAW") highlightClass = "citation-highlight-law";
            else if (claim.label === "UNVERIFIED") highlightClass = "citation-highlight-unverified";

            highlightedElements = (
              <span>
                {parts[0]}
                <mark
                  onClick={() => onSentenceClick && onSentenceClick(claim)}
                  className={`${highlightClass} ${
                    isTarget ? "active font-medium" : ""
                  } cursor-pointer transition-certus inline`}
                  title={`Grounded Citation: ${claim.label} — click to view claim`}
                >
                  {cleanSource}
                  {/* Refined Superscript Brass Footnote Marker */}
                  <sup className="citation-superscript-marker select-none">
                    [§]
                  </sup>
                </mark>
                {parts.slice(1).join(cleanSource)}
              </span>
            );
            break;
          }
        }
      }

      const isHeading =
        para.startsWith("EXECUTIVE EMPLOYMENT") ||
        para.startsWith("1.") ||
        para.startsWith("2.") ||
        para.startsWith("3.") ||
        para.startsWith("4.") ||
        para.startsWith("5.") ||
        para.startsWith("6.");

      return (
        <div
          key={pIdx}
          className={`mb-4.5 text-[14px] leading-[1.72] text-[#14171F] ${
            isHeading ? "font-serif-display font-semibold text-[#14171F] mt-5 tracking-tight" : "font-serif-legal"
          } ${isSearchMatch ? "bg-[#B08D57]/15 p-1 rounded-[2px]" : ""}`}
        >
          {highlightedElements}
        </div>
      );
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#FAF9F6] border-r border-[#E4E1D8] overflow-hidden select-text">
      {/* Top Document Workspace Toolbar */}
      <div className="viewer-toolbar bg-[#FFFFFF] border-b border-[#E4E1D8] px-4 flex items-center justify-between shrink-0 select-none">
        {/* Left: Document Name & Page Nav */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-sans-ui text-[#14171F]">
            <Bookmark className="w-3.5 h-3.5 text-[#B08D57]" />
            <span className="font-semibold max-w-[200px] truncate" title={filename}>
              {filename || "Contract_Document.pdf"}
            </span>
          </div>

          <div className="h-4 w-px bg-[#E4E1D8]" />

          {/* Quick Page Jumper */}
          <div className="flex items-center gap-1 bg-[#FAF9F6] p-0.5 rounded-[4px] border border-[#E4E1D8] text-xs">
            {displayPages.map((p) => (
              <button
                key={p.pageNumber}
                onClick={() => {
                  onPageChange(p.pageNumber);
                  pageRefs.current[p.pageNumber]?.scrollIntoView({ behavior: "smooth" });
                }}
                className={`px-2 py-0.5 rounded-[3px] text-[10.5px] font-mono-legal transition-certus ${
                  activePage === p.pageNumber
                    ? "bg-[#FFFFFF] text-[#1B2A4A] font-bold border border-[#E4E1D8] shadow-2xs"
                    : "text-[#525866] hover:text-[#14171F]"
                }`}
              >
                P.{p.pageNumber}
              </button>
            ))}
          </div>
        </div>

        {/* Center: Search within Document */}
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-[#868C98] absolute left-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search document text..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-48 pl-8 pr-2 py-1 text-xs font-sans-ui bg-[#FAF9F6] border border-[#E4E1D8] rounded-[4px] focus:outline-hidden focus:border-[#B08D57] focus:bg-[#FFFFFF] transition-certus text-[#14171F]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 text-[10px] text-[#868C98] hover:text-[#14171F]"
            >
              ×
            </button>
          )}
        </div>

        {/* Right: Evidence Overlay & Zoom Controls */}
        <div className="flex items-center gap-2">
          {/* Evidence Focus Toggle */}
          <button
            onClick={() => setShowAnnotations(!showAnnotations)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-[4px] text-[11px] font-mono-legal transition-certus border ${
              showAnnotations
                ? "bg-[#FAF9F6] border-[#B08D57] text-[#91703E]"
                : "bg-[#FFFFFF] border-[#E4E1D8] text-[#868C98] hover:bg-[#FAF9F6]"
            }`}
            title="Toggle Evidence Highlights"
          >
            <Sparkles className="w-3 h-3 text-[#B08D57]" />
            <span>Highlights {showAnnotations ? "ON" : "OFF"}</span>
          </button>

          <div className="h-4 w-px bg-[#E4E1D8] mx-0.5" />

          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-[#FAF9F6] p-0.5 rounded-[4px] border border-[#E4E1D8] text-xs">
            <button
              onClick={() => handleZoom(-10)}
              disabled={zoomLevel <= 80}
              className="p-1 rounded hover:bg-[#FFFFFF] text-[#525866] disabled:opacity-30 transition-certus"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10.5px] font-mono-legal text-[#525866] px-1 select-none">
              {zoomLevel}%
            </span>
            <button
              onClick={() => handleZoom(10)}
              disabled={zoomLevel >= 130}
              className="p-1 rounded hover:bg-[#FFFFFF] text-[#525866] disabled:opacity-30 transition-certus"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomLevel(100)}
              className="px-1.5 py-0.5 text-[10px] font-mono-legal text-[#525866] hover:text-[#14171F]"
              title="Fit standard width"
            >
              Fit
            </button>
          </div>
        </div>
      </div>

      {/* Main Legal Paper Canvas Area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-3 sm:p-6 legal-canvas-pattern custom-scrollbar flex flex-col items-center gap-10"
      >
        {displayPages.length === 0 && <p role="status" className="p-6 text-sm">No parsed pages available.</p>}
        {displayPages.map((page) => {
          const isCurrentActive = activePage === page.pageNumber;
          const pageClaims = getClaimsForPage(page.pageNumber);

          return (
            <div
              key={page.pageNumber}
              ref={(el) => {
                pageRefs.current[page.pageNumber] = el;
              }}
              style={{
                width: `${Math.round(740 * (zoomLevel / 100))}px`,
                minHeight: `${Math.round(980 * (zoomLevel / 100))}px`,
              }}
              className={`legal-document-sheet relative bg-[#FFFFFF] p-14 transition-certus ${
                isCurrentActive
                  ? "ring-1 ring-[#1B2A4A] shadow-md"
                  : "hover:shadow-sm"
              }`}
            >
              {/* Top Legal Document Header & Watermark */}
              <div className="flex items-center justify-between pb-4 mb-8 border-b border-[#E4E1D8] text-[10.5px] text-[#868C98] font-mono-legal select-none">
                <span className="tracking-wider uppercase font-medium">
                  CERTUS REPOSITORY · EVIDENCE AUDIT
                </span>
                <span>
                  PAGE {page.pageNumber} OF {displayPages.length}
                </span>
              </div>

              {/* Page Grounding Indicator Badge */}
              {pageClaims.length > 0 && (
                <div className="mb-4 w-fit bg-[#FAF9F6] border border-[#E4E1D8] text-[#1B2A4A] px-2 py-0.5 rounded-[3px] text-[10px] font-mono-legal flex items-center gap-1 shadow-2xs select-none">
                  <FileCheck className="w-3 h-3 text-[#B08D57]" />
                  <span>{pageClaims.length} CITED CLAIMS</span>
                </div>
              )}

              {/* Legal Text Content Body */}
              <div className="prose prose-slate max-w-none">
                {renderFormattedParagraphs(page.text, page.pageNumber)}
              </div>

              {/* Bottom Paper Footer */}
              <div className="absolute bottom-4 left-5 right-5 flex-wrap gap-2 pt-3 border-t border-[#EDEAE2] flex items-center justify-between text-[9.5px] text-[#868C98] font-mono-legal select-none">
                <span>{filename}</span>
                <span>PROOF MODE™ · DETERMINISTIC CITATION GATE</span>
                <span>ATTORNEY WORK PRODUCT</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
