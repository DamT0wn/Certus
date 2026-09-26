const ORIGIN = "https://www.courtlistener.com";

export interface CaseLawResult {
  id: number;
  caseName: string;
  court: string;
  dateFiled: string | null;
  citations: string[];
  url: string;
  snippet: string;
  status: string;
}

export class ResearchError extends Error {
  constructor(message: string, public statusCode: number) { super(message); }
}

function plain(value: unknown, max = 1000): string {
  return typeof value === "string" ? value.replace(/<[^>]*>/g, "").trim().slice(0, max) : "";
}

export async function searchCaseLaw(query: string) {
  const q = query.trim();
  if (q.length < 2 || q.length > 500) throw new ResearchError("Enter a case-law query between 2 and 500 characters.", 400);
  const token = process.env.COURTLISTENER_API_TOKEN?.trim();
  if (!token) throw new ResearchError("Case-law search is not configured on this server.", 503);
  const url = new URL("/api/rest/v4/search/", ORIGIN);
  url.searchParams.set("q", q);
  url.searchParams.set("type", "o");
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Token ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    });
  } catch {
    throw new ResearchError("CourtListener could not be reached. Please retry.", 502);
  }
  if (response.status === 401 || response.status === 403) throw new ResearchError("CourtListener rejected the server credential or API access. Check the token and account permissions.", 502);
  if (response.status === 429) throw new ResearchError("CourtListener rate limit reached. Please try again later.", 429);
  if (!response.ok) throw new ResearchError("CourtListener search is temporarily unavailable.", 502);
  let payload: any;
  try { payload = await response.json(); } catch { throw new ResearchError("CourtListener returned an invalid response.", 502); }
  if (!Array.isArray(payload?.results)) throw new ResearchError("CourtListener returned an invalid response.", 502);
  const results: CaseLawResult[] = payload.results.slice(0, 10).flatMap((item: any) => {
    if (!Number.isSafeInteger(item?.cluster_id) || typeof item.absolute_url !== "string") return [];
    let source: URL;
    try { source = new URL(item.absolute_url, ORIGIN); } catch { return []; }
    if (source.origin !== ORIGIN || source.username || source.password || !source.pathname.startsWith("/opinion/")) return [];
    return [{
      id: item.cluster_id,
      caseName: plain(item.caseName, 300) || "Untitled opinion",
      court: plain(item.court, 200),
      dateFiled: typeof item.dateFiled === "string" ? item.dateFiled.slice(0, 10) : null,
      citations: Array.isArray(item.citation) ? item.citation.filter((c: unknown) => typeof c === "string").slice(0, 10).map((c: string) => plain(c, 150)) : [],
      url: source.href,
      snippet: plain(item.opinions?.[0]?.snippet || item.snippet),
      status: plain(item.status, 80),
    }];
  });
  return { provider: "CourtListener" as const, query: q, retrievedAt: new Date().toISOString(), results };
}
