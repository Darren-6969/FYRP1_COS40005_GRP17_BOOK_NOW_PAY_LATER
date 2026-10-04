import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import app from "../../src/app.js";
import { errorHandler } from "../../src/middlewares/errorHandler.js";
import { requestLogger } from "../../src/middlewares/logger_middleware.js";

function createResponse() {
  return {
    headers: {},
    statusCode: 200,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    on() {},
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("normalizes direct JSON errors and assigns a response request ID", () => {
  const req = { method: "POST", originalUrl: "/api/bookings" };
  const res = createResponse();

  requestLogger(req, res, () => {});
  res.status(422).json({ message: "Validation failed", fieldErrors: { email: ["Invalid"] } });

  assert.match(req.requestId, /^[0-9a-f-]{36}$/i);
  assert.equal(res.headers["X-Request-ID"], req.requestId);
  assert.deepEqual(res.body, {
    code: "UNPROCESSABLE_ENTITY",
    message: "Validation failed",
    request_id: req.requestId,
    details: { fieldErrors: { email: ["Invalid"] } },
  });
});

test("reuses a valid incoming request ID for backend correlation", () => {
  const requestId = "b3b7ba3d-ea83-4d38-9e2c-80ff8351b64f";
  const req = {
    headers: { "x-request-id": requestId },
    method: "GET",
    originalUrl: "/api/bookings",
  };
  const res = createResponse();

  requestLogger(req, res, () => {});

  assert.equal(req.requestId, requestId);
  assert.equal(res.headers["X-Request-ID"], requestId);
});

test("logs thrown errors with the same request ID returned to clients", () => {
  const req = { method: "GET", originalUrl: "/api/missing" };
  const res = createResponse();
  const error = Object.assign(new Error("Not found"), { statusCode: 404, appCode: "NOT_FOUND" });
  const originalConsoleError = console.error;
  let log;

  requestLogger(req, res, () => {});
  console.error = (entry) => { log = entry; };
  try {
    errorHandler(error, req, res, () => {});
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(res.body.code, "NOT_FOUND");
  assert.equal(res.body.request_id, req.requestId);
  assert.equal(log.request_id, req.requestId);
  assert.equal(error.request_id, req.requestId);
});

test("unmatched routes return the unified 404 contract", async () => {
  const response = await request(app).get("/api/__missing_contract_test__");

  assert.equal(response.status, 404);
  assert.equal(response.body.code, "NOT_FOUND");
  assert.equal(response.body.message, "Route not found");
  assert.match(response.body.request_id, /^[0-9a-f-]{36}$/i);
  assert.equal(response.headers["x-request-id"], response.body.request_id);
});