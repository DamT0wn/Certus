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

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
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
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Actions list
  const systemActions = [
    { id: "generate_brief", label: "Generate Lawyer-Ready Brief", icon: FileText, category: "Actions" },
    { id: "scenario_resignation", label: "Probe Early Resignation Scenario", icon: Zap, category: "Scenario" },
    { id: "scenario_breach", label: "Probe Key Clause Breach Scenario", icon: Zap, category: "Scenario" },
    { id: "jump_p1", label: "Jump to Document Page 1 (Compensation)", icon: ArrowRight, category: "Navigation" },
    { id: "jump_p2", label: "Jump to Document Page 2 (Restrictive Covenants)", icon: ArrowRight, category: "Navigation" },
    { id: "jump_p3", label: "Jump to Document Page 3 (Termination & Law)", icon: ArrowRight, category: "Navigation" },
  ];

  // Filter actions and claims
  const filteredActions = systemActions.filter((a) =>
    a.label.toLowerCase().includes(query.toLowerCase())
  );

  const filteredClaims = claims.filter(
    (c) =>
      c.text.toLowerCase().includes(query.toLowerCase()) ||
      c.sourceText?.toLowerCase().includes(query.toLowerCase())
  );

  const totalItems = [...filteredActions, ...filteredClaims];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-slate-900/40 backdrop-blur-xs select-none">
      <div
        className="w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-subtle-fade"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3 border-b border-slate-200">
          <Search className="w-4 h-4 text-slate-400 mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
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
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded">
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
                  <div
                    key={action.id}
                    onClick={() => {
                      onSelectAction?.(action.id);
                      onClose();
                    }}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-xs transition ${
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
                  </div>
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
                  <div
                    key={idx}
                    onClick={() => {
                      onSelectClaim?.(claim);
                      onClose();
                    }}
                    className={`p-2.5 rounded-lg cursor-pointer text-xs transition ${
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
                  </div>
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
