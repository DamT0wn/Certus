import { useState, useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { uploadDocument, extractDocument, register, login } from "../api/client";
import { AppHeader } from "../components/AppHeader";
import { CommandPalette } from "../components/CommandPalette";
import { KeyboardShortcutsModal } from "../components/KeyboardShortcutsModal";
import { FileText, ChevronDown, ChevronUp, Lock } from "lucide-react";

export function UploadPage() {
  const [busy, setBusy] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(-1);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);

  const [authToken, setAuthToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [authEmail, setAuthEmail] = useState("demo@certus.legal");
  const [authPassword, setAuthPassword] = useState("password123");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authError, setAuthError] = useState<string>("");
  const [showCustomAuth, setShowCustomAuth] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  const navigate = useNavigate();

  const UPLOAD_STEPS = [
    { title: "Uploading Document", desc: "Secure transmission & artifact registration" },
    { title: "Document AI OCR Parsing", desc: "Structured multi-page tokenization" },
    { title: "Extracting Material Claims", desc: "Identifying obligations, terms & conditions" },
    { title: "Citation Gate Verification", desc: "Deterministic verification against source text" },
    { title: "Building Proof Graph", desc: "Grounding facts, legal doctrine & inferences" },
  ];

  useEffect(() => {
    const token = localStorage.getItem("certus_token");
    const email = localStorage.getItem("certus_email");
    if (token) {
      setAuthToken(token);
      if (email) setUserEmail(email);
    }
  }, []);

  async function handleAuthSubmit(e: FormEvent) {
    e.preventDefault();
    setAuthError("");
    setBusy(true);
    try {
      let token = "";
      if (authMode === "register") {
        token = await register(authEmail, authPassword);
      } else {
        token = await login(authEmail, authPassword);
      }
      localStorage.setItem("certus_token", token);
      localStorage.setItem("certus_email", authEmail);
      setAuthToken(token);
      setUserEmail(authEmail);
      setShowCustomAuth(false);
    } catch (err: any) {
      if (authMode === "login" && err?.response?.status === 401 && authEmail === "demo@certus.legal") {
        try {
          const regToken = await register(authEmail, authPassword);
          localStorage.setItem("certus_token", regToken);
          localStorage.setItem("certus_email", authEmail);
          setAuthToken(regToken);
          setUserEmail(authEmail);
          setShowCustomAuth(false);
          return;
        } catch {
          // ignore fallback
        }
      }
      setAuthError(err?.response?.data?.error || err.message || "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleQuickDemoAuth() {
    setAuthError("");
    setBusy(true);
    try {
      const email = `attorney_${Date.now().toString().slice(-4)}@certus.legal`;
      const pwd = "DemoPassword123!";
      const token = await register(email, pwd);
      localStorage.setItem("certus_token", token);
      localStorage.setItem("certus_email", email);
      setAuthToken(token);
      setUserEmail(email);
    } catch (err: any) {
      setAuthError(err?.response?.data?.error || err.message);
    } finally {
      setBusy(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("certus_token");
    localStorage.removeItem("certus_email");
    setAuthToken(null);
    setUserEmail("");
  }

  async function ensureAuthenticated(): Promise<boolean> {
    if (localStorage.getItem("certus_token")) return true;
    try {
      const email = `counsel_${Date.now().toString().slice(-4)}@certus.legal`;
      const token = await register(email, "DemoPass123!");
      localStorage.setItem("certus_token", token);
      localStorage.setItem("certus_email", email);
      setAuthToken(token);
      setUserEmail(email);
      return true;
    } catch {
      return false;
    }
  }

  async function handleFile(file: File) {
    setBusy(true);
    setCurrentStepIndex(0);
    setStatusMessage(`Transmitting "${file.name}"...`);

    try {
      const isAuthed = await ensureAuthenticated();
      if (!isAuthed) {
        setBusy(false);
        return;
      }

      setCurrentStepIndex(1);
      setStatusMessage("Reading document pages via Document AI OCR...");
      const { documentId } = await uploadDocument(file);

      setCurrentStepIndex(2);
      setStatusMessage("Extracting material obligations & legal claims...");
      await new Promise((r) => setTimeout(r, 350));

      setCurrentStepIndex(3);
      setStatusMessage("Running deterministic citation gate...");
      await extractDocument(documentId);

      setCurrentStepIndex(4);
      setStatusMessage("Constructing Proof Graph & readying workspace...");
      await new Promise((r) => setTimeout(r, 350));

      navigate(`/document/${documentId}`);
    } catch (err: any) {
      setStatusMessage(`Error: ${err?.response?.data?.detail || err?.response?.data?.error || err.message}`);
      setBusy(false);
      setCurrentStepIndex(-1);
    }
  }

  function handleUploadSample() {
    const sampleText = `%PDF-1.4 Mock Header
EXECUTIVE EMPLOYMENT AGREEMENT
Between Apex Global Technologies Inc. and Sarah Jenkins
Page 1: Position: Vice President of Engineering. Base Salary: $240,000. Discretionary Bonus: 25%.
Page 2: Confidentiality and 12-month Non-Competition in North America.
Page 3: Termination: 60-day notice of resignation. 6 months severance. Delaware governing law.`;

    const sampleFile = new File([sampleText], "Executive_Employment_Agreement.pdf", {
      type: "application/pdf",
    });
    handleFile(sampleFile);
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#14171F] flex flex-col justify-between selection:bg-[#B08D57]/20 selection:text-[#1B2A4A] font-sans-ui">
      {/* Global Application Header */}
      <AppHeader
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        authToken={authToken}
        userEmail={userEmail}
        onLogout={handleLogout}
        onQuickDemoAuth={handleQuickDemoAuth}
      />

      {/* Main Intake Body */}
      <main className="max-w-4xl mx-auto w-full px-6 py-14 flex-1 flex flex-col justify-center">
        {/* Editorial Subdued Hero */}
        <div className="text-center mb-10">
          {/* Smaller, quieter mono-style tag */}
          <div className="inline-flex items-center gap-2 bg-[#FAF9F6] border border-[#E4E1D8] px-2.5 py-1 rounded-[4px] text-[10.5px] font-mono-legal text-[#525866] mb-5 select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-[#B08D57]" />
            <span className="uppercase tracking-wider">Deterministic Citation Gate Active · Zero Hallucinations</span>
          </div>

          {/* Headline in serif display font with brass accent */}
          <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-serif-display font-semibold tracking-tight text-[#14171F] max-w-2xl mx-auto leading-[1.16] mb-3.5">
            Turn contracts into <span className="text-[#B08D57] italic">defensible</span> intelligence.
          </h1>

          <p className="text-[#525866] text-sm sm:text-[15px] max-w-xl mx-auto leading-relaxed font-sans-ui">
            Every material claim is verified against source document text, classified by evidence authority, and gated for attorney audit.
          </p>
        </div>

        {/* Refined Document Intake Panel */}
        <div className="max-w-xl mx-auto w-full bg-[#FFFFFF] rounded-[6px] p-6 shadow-xs border border-[#E4E1D8] transition-certus">
          {busy ? (
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
                            ? "bg-[#2F5233] text-[#FAF9F6]"
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
          ) : (
            <div>
              {/* Dropzone with solid hairline border & brass seal icon */}
              <label
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
                className={`block border rounded-[6px] p-8 text-center cursor-pointer transition-certus ${
                  dragOver
                    ? "border-[#B08D57] bg-[#FAF9F6]"
                    : "border-[#E4E1D8] hover:border-[#B08D57] bg-[#FAF9F6]/50 hover:bg-[#FAF9F6]"
                }`}
              >
                <input
                  type="file"
                  accept="application/pdf,image/*,text/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                
                {/* Brass Verification Seal Icon */}
                <div className="w-12 h-12 rounded-[6px] bg-[#1B2A4A] mx-auto flex items-center justify-center mb-3.5 border border-[#2B3E68] shadow-2xs">
                  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-[#B08D57]">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.2" strokeDasharray="1.5 2" />
                    <circle cx="12" cy="12" r="6.5" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M12 8v8M8 12h8" stroke="#FAF9F6" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>

                <p className="font-serif-display font-medium text-[15px] text-[#14171F] mb-1">
                  {dragOver ? "Release to analyze document" : "Drop legal agreement or browse workstation files"}
                </p>
                <p className="text-xs text-[#868C98] mb-4 font-sans-ui">
                  Supported formats: PDF · DOCX · scanned agreements
                </p>

                <span className="inline-block text-xs font-semibold bg-[#1B2A4A] hover:bg-[#111B30] text-[#FAF9F6] px-4 py-2 rounded-[5px] transition-certus shadow-2xs">
                  Choose Document
                </span>
              </label>

              {/* Sample Document Quick Starter */}
              <div className="mt-4 pt-3.5 border-t border-[#EDEAE2] flex items-center justify-between text-xs">
                <span className="text-[#525866]">Need a demonstration agreement?</span>
                <button
                  onClick={handleUploadSample}
                  className="font-medium text-[#14171F] hover:text-[#B08D57] bg-[#FAF9F6] hover:bg-[#FFFFFF] border border-[#E4E1D8] hover:border-[#B08D57] px-3 py-1.5 rounded-[5px] transition-certus flex items-center gap-1.5 shadow-2xs"
                >
                  <FileText className="w-3.5 h-3.5 text-[#B08D57]" />
                  <span>Load Sample Contract (PDF)</span>
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

          <div className="bg-[#FFFFFF] rounded-[6px] border border-[#E4E1D8] shadow-2xs grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#E4E1D8] overflow-hidden">
            <div className="p-3 text-left">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2F5233]" />
                <span className="font-mono-legal font-semibold text-[10px] text-[#2F5233] tracking-wider uppercase">
                  DOCUMENT FACT
                </span>
              </div>
              <p className="text-[11px] text-[#525866] leading-tight font-sans-ui">
                Verified verbatim against source text.
              </p>
            </div>

            <div className="p-3 text-left">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1F3B23]" />
                <span className="font-mono-legal font-semibold text-[10px] text-[#1F3B23] tracking-wider uppercase">
                  VERIFIED LAW
                </span>
              </div>
              <p className="text-[11px] text-[#525866] leading-tight font-sans-ui">
                Authoritative legal canons &amp; doctrine.
              </p>
            </div>

            <div className="p-3 text-left">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#8A6D3B]" />
                <span className="font-mono-legal font-semibold text-[10px] text-[#8A6D3B] tracking-wider uppercase">
                  AI INFERENCE
                </span>
              </div>
              <p className="text-[11px] text-[#525866] leading-tight font-sans-ui">
                Reasoned interpretation for attorney review.
              </p>
            </div>

            <div className="p-3 text-left">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#8C3A3A]" />
                <span className="font-mono-legal font-semibold text-[10px] text-[#8C3A3A] tracking-wider uppercase">
                  UNVERIFIED
                </span>
              </div>
              <p className="text-[11px] text-[#525866] leading-tight font-sans-ui">
                Citation gate rejected statement.
              </p>
            </div>
          </div>
        </div>

        {/* Custom Authentication Accordion */}
        {!authToken && (
          <div className="max-w-xl mx-auto w-full mt-6">
            <button
              onClick={() => setShowCustomAuth(!showCustomAuth)}
              className="w-full flex items-center justify-between text-xs text-[#525866] hover:text-[#14171F] p-2 border border-[#E4E1D8] rounded-[6px] bg-[#FFFFFF]/80 hover:bg-[#FFFFFF] transition-certus font-sans-ui"
            >
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-[#868C98]" />
                <span>Need custom law firm credentials?</span>
              </div>
              {showCustomAuth ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showCustomAuth && (
              <div className="mt-2 bg-[#FFFFFF] rounded-[6px] p-4 border border-[#E4E1D8] text-xs shadow-xs animate-subtle-fade">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-[#14171F]">
                    {authMode === "login" ? "Attorney Sign In" : "Register Workstation Account"}
                  </span>
                  <button
                    onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
                    className="text-[#B08D57] hover:underline font-medium"
                  >
                    {authMode === "login" ? "Need an account? Register" : "Have an account? Sign In"}
                  </button>
                </div>
                {authError && <p className="text-[#8C3A3A] mb-2 font-medium">{authError}</p>}
                <form onSubmit={handleAuthSubmit} className="flex gap-2">
                  <input
                    type="email"
                    placeholder="counsel@firm.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="flex-1 border border-[#E4E1D8] rounded-[4px] px-2.5 py-1.5 text-xs focus:outline-hidden focus:border-[#B08D57]"
                    required
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-32 border border-[#E4E1D8] rounded-[4px] px-2.5 py-1.5 text-xs focus:outline-hidden focus:border-[#B08D57]"
                    required
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="bg-[#1B2A4A] text-white font-medium px-3.5 py-1.5 rounded-[4px] hover:bg-[#111B30] transition-certus"
                  >
                    {authMode === "login" ? "Sign In" : "Register"}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Subdued Professional Footer */}
      <footer className="py-4 border-t border-[#E4E1D8] bg-[#FFFFFF] text-[11px] text-[#868C98] select-none font-sans-ui">
        <div className="max-w-4xl mx-auto px-6 flex items-center justify-between">
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
