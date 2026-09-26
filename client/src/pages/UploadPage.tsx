import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { uploadDocument, extractDocument, createDemoSession, apiError } from "../api/client";
import { AppHeader } from "../components/AppHeader";
import { CommandPalette } from "../components/CommandPalette";
import { KeyboardShortcutsModal } from "../components/KeyboardShortcutsModal";
import { FileText, FlaskConical } from "lucide-react";

export function UploadPage() {
  const [busy, setBusy] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(-1);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);

  const [demoToken, setDemoToken] = useState<string | null>(() => sessionStorage.getItem("certus_demo_session"));
  const [demoName, setDemoName] = useState<string>(() => sessionStorage.getItem("certus_demo_name") || "");
  const [sessionError, setSessionError] = useState<string>("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const navigate = useNavigate();
  const mockMode = true;

  const UPLOAD_STEPS = [
    { title: "Upload & Parse Document", desc: "Read pages and index source text" },
    { title: "Extract & Verify Claims", desc: "Check citations against the referenced pages" },
  ];

  async function handleDemoSignIn() {
    setCurrentStepIndex(-1);
    setSessionError("");
    setBusy(true);
    try {
      const session = createDemoSession();
      sessionStorage.setItem("certus_demo_session", session.sessionId);
      sessionStorage.setItem("certus_demo_name", session.displayName);
      setDemoToken(session.sessionId);
      setDemoName(session.displayName);
    } catch (err: unknown) {
      setSessionError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  function handleEndDemo() {
    sessionStorage.removeItem("certus_demo_session");
    sessionStorage.removeItem("certus_demo_name");
    setDemoToken(null);
    setDemoName("");
  }

  async function handleFile(file: File) {
    if (busy) return;
    if (!demoToken) {
      setSessionError("Start a mock session before uploading a document.");
      return;
    }
    setSessionError("");
    setBusy(true);
    setCurrentStepIndex(0);
    setStatusMessage(`Transmitting "${file.name}"...`);

    try {
      setStatusMessage(mockMode ? "Reading PDF text and indexing pages…" : "Uploading and reading pages via Document AI OCR…");
      const { documentId } = await uploadDocument(file);

      setCurrentStepIndex(1);
      setStatusMessage("Extracting claims and checking their citations…");
      await extractDocument(documentId);

      navigate(`/document/${documentId}`);
    } catch (err: unknown) {
      setStatusMessage(`Error: ${apiError(err)}`);
      setBusy(false);
      setCurrentStepIndex(-1);
    }
  }

  async function handleUploadSample() {
    if (busy) return;
    setBusy(true);
    setCurrentStepIndex(0);
    setStatusMessage("Loading example PDF…");
    try {
      const response = await fetch("/sample-contract.pdf");
      if (!response.ok) throw new Error("Sample document could not be loaded.");
      await handleFile(new File([await response.blob()], "sample-contract.pdf", { type: "application/pdf" }));
    } catch (err) { setSessionError(apiError(err)); setBusy(false); }
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#14171F] flex flex-col justify-between selection:bg-[#B08D57]/20 selection:text-[#1B2A4A] font-sans-ui">
      {/* Global Application Header */}
      <AppHeader
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        demoToken={demoToken}
        demoName={demoName}
        onEndDemo={handleEndDemo}
        onStartDemo={!busy ? handleDemoSignIn : undefined}
      />

      {/* Main Intake Body */}
      <main id="main-content" className="max-w-4xl mx-auto w-full px-6 py-14 flex-1 flex flex-col justify-center">
        {/* Editorial Subdued Hero */}
        <div className="text-center mb-10">
          {/* Smaller, quieter mono-style tag */}
          <div className="inline-flex items-center gap-2 bg-[#FAF9F6] border border-[#E4E1D8] px-2.5 py-1 rounded-[4px] text-[10.5px] font-mono-legal text-[#525866] mb-5 select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-[#B08D57]" />
            <span className="uppercase tracking-wider">Citation Gate Active · {mockMode ? "Demo analysis" : "Document evidence"}</span>
          </div>

          {/* Headline in serif display font with brass accent */}
          <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-serif-display font-semibold tracking-tight text-[#14171F] max-w-2xl mx-auto leading-[1.16] mb-3.5">
            Turn contracts into <span className="text-[#B08D57] italic">defensible</span> intelligence.
          </h1>

          <p className="text-[#525866] text-sm sm:text-[15px] max-w-xl mx-auto leading-relaxed font-sans-ui">
            Legal AI can sound certain even when its evidence is weak. Certus verifies every material claim against source text, labels its proof status, and sends unsupported statements to attorney review instead of presenting them as fact.
          </p>
        </div>

        {/* Refined Document Intake Panel */}
        <div className="max-w-xl mx-auto w-full bg-[#FFFFFF] rounded-[6px] p-6 shadow-xs border border-[#E4E1D8] transition-certus">
          {sessionError && <p role="alert" className="mb-4 text-sm text-[var(--certus-brick)]">{sessionError}</p>}
          {!busy && statusMessage.startsWith("Error:") && <p role="alert" className="mb-4 text-sm text-[var(--certus-brick)]">{statusMessage}</p>}
          {busy && currentStepIndex < 0 ? <p role="status">Starting mock session…</p> : busy ? (
            /* Multi-step intelligent progress indicator */
            <div className="py-6 px-4 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#EDEAE2]">
                <span className="text-[11px] font-bold text-[#1B2A4A] uppercase tracking-wider font-mono-legal">
                  INTAKE PIPELINE · {UPLOAD_STEPS[currentStepIndex]?.title}
                </span>
                <span className="text-[11px] font-mono-legal text-[#868C98]">
                  Step {currentStepIndex + 1} of {UPLOAD_STEPS.length}
                </span>
              </div>

              <div className="space-y-2.5">
                {UPLOAD_STEPS.map((step, idx) => {
                  const isDone = idx < currentStepIndex;
                  const isCurrent = idx === currentStepIndex;
                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-3 p-2 rounded-[4px] text-xs transition-certus ${
                        isCurrent
                          ? "bg-[#FAF9F6] text-[#14171F] font-semibold border border-[#E4E1D8]"
                          : isDone
                          ? "text-[#525866]"
                          : "text-[#868C98]/60"
                      }`}
                    >
                      <div
                        className={`w-4.5 h-4.5 rounded-[3px] flex items-center justify-center shrink-0 text-[10px] font-mono-legal font-bold ${
                          isDone
                            ? "bg-[var(--certus-forest)] text-[#FAF9F6]"
                            : isCurrent
                            ? "bg-[#1B2A4A] text-[#B08D57] animate-pulse"
                            : "bg-[#FAF9F6] text-[#868C98] border border-[#E4E1D8]"
                        }`}
                      >
                        {isDone ? "✓" : idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="leading-tight">{step.title}</div>
                        <div className="text-[10px] text-[#868C98] font-normal">{step.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {statusMessage && (
                <div className="text-center text-xs font-mono-legal text-[#525866] pt-2">
                  {statusMessage}
                </div>
              )}
            </div>
          ) : !demoToken ? (
            <section aria-labelledby="demo-access-heading" className="text-center py-5 px-3">
              <div className="w-12 h-12 rounded-[6px] bg-[#1B2A4A] mx-auto flex items-center justify-center mb-3.5 border border-[#2B3E68]">
                <FlaskConical aria-hidden="true" className="w-6 h-6 text-[#B08D57]" />
              </div>
              <h2 id="demo-access-heading" className="font-serif-display font-semibold text-lg text-[#14171F]">
                Mock sign-in for this demo
              </h2>
              <p className="mt-2 mb-4 text-xs leading-relaxed text-[#525866] max-w-sm mx-auto">
                Authentication is outside this MVP. Start an isolated, temporary browser session—no email, password, or account data required.
              </p>
              <button
                type="button"
                onClick={handleDemoSignIn}
                className="text-sm font-semibold bg-[#1B2A4A] hover:bg-[#111B30] text-white px-5 py-2.5 rounded-[6px] transition-certus"
              >
                Continue with mock sign-in
              </button>
            </section>
          ) : (
            <div>
              {/* Dropzone with solid hairline border & brass seal icon */}
              <label
                tabIndex={0}
                role="button"
                aria-label="Choose a PDF document to analyze"
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (e.dataTransfer.files?.[0]) {
                    handleFile(e.dataTransfer.files[0]);
                  }
                }}
                className={`block border rounded-[6px] p-8 text-center cursor-pointer transition-certus focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[var(--certus-brass-dark)] ${
                  dragOver
                    ? "border-[#B08D57] bg-[#FAF9F6]"
                    : "border-[#E4E1D8] hover:border-[#B08D57] bg-[#FAF9F6]/50 hover:bg-[#FAF9F6]"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                
                {/* Brass Verification Seal Icon */}
                <div className="w-12 h-12 rounded-[6px] bg-[#1B2A4A] mx-auto flex items-center justify-center mb-3.5 border border-[#2B3E68] shadow-2xs">
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-[#B08D57]">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.2" strokeDasharray="1.5 2" />
                    <circle cx="12" cy="12" r="6.5" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M12 8v8M8 12h8" stroke="#FAF9F6" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>

                <p className="font-serif-display font-medium text-[15px] text-[#14171F] mb-1">
                  {dragOver ? "Release to analyze document" : "Drop legal agreement or browse workstation files"}
                </p>
                <p className="text-xs text-[#868C98] mb-4 font-sans-ui">
                  Supported format: PDF (up to 50 MB)
                </p>

                <span className="inline-block text-xs font-semibold bg-[#1B2A4A] hover:bg-[#111B30] text-[#FAF9F6] px-4 py-2 rounded-[5px] transition-certus shadow-2xs">
                  Choose Document
                </span>
              </label>

              {/* Sample Document Quick Starter */}
              <div className="sample-row mt-4 pt-3.5 border-t border-[#EDEAE2] flex items-center justify-between text-xs">
                <span className="text-[#525866]">Need a demonstration agreement?</span>
                <button
                  onClick={handleUploadSample}
                  className="font-medium text-[#14171F] hover:text-[#B08D57] bg-[#FAF9F6] hover:bg-[#FFFFFF] border border-[#E4E1D8] hover:border-[#B08D57] px-3 py-1.5 rounded-[5px] transition-certus flex items-center gap-1.5 shadow-2xs"
                >
                  <FileText className="w-3.5 h-3.5 text-[#B08D57]" />
                  <span>Load Example PDF</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Unified Horizontal Evidence Classification Legend */}
        <div className="mt-10 max-w-2xl mx-auto w-full">
          <div className="text-center mb-2.5">
            <span className="text-[10px] font-mono-legal font-semibold uppercase tracking-wider text-[#868C98]">
              Proof Mode™ Evidence Classification
            </span>
          </div>

          <div className="bg-[#FFFFFF] rounded-[6px] border border-[#E4E1D8] shadow-2xs evidence-legend grid grid-cols-4 overflow-hidden">
            <div className="p-3 text-left">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--certus-forest)]" />
                <span className="font-mono-legal font-semibold text-[10px] text-[var(--certus-forest)] tracking-wider uppercase">
                  DOCUMENT FACT
                </span>
              </div>
              <p className="text-[11px] text-[#525866] leading-tight font-sans-ui">
                Verified verbatim against source text.
              </p>
            </div>

            <div className="p-3 text-left">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--certus-law)]" />
                <span className="font-mono-legal font-semibold text-[10px] text-[var(--certus-law)] tracking-wider uppercase">
                  VERIFIED LAW
                </span>
              </div>
              <p className="text-[11px] text-[#525866] leading-tight font-sans-ui">
                Independently confirmed legal authority.
              </p>
            </div>

            <div className="p-3 text-left">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--certus-ochre)]" />
                <span className="font-mono-legal font-semibold text-[10px] text-[var(--certus-ochre)] tracking-wider uppercase">
                  AI INFERENCE
                </span>
              </div>
              <p className="text-[11px] text-[#525866] leading-tight font-sans-ui">
                Reasoned interpretation for attorney review.
              </p>
            </div>

            <div className="p-3 text-left">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--certus-brick)]" />
                <span className="font-mono-legal font-semibold text-[10px] text-[var(--certus-brick)] tracking-wider uppercase">
                  UNVERIFIED
                </span>
              </div>
              <p className="text-[11px] text-[#525866] leading-tight font-sans-ui">
                Citation gate rejected statement.
              </p>
            </div>
          </div>
        </div>

      </main>

      {/* Subdued Professional Footer */}
      <footer className="py-4 border-t border-[#E4E1D8] bg-[#FFFFFF] text-[11px] text-[#868C98] select-none font-sans-ui">
        <div className="intake-footer max-w-4xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-serif-display font-semibold text-[#14171F]">Certus</span>
            <span>·</span>
            <span>Proof Mode™ Legal Intelligence Workstation</span>
          </div>
          <div className="flex items-center gap-4 text-[#525866] font-mono-legal text-[10px]">
            <span>PRIVILEGED &amp; CONFIDENTIAL</span>
            <span>ATTORNEY WORK PRODUCT</span>
          </div>
        </div>
      </footer>

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        claims={[]}
        onSelectAction={(action) => {
          if (action === "scenario_resignation" || action === "jump_p1") {
            handleUploadSample();
          }
        }}
      />

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
}
