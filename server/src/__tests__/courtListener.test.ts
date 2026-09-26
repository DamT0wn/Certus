import { searchCaseLaw } from "../services/courtListenerService";

const originalFetch = global.fetch;
const originalToken = process.env.COURTLISTENER_API_TOKEN;
beforeEach(() => { process.env.COURTLISTENER_API_TOKEN = "unit-test-token"; global.fetch = jest.fn(); });
afterEach(() => { global.fetch = originalFetch; if (originalToken === undefined) delete process.env.COURTLISTENER_API_TOKEN; else process.env.COURTLISTENER_API_TOKEN = originalToken; });

test("sends credentials only in the upstream header and normalizes research results", async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200, json: async () => ({ results: [
    { cluster_id: 1, caseName: "Contract case", court: "Example Court", dateFiled: "2024-01-01", citation: ["123 F.3d 456"], absolute_url: "/opinion/1/contract/", opinions: [{ snippet: "A <mark>contract</mark> dispute." }] },
    { cluster_id: 2, absolute_url: "https://malicious.example/opinion/2/" },
  ] }) });
  const result = await searchCaseLaw("contract & notice");
  expect(result.results).toHaveLength(1);
  expect(result.results[0].snippet).toBe("A contract dispute.");
  expect(JSON.stringify(result)).not.toContain("unit-test-token");
  expect(result.results[0]).not.toHaveProperty("label");
  const [url, options] = (fetch as jest.Mock).mock.calls[0];
  expect(url.searchParams.get("q")).toBe("contract & notice");
  expect(url.searchParams.get("type")).toBe("o");
  expect(options.headers.Authorization).toBe("Token unit-test-token");
  expect(options.redirect).toBe("error");
});

test.each([[401, 502], [403, 502], [429, 429], [500, 502]])("handles provider status %s without exposing its body", async (status, expected) => {
  (fetch as jest.Mock).mockResolvedValue({ ok: false, status });
  await expect(searchCaseLaw("contract")).rejects.toMatchObject({ statusCode: expected });
});

test("rejects missing credentials and invalid queries before any network call", async () => {
  await expect(searchCaseLaw("x")).rejects.toMatchObject({ statusCode: 400 });
  delete process.env.COURTLISTENER_API_TOKEN;
  await expect(searchCaseLaw("contract")).rejects.toMatchObject({ statusCode: 503 });
  expect(fetch).not.toHaveBeenCalled();
});

test("reports connection failure and malformed responses safely", async () => {
  (fetch as jest.Mock).mockRejectedValueOnce(new Error("private network detail"));
  await expect(searchCaseLaw("contract")).rejects.toThrow("CourtListener could not be reached");
  (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200, json: async () => null });
  await expect(searchCaseLaw("contract")).rejects.toMatchObject({ statusCode: 502 });
});
