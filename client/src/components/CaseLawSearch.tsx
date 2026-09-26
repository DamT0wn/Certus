import { useState, type FormEvent } from "react";
import { Search, ExternalLink } from "lucide-react";
import { apiError, searchCaseLaw, type CaseLawSearch as SearchData } from "../api/client";

export function CaseLawSearch() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<SearchData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function search(event: FormEvent) {
    event.preventDefault();
    if (busy || query.trim().length < 2) return;
    setBusy(true); setError(""); setData(null);
    try { setData(await searchCaseLaw(query.trim())); }
    catch (err) { setError(apiError(err)); }
    finally { setBusy(false); }
  }
  return <details className="rounded-md border border-[var(--certus-border)] bg-white text-xs">
    <summary className="p-3 cursor-pointer font-semibold text-[var(--certus-navy)]">US case-law research · CourtListener</summary>
    <div className="p-3 pt-0 space-y-3">
      <p className="text-[var(--certus-secondary)]">Search terms are sent to CourtListener. Results are research leads, not verified legal conclusions.</p>
      <form onSubmit={search} className="flex gap-2">
        <input aria-label="Case-law search terms" value={query} onChange={e => setQuery(e.target.value)} placeholder="e.g. contract notice of termination" maxLength={500} minLength={2} required disabled={busy} className="min-w-0 flex-1 border border-[var(--certus-border)] rounded p-2" />
        <button aria-label="Search case law" disabled={busy || query.trim().length < 2} className="p-2 rounded bg-[var(--certus-navy)] text-white"><Search className="w-4 h-4" /></button>
      </form>
      {busy && <p role="status">Searching CourtListener…</p>}
      {error && <p role="alert" className="text-[var(--certus-brick)]">{error}</p>}
      {data && <div className="space-y-3">
        <p className="text-[var(--certus-secondary)]">{data.results.length ? `${data.results.length} results shown` : "No matching cases found"} · {new Date(data.retrievedAt).toLocaleString()}</p>
        {data.results.map(result => <article key={result.id} className="border-t border-[var(--certus-border)] pt-3 space-y-1 break-words">
          <a href={result.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--certus-navy)] underline">{result.caseName}<ExternalLink className="inline w-3 h-3 ml-1" /></a>
          <p>{result.court} · {result.dateFiled || "Date unavailable"} · {result.status}</p>
          {result.citations.length > 0 && <p className="font-mono-legal">{result.citations.join("; ")}</p>}
          {result.snippet && <p className="font-serif-legal text-[var(--certus-secondary)]">{result.snippet}</p>}
        </article>)}
      </div>}
    </div>
  </details>;
}
