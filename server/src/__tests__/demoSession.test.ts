import type { Response } from "express";
import { DemoSessionRequest, requireDemoSession } from "../middleware/demoSession";

interface MockResponse {
  statusCode: number;
  data: Record<string, unknown>;
  status: jest.Mock;
  json: jest.Mock;
}

function mockResponse(): MockResponse {
  const response = {
    statusCode: 200,
    data: {},
    status: jest.fn(),
    json: jest.fn(),
  } as MockResponse;

  response.status.mockImplementation((statusCode: number) => {
    response.statusCode = statusCode;
    return response;
  });
  response.json.mockImplementation((data: Record<string, unknown>) => {
    response.data = data;
    return response;
  });

  return response;
}

describe("anonymous demo sessions", () => {
  test("accepts a cryptographically random object-id-shaped session", () => {
    const sessionId = "507f1f77bcf86cd799439011";
    const request = {
      headers: { authorization: `Bearer ${sessionId}` },
    } as DemoSessionRequest;
    const response = mockResponse();
    const next = jest.fn();

    requireDemoSession(request, response as unknown as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(request.sessionId).toBe(sessionId);
  });

  test.each([
    ["missing header", undefined, "DEMO_SESSION_REQUIRED"],
    ["malformed prefix", "Token 507f1f77bcf86cd799439011", "DEMO_SESSION_REQUIRED"],
    ["short identifier", "Bearer 1234", "DEMO_SESSION_INVALID"],
    ["non-hex identifier", "Bearer zzzzzzzzzzzzzzzzzzzzzzzz", "DEMO_SESSION_INVALID"],
  ])("rejects %s", (_label, authorization, expectedCode) => {
    const request = { headers: { authorization } } as DemoSessionRequest;
    const response = mockResponse();
    const next = jest.fn();

    requireDemoSession(request, response as unknown as Response, next);

    expect(response.statusCode).toBe(401);
    expect(response.data).toMatchObject({ code: expectedCode });
    expect(next).not.toHaveBeenCalled();
  });
});
