import { useState } from "react";
import { Send, BookOpen, ShieldAlert, ChevronRight } from "lucide-react";
import type { Claim } from "../api/client";
import { ClaimCard } from "./ClaimCard";

interface IssueScenario {
  id: string;
  num: string;
  label: string;
  prompt: string;
  risk: "High" | "Medium" | "Low";
  summary: string;
  docFinding: string;
  breachImpact: string;
  authority: string;
  openQuestions: string[];
}

const PRECONFIGURED_ISSUES: IssueScenario[] = [
  {
    id: "early_resignation",
    num: "01",
    label: "Early Resignation Trigger",
    prompt: "The party wants to resign/exit early, before any notice period ends.",
    risk: "High",
    summary: "Mandatory 60-day notice requirement with immediate bonus and equity forfeiture penalties.",
    docFinding: "Executive may terminate employment by providing at least sixty (60) days prior written notice. Early resignation without sufficient notice triggers immediate forfeiture of accrued bonuses and unvested equity.",
    breachImpact: "Immediate forfeiture of 25% target annual bonus and 50,000 common stock option shares subject to 4-year vesting schedule.",
    authority: "Delaware courts strictly enforce express conditions precedent to executive compensation and incentive vesting.",
    openQuestions: [
      "Was sufficient written notice delivered to the Board/CTO?",
      "Were any annual bonuses already accrued or finalized?",
      "Did the 1-year equity cliff pass prior to notice delivery?",
    ],
  },
  {
    id: "breach",
    num: "02",
    label: "Material Breach & Cause",
    prompt: "One party breaches a key obligation in this document.",
    risk: "High",
    summary: "Immediate termination for Cause with complete salary severance continuation loss.",
    docFinding: "Material breach constitutes 'Cause' allowing the Company to terminate employment immediately upon written notice.",
    breachImpact: "Discharges the Company's obligation to provide six (6) months of salary severance continuation.",
    authority: "Restatement (Second) of Contracts § 237: A material breach discharges the non-breaching party's remaining contractual duties.",
    openQuestions: [
      "Does the alleged conduct qualify as material breach under Section 5(b)?",
      "Was written notice of breach and opportunity to cure required or provided?",
      "Is binding JAMS arbitration in Wilmington required to resolve the breach?",
    ],
  },
  {
    id: "missed_deadline",
    num: "03",
    label: "Notice Deadline Non-Compliance",
    prompt: "A deadline or notice period specified in this document is missed.",
    risk: "Medium",
    summary: "Time-sensitive written notice compliance and potential waiver issues.",
    docFinding: "All contractual resignation and termination triggers require strict advance written notice.",
    breachImpact: "Late notification delays termination effective date and may prolong restrictive covenant window.",
    authority: "Delaware Chancery Court enforceability standards for strict compliance in executive separation agreements.",
    openQuestions: [
      "Can substantial compliance or constructive notice be argued?",
      "Did the Company suffer material prejudice from the notice timing?",
    ],
  },
];

const SUGGESTED_PROMPTS = [
  "What are the termination obligations?",
  "Which clauses create financial exposure?",
  "Show me potential restrictive covenant conflicts.",
  "What requires immediate attorney review?",
];

interface ProofIntelligencePanelProps {
  loading: boolean;
  thread: { question: string; claims: Claim[] }[];
  onAsk: (question: string) => Promise<void>;
  onScenario: (prompt: string, label: string) => Promise<void>;
  onCitationClick?: (page: number, text?: string) => void;
}

export function ProofIntelligencePanel({
  loading,
  thread,
  onAsk,
  onScenario,
  onCitationClick,
}: ProofIntelligencePanelProps) {
  const [inputVal, setInputVal] = useState("");
  const [activeIssue, setActiveIssue] = useState<IssueScenario | null>(null);

  const handleSend = async () => {
    if (!inputVal.trim() || loading) return;
    const q = inputVal;
    setInputVal("");
    await onAsk(q);
  };

  const handleIssueClick = async (issue: IssueScenario) => {
    setActiveIssue(activeIssue?.id === issue.id ? null : issue);
    await onScenario(issue.prompt, issue.label);
  };

  return (
    <div className="flex flex-col h-full bg-[#FFFFFF] border-l border-[#E4E1D8] select-text overflow-hidden font-sans-ui">
      {/* Header */}
      <div className="h-12 border-b border-[#E4E1D8] px-4 flex items-center justify-between bg-[#FAF9F6] shrink-0 select-none">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#B08D57]" />
          <h2 className="font-mono-legal font-semibold text-[11px] tracking-wider text-[#14171F] uppercase">
            Proof Intelligence™
          </h2>
        </div>
        <span className="text-[9.5px] font-mono-legal text-[#525866] bg-[#FFFFFF] border border-[#E4E1D8] px-2 py-0.5 rounded-[3px]">
          Gated Reasoning
        </span>
      </div>

      {/* Scenario / Issue Navigation: Refined Vertical Numbered List with Connecting Rule */}
      <div className="p-3.5 border-b border-[#E4E1D8] bg-[#FAF9F6]">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[10px] font-mono-legal font-semibold text-[#868C98] uppercase tracking-wider">
            Issue Spotting Scenarios
          </span>
          <span className="text-[10px] font-mono-legal text-[#868C98]">3 Scenarios</span>
        </div>

        <div className="relative pl-3 space-y-1.5">
          {/* Vertical Connecting Hairline Rule */}
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[#E4E1D8]" />

          {PRECONFIGURED_ISSUES.map((issue) => {
            const isSelected = activeIssue?.id === issue.id;
            return (
              <button
                key={issue.id}
                onClick={() => handleIssueClick(issue)}
                disabled={loading}
                className={`w-full text-left p-2 rounded-[5px] border transition-certus flex items-center justify-between select-none relative ${
                  isSelected
                    ? "bg-[#FFFFFF] border-[#1B2A4A] ring-1 ring-[#1B2A4A]/20 shadow-2xs"
                    : "bg-[#FFFFFF] border-[#E4E1D8] hover:border-[#B08D57]/70"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-[10px] font-mono-legal font-bold text-[#B08D57] shrink-0">
                    {issue.num}
                  </span>
                  <div className="min-w-0">
                    <div className="font-sans-ui font-medium text-[11.5px] text-[#14171F] truncate leading-tight">
                      {issue.label}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-[9.5px] font-mono-legal font-semibold px-1.5 py-0.2 rounded-[2px] border ${
                      issue.risk === "High"
                        ? "bg-[#F9F1F1] text-[#8C3A3A] border-[#E4C3C3]"
                        : "bg-[#FBF7F0] text-[#8A6D3B] border-[#E5D5B8]"
                    }`}
                  >
                    {issue.risk}
                  </span>
                  <ChevronRight className="w-3 h-3 text-[#868C98]" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Issue Contextual Intelligence View (if selected) */}
      {activeIssue && (
        <div className="p-4 bg-[#FAF9F6] border-b border-[#E4E1D8] max-h-68 overflow-y-auto custom-scrollbar text-xs">
          <div className="flex items-center justify-between mb-2.5 pb-1 border-b border-[#EDEAE2]">
            <div className="flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-[#8C3A3A]" />
              <span className="font-mono-legal font-bold text-[#14171F] uppercase tracking-wider text-[10.5px]">
                {activeIssue.label} Analysis
              </span>
            </div>
            <button
              onClick={() => setActiveIssue(null)}
              className="text-[10px] font-mono-legal text-[#868C98] hover:text-[#14171F]"
            >
              [Close]
            </button>
          </div>

          <div className="space-y-2.5">
            <div>
              <span className="text-[9.5px] font-mono-legal font-semibold text-[#868C98] uppercase tracking-wider block">
                What the Contract Governs:
              </span>
              <p className="text-[12px] font-serif-legal italic text-[#2A2F3D] bg-[#FFFFFF] p-2 rounded-[4px] border border-[#E4E1D8] mt-0.5 leading-relaxed">
                "{activeIssue.docFinding}"
              </p>
            </div>

            <div>
              <span className="text-[9.5px] font-mono-legal font-semibold text-[#868C98] uppercase tracking-wider block">
                Exposure &amp; Impact:
              </span>
              <p className="text-[12px] text-[#14171F] mt-0.5 font-sans-ui">
                {activeIssue.breachImpact}
              </p>
            </div>

            <div>
              <span className="text-[9.5px] font-mono-legal font-semibold text-[#868C98] uppercase tracking-wider block">
                Governing Doctrine:
              </span>
              <p className="text-[11px] font-serif-legal text-[#1F3B23] bg-[#EEF4EF] p-2 rounded-[4px] border border-[#B4CEBA] mt-0.5">
                {activeIssue.authority}
              </p>
            </div>

            <div>
              <span className="text-[9.5px] font-mono-legal font-semibold text-[#868C98] uppercase tracking-wider block mb-1">
                Open Questions for Counsel:
              </span>
              <ul className="list-disc pl-4 space-y-0.5 text-[11.5px] text-[#525866]">
                {activeIssue.openQuestions.map((q, idx) => (
                  <li key={idx}>{q}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Main Conversation & Thread Feed */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 custom-scrollbar bg-[#FAF9F6]">
        {thread.length === 0 && !loading && (
          <div className="py-6 text-center text-[#525866] flex flex-col items-center justify-center">
            <div className="w-9 h-9 rounded-[4px] bg-[#FAF9F6] border border-[#E4E1D8] flex items-center justify-center text-[#B08D57] mb-2.5">
              <BookOpen className="w-4 h-4" />
            </div>
            <h3 className="font-serif-display font-semibold text-[#14171F] text-[13.5px] mb-1">
              Evidence-Grounded Legal Querying
            </h3>
            <p className="text-xs text-[#525866] max-w-xs mb-4 leading-relaxed font-sans-ui">
              Probe obligations or evaluate hypothetical breach scenarios. Every claim is strictly validated by the citation gate.
            </p>

            {/* Quick Prompt Starters */}
            <div className="w-full space-y-1.5 text-left">
              <span className="text-[9.5px] font-mono-legal font-semibold text-[#868C98] uppercase tracking-wider block mb-1">
                Suggested Legal Inquiries:
              </span>
              {SUGGESTED_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => onAsk(prompt)}
                  className="w-full text-left p-2 rounded-[5px] bg-[#FFFFFF] border border-[#E4E1D8] hover:border-[#B08D57] text-xs text-[#14171F] transition-certus flex items-center justify-between group shadow-2xs"
                >
                  <span className="truncate">{prompt}</span>
                  <ChevronRight className="w-3 h-3 text-[#868C98] group-hover:text-[#B08D57] transition-certus" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Existing Q&A turns */}
        {thread.map((turn, tIdx) => (
          <div key={tIdx} className="space-y-2 animate-subtle-fade">
            {/* User Question Bubble */}
            <div className="bg-[#FFFFFF] text-[#14171F] p-2.5 rounded-[5px] border border-[#E4E1D8] text-xs font-medium">
              <span className="text-[9.5px] font-mono-legal font-bold text-[#868C98] uppercase tracking-wider block mb-0.5">
                Inquiry:
              </span>
              <p className="text-[13px] text-[#14171F] font-sans-ui">{turn.question}</p>
            </div>

            {/* Gated Proof Claims */}
            <div className="space-y-2 pl-0.5">
              {turn.claims.map((claim, cIdx) => (
                <ClaimCard
                  key={cIdx}
                  claim={claim}
                  onCitationClick={onCitationClick}
                  showProofChain={true}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Loading state skeleton */}
        {loading && (
          <div className="p-3.5 rounded-[6px] bg-[#FFFFFF] border border-[#E4E1D8] space-y-2.5 animate-pulse">
            <div className="flex items-center gap-2 text-[#1B2A4A] text-xs font-mono-legal font-semibold">
              <div className="w-1.5 h-1.5 rounded-full bg-[#B08D57] animate-ping" />
              <span>Gating claims against source citation tokens...</span>
            </div>
            <div className="space-y-2">
              <div className="h-2.5 bg-[#FAF9F6] rounded w-3/4" />
              <div className="h-2.5 bg-[#FAF9F6] rounded w-1/2" />
              <div className="h-7 bg-[#FAF9F6] border border-[#E4E1D8] rounded p-2" />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Command Interface Input Bar */}
      <div className="p-3 border-t border-[#E4E1D8] bg-[#FFFFFF] shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="relative flex items-center"
        >
          <input
            type="text"
            placeholder="Ask Certus or probe a legal clause..."
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            disabled={loading}
            className="w-full bg-[#FAF9F6] border border-[#E4E1D8] rounded-[5px] pl-3 pr-16 py-2.5 text-xs text-[#14171F] placeholder:text-[#868C98] focus:outline-hidden focus:border-[#B08D57] focus:bg-[#FFFFFF] focus:ring-1 focus:ring-[#B08D57]/30 transition-certus font-sans-ui"
          />
          <div className="absolute right-1.5 flex items-center gap-1">
            <kbd className="hidden sm:inline-block px-1 py-0.5 text-[9px] font-mono-legal text-[#868C98] bg-[#FFFFFF] border border-[#E4E1D8] rounded">
              ↵
            </kbd>
            <button
              type="submit"
              disabled={loading || !inputVal.trim()}
              className="bg-[#1B2A4A] hover:bg-[#111B30] disabled:opacity-30 text-white p-1.5 rounded-[4px] transition-certus shadow-2xs shrink-0"
              title="Submit Inquiry"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
        <div className="flex items-center justify-between mt-1.5 px-0.5 text-[9.5px] font-mono-legal text-[#868C98] select-none">
          <span>DETERMINISTIC VERIFICATION ACTIVE</span>
          <span>PRESS ENTER TO PROBE</span>
        </div>
      </div>
    </div>
  );
}
