import { externalFailure } from "../services/externalServiceError";

describe("external service error mapping", () => {
  test.each([
    ["API key invalid (401)", "UPSTREAM_AUTH_FAILED", 502],
    ["429 quota exceeded", "UPSTREAM_RATE_LIMITED", 429],
    ["request timed out", "UPSTREAM_TIMEOUT", 504],
    ["503 service unavailable", "UPSTREAM_UNAVAILABLE", 502],
  ])("maps %s to a safe actionable response", (message, code, status) => {
    expect(externalFailure(new Error(message), "Gemini")).toEqual(expect.objectContaining({ code, status }));
  });
});
