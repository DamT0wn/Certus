import { useState, useEffect, useRef } from "react";
import { Search, FileText, ArrowRight, Zap, X } from "lucide-react";
import type { Claim } from "../api/client";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  claims: Claim[];
  onSelectClaim?: (claim: Claim) => void;
  onSelectAction?: (actionId: string) => void;
}

const SYSTEM_ACTIONS = [
  { id: "generate_brief", label: "Generate Lawyer-Ready Brief", icon: FileText, category: "Actions" },
  { id: "scenario_breach", label: "Run Breach of Contract Scenario", icon: Zap, category: "Scenario" },
  { id: "scenario_termination", label: "Run Early Termination Scenario", icon: Zap, category: "Scenario" },
  { id: "scenario_jurisdiction", label: "Run Jurisdiction Challenge Scenario", icon: Zap, category: "Scenario" },
  { id: "jump_p1", label: "Jump to Document Page 1 (Compensation)", icon: ArrowRight, category: "Navigation" },
  { id: "jump_p2", label: "Jump to Document Page 2 (Restrictive Covenants)", icon: ArrowRight, category: "Navigation" },
  { id: "jump_p3", label: "Jump to Document Page 3 (Termination & Law)", icon: ArrowRight, category: "Navigation" },
];

export function CommandPalette({
  isOpen,
  onClose,
  claims = [],
  onSelectClaim,
  onSelectAction,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (isOpen && e.key === "Escape") {
        onClose();
      }
      if (isOpen && e.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])');
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Filter actions and claims
  const filteredActions = SYSTEM_ACTIONS.filter((a) =>
    a.label.toLowerCase().includes(query.toLowerCase())
  );

  const filteredClaims = claims.filter(
    (c) =>
      c.text.toLowerCase().includes(query.toLowerCase()) ||
      c.sourceText?.toLowerCase().includes(query.toLowerCase())
  );

  const totalItems = [...filteredActions, ...filteredClaims];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-slate-900/40 backdrop-blur-xs select-none"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-palette-title"
        className="w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-subtle-fade"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3 border-b border-slate-200">
          <Search className="w-4 h-4 text-slate-400 mr-3 shrink-0" />
          <span id="command-palette-title" className="sr-only">Search claims and commands</span>
          <input
            ref={inputRef}
            type="text"
            aria-label="Search claims and commands"
            placeholder="Search claims, document passages, or run actions... (Esc to close)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex((prev) => (prev + 1) % Math.max(1, totalItems.length));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex((prev) => (prev - 1 + totalItems.length) % Math.max(1, totalItems.length));
              } else if (e.key === "Enter" && totalItems.length > 0) {
                e.preventDefault();
                const item = totalItems[selectedIndex];
                if ("id" in item && onSelectAction) {
                  onSelectAction(item.id);
                  onClose();
                } else if ("text" in item && onSelectClaim) {
                  onSelectClaim(item as Claim);
                  onClose();
                }
              }
            }}
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden font-sans-ui"
          />
          <button type="button" onClick={onClose} aria-label="Close command palette" className="p-1 text-slate-400 hover:text-slate-600 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 custom-scrollbar space-y-1">
          {/* Quick Actions Category */}
          {filteredActions.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Workstation Commands
              </div>
              {filteredActions.map((action, idx) => {
                const isSelected = selectedIndex === idx;
                const Icon = action.icon;
                return (
                  <button
                    type="button"
                    key={action.id}
                    onClick={() => {
                      onSelectAction?.(action.id);
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-xs transition ${
                      isSelected ? "bg-indigo-50 text-indigo-900 font-medium" : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{action.label}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                      {action.category}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Claims Category */}
          {filteredClaims.length > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-100">
              <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Document Claims &amp; Citations
              </div>
              {filteredClaims.map((claim, idx) => {
                const itemIdx = filteredActions.length + idx;
                const isSelected = selectedIndex === itemIdx;
                return (
                  <button
                    type="button"
                    key={`${claim.sourcePage ?? 0}:${claim.label}:${claim.text}`}
                    onClick={() => {
                      onSelectClaim?.(claim);
                      onClose();
                    }}
                    className={`w-full text-left p-2.5 rounded-lg cursor-pointer text-xs transition ${
                      isSelected ? "bg-indigo-50 text-indigo-900" : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono text-indigo-700 font-semibold">
                        {claim.label}
                      </span>
                      {claim.sourcePage && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          Page {claim.sourcePage}
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] line-clamp-1 text-slate-900">{claim.text}</p>
                    {claim.sourceText && (
                      <p className="text-[11px] font-serif-legal italic text-slate-500 line-clamp-1 mt-0.5">
                        "{claim.sourceText}"
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {totalItems.length === 0 && (
            <div className="py-8 text-center text-xs text-slate-400">
              No matching claims or actions found for "{query}"
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border rounded text-[10px] font-mono">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-white border rounded text-[10px] font-mono">↓</kbd>
              to navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white border rounded text-[10px] font-mono">↵</kbd>
              to select
            </span>
          </div>
          <span className="flex items-center gap-1 font-mono text-[10px]">
            <kbd className="px-1.5 py-0.5 bg-white border rounded text-[10px]">Esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
