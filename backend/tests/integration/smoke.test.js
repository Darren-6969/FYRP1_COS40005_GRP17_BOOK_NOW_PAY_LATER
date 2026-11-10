import { test } from 'node:test';
import assert from 'node:assert/strict';

// Integration tests need a real Postgres — never mock the database, and never
// connect as a superuser: a superuser bypasses row-level security and makes
// the tenant isolation tests vacuous. Skips rather than fails when no database
// is configured, so `npm run test:integration` is safe to run locally.
const hasDatabase = Boolean(process.env.DATABASE_URL);
// In CI a missing database is a failure, not a skip.
const skip = !hasDatabase && !process.env.CI && 'DATABASE_URL is not set';

test('integration test runner is wired up', { skip }, () => {
  assert.ok(process.env.DATABASE_URL);
});
