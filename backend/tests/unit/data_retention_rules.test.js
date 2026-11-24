import test from "node:test";
import assert from "node:assert/strict";
import {
  AUDIT_LOG_RETENTION_MONTHS,
  CHAT_RETENTION_MONTHS,
  auditLogWhere,
  chatConversationWhere,
  cutoffBefore,
  purgeExpiredData,
} from "../../src/services/data_retention_rules.js";

const NOW = new Date("2026-11-24T04:00:00Z");

test("retention periods match the Privacy Policy", () => {
  assert.equal(AUDIT_LOG_RETENTION_MONTHS, 24);
  assert.equal(CHAT_RETENTION_MONTHS, 12);
});

test("cutoffs are whole calendar months back", () => {
  assert.equal(cutoffBefore(NOW, 12).toISOString(), "2025-11-24T04:00:00.000Z");
  assert.equal(cutoffBefore(NOW, 24).toISOString(), "2024-11-24T04:00:00.000Z");
});

test("a cutoff from the end of a long month lands at the end of the short one", () => {
  assert.equal(cutoffBefore(new Date("2026-03-31T10:00:00Z"), 1).toISOString(), "2026-02-28T10:00:00.000Z");
  assert.equal(cutoffBefore(new Date("2024-02-29T10:00:00Z"), 12).toISOString(), "2023-02-28T10:00:00.000Z");
});

test("audit logs older than 2 years are selected", () => {
  assert.deepEqual(auditLogWhere(NOW), { createdAt: { lt: new Date("2024-11-24T04:00:00Z") } });
});

test("chats are selected 12 months after the last message, unless a person is still handling them", () => {
  assert.deepEqual(chatConversationWhere(NOW), {
    lastMessageAt: { lt: new Date("2025-11-24T04:00:00Z") },
    escalations: { none: { status: { in: ["OPEN", "ANSWERED"] } } },
  });
});

// A fake model holding ids, honouring only the `id in` delete the service sends.
function fakeModel(ids) {
  const rows = new Set(ids);
  const calls = { find: [], remove: [] };
  return {
    rows,
    calls,
    async findMany({ where, take }) {
      calls.find.push(where);
      return [...rows].sort((a, b) => a - b).slice(0, take).map((id) => ({ id }));
    },
    async deleteMany({ where }) {
      calls.remove.push(where.id.in);
      let count = 0;
      for (const id of where.id.in) if (rows.delete(id)) count += 1;
      return { count };
    },
  };
}

test("a run deletes in batches until nothing is left, and a second run deletes nothing", async () => {
  const db = { auditLog: fakeModel([1, 2, 3, 4, 5]), chatConversation: fakeModel([10, 11]) };

  const first = await purgeExpiredData({ db, now: NOW, batchSize: 2 });
  assert.deepEqual(first, { auditLogsDeleted: 5, chatConversationsDeleted: 2, deleted: 7 });
  assert.deepEqual(db.auditLog.calls.remove, [[1, 2], [3, 4], [5]]);
  assert.deepEqual(db.auditLog.calls.find[0], auditLogWhere(NOW));
  assert.deepEqual(db.chatConversation.calls.find[0], chatConversationWhere(NOW));

  const second = await purgeExpiredData({ db, now: NOW, batchSize: 2 });
  assert.deepEqual(second, { auditLogsDeleted: 0, chatConversationsDeleted: 0, deleted: 0 });
});
