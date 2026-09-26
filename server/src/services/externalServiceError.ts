export interface ExternalFailure {
  status: number;
  code: "UPSTREAM_AUTH_FAILED" | "UPSTREAM_RATE_LIMITED" | "UPSTREAM_TIMEOUT" | "UPSTREAM_UNAVAILABLE";
  message: string;
}

export function externalFailure(error: unknown, service: string): ExternalFailure {
  const raw = error instanceof Error ? error.message : String(error || "");
  if (/api.?key|credential|unauthenticated|permission|401|403/i.test(raw)) {
    return { status: 502, code: "UPSTREAM_AUTH_FAILED", message: `${service} rejected the server credential. Check the deployment environment configuration.` };
  }
  if (/rate.?limit|quota|resource.?exhausted|429/i.test(raw)) {
    return { status: 429, code: "UPSTREAM_RATE_LIMITED", message: `${service} rate limit reached. Please retry later.` };
  }
  if (/timeout|timed out|deadline|abort/i.test(raw)) {
    return { status: 504, code: "UPSTREAM_TIMEOUT", message: `${service} timed out. Please retry.` };
  }
  return { status: 502, code: "UPSTREAM_UNAVAILABLE", message: `${service} is temporarily unavailable. Please retry.` };
}
