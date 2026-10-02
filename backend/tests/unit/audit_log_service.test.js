import assert from "node:assert/strict";
import test from "node:test";
import { createAuditLog } from "../../src/services/log_service.js";

test("createAuditLog records actor, snapshots, IP, and entity metadata", async () => {
  let capturedData;
  const tx = {
    auditLog: {
      create: async ({ data }) => {
        capturedData = data;
        return data;
      },
    },
  };
  const req = {
    user: { id: 42 },
    ip: "203.0.113.4",
    socket: { remoteAddress: "127.0.0.1" },
  };

  await createAuditLog(
    {
      req,
      action: "BOOKING_STATUS_FORCED",
      entityType: "Booking",
      entityId: 17,
      before: { status: "PENDING" },
      after: { status: "CANCELLED" },
      details: { reason: "operator request" },
    },
    tx
  );

  assert.deepEqual(capturedData, {
    userId: 42,
    actorId: 42,
    actorType: "USER",
    action: "BOOKING_STATUS_FORCED",
    entityType: "Booking",
    entityId: "17",
    before: { status: "PENDING" },
    after: { status: "CANCELLED" },
    ipAddress: "203.0.113.4",
    details: { reason: "operator request" },
  });
});

test("createAuditLog records system actors and explicit source IPs", async () => {
  let capturedData;
  const tx = {
    auditLog: {
      create: async ({ data }) => {
        capturedData = data;
        return data;
      },
    },
  };

  await createAuditLog(
    {
      action: "STRIPE_CHARGE_REFUNDED",
      entityType: "Booking",
      entityId: 17,
      ipAddress: "198.51.100.12",
      before: { paymentStatus: "PAID" },
      after: { paymentStatus: "FAILED", amountRefunded: 25 },
    },
    tx
  );

  assert.equal(capturedData.userId, null);
  assert.equal(capturedData.actorId, null);
  assert.equal(capturedData.actorType, "SYSTEM");
  assert.equal(capturedData.ipAddress, "198.51.100.12");
});