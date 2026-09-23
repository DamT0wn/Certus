import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { askQuestion, getDocument, runWhatIf } from "../api/client";
import type { Claim, LegalDocumentData } from "../api/client";
import { AppHeader } from "../components/AppHeader";
import { DocumentViewer } from "../components/DocumentViewer";
import { ProofIntelligencePanel } from "../components/ProofIntelligencePanel";
import { ClaimCard } from "../components/ClaimCard";
import { CommandPalette } from "../components/CommandPalette";
import { KeyboardShortcutsModal } from "../components/KeyboardShortcutsModal";
import {
  FileText,
  ArrowRight,
  Layers,
  ChevronLeft,
} from "lucide-react";

export function DocumentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [docInfo, setDocInfo] = useState<LegalDocumentData | null>(null);
  const [facts, setFacts] = useState<Claim[]>([]);

  const [thread, setThread] = useState<{ question: string; claims: Claim[] }[]>([]);
  const [loading, setLoading] = useState(false);

  // Active navigation & view state
  const [activePage, setActivePage] = useState<number>(1);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [filterType, setFilterType] = useState<"ALL" | "DOCUMENT_FACT" | "VERIFIED_LAW" | "AI_INFERENCE" | "UNVERIFIED">("ALL");

  // Mobile / responsive view toggle: "evidence" | "viewer" | "intelligence"
  const [activeMobileTab, setActiveMobileTab] = useState<"evidence" | "viewer" | "intelligence">("viewer");

  // Modals
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    getDocument(id)
      .then((data) => {
        setDocInfo(data.document);
        setFacts(data.facts || []);
        if (data.facts?.length > 0) {
          setSelectedClaim(data.facts[0]);
          if (data.facts[0].sourcePage) {
            setActivePage(data.facts[0].sourcePage);
          }
        }
      })
      .catch((err) => {
        console.error("Failed to load document:", err);
      });
  }, [id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
      if (e.key === "?" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) {
        setIsShortcutsOpen((prev) => !prev);
      }
      if (e.key.toLowerCase() === "b" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) {
        if (id) navigate(`/document/${id}/brief`);
      }
      if (["1", "2", "3"].includes(e.key) && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) {
        setActivePage(parseInt(e.key, 10));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [id, navigate]);

  async function handleAsk(questionText: string) {
    if (!id || !questionText.trim()) return;
    setLoading(true);
    try {
      const claims = await askQuestion(id, questionText);
      setThread((t) => [...t, { question: questionText, claims }]);
      if (claims.length > 0 && claims[0].sourcePage) {
        setActivePage(claims[0].sourcePage);
        setSelectedClaim(claims[0]);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleScenario(prompt: string, label: string) {
    if (!id) return;
    setLoading(true);
    try {
      const claims = await runWhatIf(id, prompt);
      setThread((t) => [...t, { question: `Scenario: ${label}`, claims }]);
      if (claims.length > 0 && claims[0].sourcePage) {
        setActivePage(claims[0].sourcePage);
        setSelectedClaim(claims[0]);
      }
    } finally {
      setLoading(false);
    }
  }

  const handleCitationJump = (page: number, text?: string) => {
    setActivePage(page);
    if (text) {
      const matched = facts.find((f) => f.sourceText === text);
      if (matched) setSelectedClaim(matched);
    }
    setActiveMobileTab("viewer");
  };

  const handleClaimSelect = (claim: Claim) => {
    setSelectedClaim(claim);
    if (claim.sourcePage) {
      setActivePage(claim.sourcePage);
    }
  };

  const filteredFacts = facts.filter((f) => {
    if (filterType === "ALL") return true;
    return f.label === filterType;
  });

  const factCount = facts.filter((f) => f.label === "DOCUMENT_FACT").length;
  const lawCount = facts.filter((f) => f.label === "VERIFIED_LAW").length;
  const inferenceCount = facts.filter((f) => f.label === "AI_INFERENCE").length;
  const unverifiedCount = facts.filter((f) => f.label === "UNVERIFIED").length;

  return (
    <div className="flex flex-col h-screen bg-[#FAF9F6] text-[#14171F] overflow-hidden select-none font-sans-ui">
      {/* Global Application Header */}
      <AppHeader
        documentId={id}
        documentName={docInfo?.filename}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
      />

      {/* Workspace Context Bar */}
      <div className="h-12 bg-[#FFFFFF] border-b border-[#E4E1D8] px-6 flex items-center justify-between shrink-0 z-20">
        {/* Left: Document Identity & Metrics Pill */}
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-1 text-xs font-mono-legal text-[#525866] hover:text-[#14171F] bg-[#FAF9F6] hover:bg-[#FFFFFF] border border-[#E4E1D8] px-2 py-1 rounded-[4px] transition-certus"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Intake</span>
          </Link>

          <div className="h-4 w-px bg-[#E4E1D8]" />

          <div className="flex items-center gap-2">
            <span className="font-serif-display font-semibold text-[#14171F] text-[14px] tracking-tight truncate max-w-xs sm:max-w-sm">
              {docInfo?.filename || "Executive_Employment_Agreement.pdf"}
            </span>

            {/* Document Metrics Pill */}
            <div className="hidden md:flex items-center gap-2 bg-[#FAF9F6] px-2.5 py-0.5 rounded-[4px] border border-[#E4E1D8] text-[11px] font-mono-legal text-[#525866]">
              <span className="flex items-center gap-1 text-[#2F5233] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2F5233]" />
                {facts.length} Claims
              </span>
              <span>·</span>
              <span className="text-[#525866]">3 Issues</span>
              <span>·</span>
              <span className="text-[#8C3A3A] font-semibold">{unverifiedCount} Review Flags</span>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Mobile Tab Switcher */}
          <div className="flex lg:hidden bg-[#FAF9F6] p-0.5 rounded-[4px] border border-[#E4E1D8] text-xs">
            <button
              onClick={() => setActiveMobileTab("evidence")}
              className={`px-2.5 py-1 rounded-[3px] font-medium transition-certus ${
                activeMobileTab === "evidence"
                  ? "bg-[#FFFFFF] text-[#1B2A4A] font-bold shadow-2xs"
                  : "text-[#525866]"
              }`}
            >
              Evidence
            </button>
            <button
              onClick={() => setActiveMobileTab("viewer")}
              className={`px-2.5 py-1 rounded-[3px] font-medium transition-certus ${
                activeMobileTab === "viewer"
                  ? "bg-[#FFFFFF] text-[#1B2A4A] font-bold shadow-2xs"
                  : "text-[#525866]"
              }`}
            >
              Document
            </button>
            <button
              onClick={() => setActiveMobileTab("intelligence")}
              className={`px-2.5 py-1 rounded-[3px] font-medium transition-certus ${
                activeMobileTab === "intelligence"
                  ? "bg-[#FFFFFF] text-[#1B2A4A] font-bold shadow-2xs"
                  : "text-[#525866]"
              }`}
            >
              Proof Intel
            </button>
          </div>

          <Link
            to={`/document/${id}/brief`}
            className="flex items-center gap-1.5 bg-[#1B2A4A] hover:bg-[#111B30] text-[#FAF9F6] text-xs font-semibold px-3 py-1.5 rounded-[5px] transition-certus shadow-2xs font-sans-ui border border-[#1B2A4A]"
            title="Generate Lawyer-Ready Brief (B)"
          >
            <FileText className="w-3.5 h-3.5 text-[#B08D57]" />
            <span>Generate Brief</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* 3-Panel Main Workspace */}
      <main id="main-content" role="main" aria-label="Document Analysis Workspace" className="flex-1 flex overflow-hidden">
        {/* PANEL 1 (LEFT): Evidence Feed (27% desktop) */}
        <div
          className={`${
            activeMobileTab === "evidence" ? "flex" : "hidden"
          } lg:flex flex-col w-full lg:w-[28%] xl:w-[26%] bg-[#FAF9F6] border-r border-[#E4E1D8] overflow-hidden shrink-0 select-text`}
        >
          {/* Evidence Panel Header */}
          <div className="h-11 border-b border-[#E4E1D8] px-4 flex items-center justify-between bg-[#FFFFFF] shrink-0">
            <div className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-[#B08D57]" />
              <h2 className="font-mono-legal font-semibold text-[11px] tracking-wider text-[#14171F] uppercase">
                Evidence Feed
              </h2>
            </div>
            <span className="text-[10px] font-mono-legal font-semibold bg-[#FAF9F6] text-[#1B2A4A] px-2 py-0.5 rounded-[3px] border border-[#E4E1D8]">
              {filteredFacts.length} / {facts.length}
            </span>
          </div>

          {/* Evidence Filter Bar */}
          <div className="p-2 bg-[#FFFFFF] border-b border-[#E4E1D8] flex items-center gap-1 overflow-x-auto text-[10.5px] font-mono-legal custom-scrollbar">
            <button
              onClick={() => setFilterType("ALL")}
              className={`px-2 py-1 rounded-[3px] transition-certus shrink-0 uppercase tracking-wider ${
                filterType === "ALL"
                  ? "bg-[#1B2A4A] text-[#FAF9F6] font-bold"
                  : "text-[#525866] hover:bg-[#FAF9F6]"
              }`}
            >
              All ({facts.length})
            </button>
            <button
              onClick={() => setFilterType("DOCUMENT_FACT")}
              className={`px-2 py-1 rounded-[3px] transition-certus shrink-0 uppercase tracking-wider ${
                filterType === "DOCUMENT_FACT"
                  ? "bg-[#2F5233]/10 text-[#2F5233] font-bold border border-[#2F5233]/40"
                  : "text-[#525866] hover:bg-[#FAF9F6]"
              }`}
            >
              Facts ({factCount})
            </button>
            <button
              onClick={() => setFilterType("VERIFIED_LAW")}
              className={`px-2 py-1 rounded-[3px] transition-certus shrink-0 uppercase tracking-wider ${
                filterType === "VERIFIED_LAW"
                  ? "bg-[#1F3B23]/10 text-[#1F3B23] font-bold border border-[#1F3B23]/40"
                  : "text-[#525866] hover:bg-[#FAF9F6]"
              }`}
            >
              Law ({lawCount})
            </button>
            <button
              onClick={() => setFilterType("AI_INFERENCE")}
              className={`px-2 py-1 rounded-[3px] transition-certus shrink-0 uppercase tracking-wider ${
                filterType === "AI_INFERENCE"
                  ? "bg-[#8A6D3B]/10 text-[#8A6D3B] font-bold border border-[#8A6D3B]/40"
                  : "text-[#525866] hover:bg-[#FAF9F6]"
              }`}
            >
              Inferences ({inferenceCount})
            </button>
            <button
              onClick={() => setFilterType("UNVERIFIED")}
              className={`px-2 py-1 rounded-[3px] transition-certus shrink-0 uppercase tracking-wider ${
                filterType === "UNVERIFIED"
                  ? "bg-[#8C3A3A]/10 text-[#8C3A3A] font-bold border border-[#8C3A3A]/40"
                  : "text-[#525866] hover:bg-[#FAF9F6]"
              }`}
            >
              Unverified ({unverifiedCount})
            </button>
          </div>

          {/* Claims List */}
          <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
            {filteredFacts.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#868C98] font-sans-ui">
                No claims match the active filter criteria.
              </div>
            ) : (
              filteredFacts.map((claim, idx) => (
                <ClaimCard
                  key={idx}
                  claim={claim}
                  isSelected={selectedClaim?.text === claim.text}
                  onSelect={() => handleClaimSelect(claim)}
                  onCitationClick={handleCitationJump}
                  showProofChain={true}
                />
              ))
            )}
          </div>
        </div>

        {/* PANEL 2 (CENTER): Document Viewer with Hero Elevation (44% desktop) */}
        <div
          className={`${
            activeMobileTab === "viewer" ? "flex" : "hidden"
          } lg:flex flex-col flex-1 overflow-hidden`}
        >
          <DocumentViewer
            filename={docInfo?.filename || "Executive_Employment_Agreement.pdf"}
            ocrPages={docInfo?.ocrPages || []}
            activePage={activePage}
            selectedClaim={selectedClaim}
            claims={facts}
            onPageChange={setActivePage}
            onSentenceClick={(claim) => {
              setSelectedClaim(claim);
              setActiveMobileTab("intelligence");
            }}
          />
        </div>

        {/* PANEL 3 (RIGHT): Proof Intelligence & Scenario Panel (29% desktop) */}
        <div
          className={`${
            activeMobileTab === "intelligence" ? "flex" : "hidden"
          } lg:flex flex-col w-full lg:w-[30%] xl:w-[28%] bg-[#FFFFFF] shrink-0 overflow-hidden`}
        >
          <ProofIntelligencePanel
            loading={loading}
            thread={thread}
            onAsk={handleAsk}
            onScenario={handleScenario}
            onCitationClick={handleCitationJump}
          />
        </div>
      </main>

      {/* Global Command Palette (⌘K) */}
      <CommandPalette
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        claims={facts}
        onSelectClaim={(claim) => {
          setSelectedClaim(claim);
          if (claim.sourcePage) setActivePage(claim.sourcePage);
        }}
        onSelectAction={(actionId) => {
          if (actionId === "generate_brief") {
            if (id) navigate(`/document/${id}/brief`);
          } else if (actionId === "jump_p1") setActivePage(1);
          else if (actionId === "jump_p2") setActivePage(2);
          else if (actionId === "jump_p3") setActivePage(3);
          else if (actionId === "scenario_resignation") {
            handleScenario(
              "The party wants to resign/exit early, before any notice period ends.",
              "Early resignation"
            );
          } else if (actionId === "scenario_breach") {
            handleScenario(
              "One party breaches a key obligation in this document.",
              "Breach of a key clause"
            );
          }
        }}
      />

      {/* Keyboard Shortcuts Modal (?) */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
}
