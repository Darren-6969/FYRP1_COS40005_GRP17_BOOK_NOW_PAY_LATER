import { test } from "node:test";
import assert from "node:assert/strict";
import { hashRequest, readIdempotencyKey } from "../../src/services/idempotency_service.js";

test("readIdempotencyKey requires a valid header", () => {
  assert.throws(
    () => readIdempotencyKey({ get: () => undefined }),
    (error) => error.statusCode === 400 && error.appCode === "IDEMPOTENCY_KEY_REQUIRED"
  );
  assert.throws(
    () => readIdempotencyKey({ get: () => "short" }),
    (error) => error.statusCode === 400 && error.appCode === "IDEMPOTENCY_KEY_REQUIRED"
  );
  assert.equal(readIdempotencyKey({ get: () => "booking-request-123" }), "booking-request-123");
});

test("hashRequest distinguishes different request bodies", () => {
  assert.equal(hashRequest({ bookingId: 12 }), hashRequest({ bookingId: 12 }));
  assert.notEqual(hashRequest({ bookingId: 12 }), hashRequest({ bookingId: 13 }));
});