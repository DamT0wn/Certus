import mongoose from "express";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoosePkg from "mongoose";
import jwt from "jsonwebtoken";
import { User } from "../models";
import { register, login } from "../controllers/authController";
import { requireAuth, AuthedRequest } from "../middleware/auth";

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoosePkg.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoosePkg.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
});

function mockRes() {
  const res: any = {};
  res.statusCode = 200;
  res.status = jest.fn().mockImplementation((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn().mockImplementation((data) => {
    res.data = data;
    return res;
  });
  return res;
}

describe("Authentication & Authorization Security", () => {
  describe("register", () => {
    test("registers a new user with hashed password and returns token", async () => {
      const req: any = { body: { email: "counsel@law.com", password: "StrongPassword123!" } };
      const res = mockRes();

      await register(req, res);

      expect(res.statusCode).toBe(201);
      expect(res.data.token).toBeDefined();
      expect(res.data.user.email).toBe("counsel@law.com");

      const saved = await User.findOne({ email: "counsel@law.com" });
      expect(saved).not.toBeNull();
      expect(saved?.passwordHash).not.toBe("StrongPassword123!");
    });

    test("rejects invalid email address format", async () => {
      const req: any = { body: { email: "not-an-email", password: "StrongPassword123!" } };
      const res = mockRes();

      await register(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.data.error).toMatch(/Invalid email format/i);
    });

    test("rejects passwords under 8 characters in length", async () => {
      const req: any = { body: { email: "short@law.com", password: "123" } };
      const res = mockRes();

      await register(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.data.error).toMatch(/at least 8 characters/i);
    });

    test("prevents duplicate registration with HTTP 409", async () => {
      const req: any = { body: { email: "duplicate@law.com", password: "Password123!" } };
      const res1 = mockRes();
      await register(req, res1);
      expect(res1.statusCode).toBe(201);

      const res2 = mockRes();
      await register(req, res2);
      expect(res2.statusCode).toBe(409);
      expect(res2.data.error).toMatch(/already exists/i);
    });
  });

  describe("login", () => {
    test("authenticates valid credentials and issues JWT", async () => {
      const regReq: any = { body: { email: "attorney@court.gov", password: "SecretPassword123!" } };
      await register(regReq, mockRes());

      const loginReq: any = { body: { email: "attorney@court.gov", password: "SecretPassword123!" } };
      const res = mockRes();
      await login(loginReq, res);

      expect(res.statusCode).toBe(200);
      expect(res.data.token).toBeDefined();
      expect(res.data.user.email).toBe("attorney@court.gov");
    });

    test("rejects wrong password with HTTP 401", async () => {
      const regReq: any = { body: { email: "attorney2@court.gov", password: "SecretPassword123!" } };
      await register(regReq, mockRes());

      const loginReq: any = { body: { email: "attorney2@court.gov", password: "WrongPassword" } };
      const res = mockRes();
      await login(loginReq, res);

      expect(res.statusCode).toBe(401);
      expect(res.data.error).toMatch(/Invalid credentials/i);
    });

    test("rejects non-existent email with HTTP 401", async () => {
      const loginReq: any = { body: { email: "unknown@nowhere.com", password: "Password123!" } };
      const res = mockRes();
      await login(loginReq, res);

      expect(res.statusCode).toBe(401);
    });
  });

  describe("requireAuth Middleware", () => {
    test("allows request with valid Bearer token and attaches userId", () => {
      const token = jwt.sign({ userId: "mock_user_123" }, process.env.JWT_SECRET || "dev_secret");
      const req: any = { headers: { authorization: `Bearer ${token}` } };
      const res = mockRes();
      const next = jest.fn();

      requireAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.userId).toBe("mock_user_123");
    });

    test("rejects missing authorization header with HTTP 401", () => {
      const req: any = { headers: {} };
      const res = mockRes();
      const next = jest.fn();

      requireAuth(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });

    test("rejects malformed token prefix with HTTP 401", () => {
      const req: any = { headers: { authorization: "Token 12345" } };
      const res = mockRes();
      const next = jest.fn();

      requireAuth(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });

    test("rejects forged or expired token with HTTP 401", () => {
      const fakeToken = jwt.sign({ userId: "hacker" }, "wrong_secret_key");
      const req: any = { headers: { authorization: `Bearer ${fakeToken}` } };
      const res = mockRes();
      const next = jest.fn();

      requireAuth(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
