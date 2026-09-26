import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { createDemoSession } from "../controllers/demoSessionController";
import { DemoSessionRequest, requireDemoSession } from "../middleware/demoSession";

process.env.JWT_SECRET = "unit-test-session-secret-at-least-32-chars";

interface MockResponse {
  statusCode: number;
  data: Record<string, unknown>;
  headers: Record<string, string>;
  setHeader: jest.Mock;
  status: jest.Mock;
  json: jest.Mock;
}

function mockRes(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    data: {},
    headers: {},
    setHeader: jest.fn(),
    status: jest.fn(),
    json: jest.fn(),
  };
  res.setHeader.mockImplementation((key: string, value: string) => { res.headers[key] = value; });
  res.status.mockImplementation((code: number) => { res.statusCode = code; return res; });
  res.json.mockImplementation((data: Record<string, unknown>) => { res.data = data; return res; });
  return res;
}

describe("anonymous demo sessions", () => {
  test("creates an isolated token without collecting credentials", () => {
    const res = mockRes();
    createDemoSession({} as Request, res as unknown as Response);

    expect(res.statusCode).toBe(201);
    expect(res.data.token).toEqual(expect.any(String));
    expect(res.data.displayName).toMatch(/^Demo [A-F0-9]{4}$/);
    expect(res.data).not.toHaveProperty("email");
    expect(res.headers["Cache-Control"]).toBe("no-store");
  });

  test("accepts a valid demo token and attaches its session id", () => {
    const issued = mockRes();
    createDemoSession({} as Request, issued as unknown as Response);
    const req = { headers: { authorization: `Bearer ${issued.data.token}` } } as DemoSessionRequest;
    const res = mockRes();
    const next = jest.fn();

    requireDemoSession(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.sessionId).toMatch(/^[a-f0-9]{24}$/);
  });

  test.each([
    ["missing header", undefined],
    ["malformed prefix", "Token example"],
    ["forged token", `Bearer ${jwt.sign({ sessionId: "507f1f77bcf86cd799439011", purpose: "certus-demo" }, "wrong-secret-wrong-secret-wrong-secret", { audience: "certus-demo", issuer: "certus-api" })}`],
  ])("rejects %s", (_label, authorization) => {
    const req = { headers: authorization ? { authorization } : {} } as DemoSessionRequest;
    const res = mockRes();
    const next = jest.fn();

    requireDemoSession(req, res as unknown as Response, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});
