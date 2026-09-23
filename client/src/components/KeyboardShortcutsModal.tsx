import { X, Keyboard } from "lucide-react";

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  if (!isOpen) return null;

  const shortcuts = [
    { key: "⌘ / Ctrl + K", desc: "Open global command palette & search" },
    { key: "1, 2, 3", desc: "Jump to document page numbers" },
    { key: "B", desc: "Generate lawyer-ready brief" },
    { key: "Esc", desc: "Close open modal or clear selection" },
    { key: "Enter", desc: "Submit query to Proof Intelligence" },
    { key: "?", desc: "Open this keyboard shortcuts reference" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs select-none">
      <div
        className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 p-6 animate-subtle-fade"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-indigo-700" />
            <h3 className="font-bold text-slate-900 text-sm">Keyboard Shortcuts</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          {shortcuts.map((s, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-none">
              <span className="text-slate-600">{s.desc}</span>
              <kbd className="px-2 py-1 bg-slate-100 border border-slate-200 rounded font-mono text-[11px] text-slate-800 shadow-2xs">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-3 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
