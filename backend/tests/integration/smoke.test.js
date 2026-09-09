import { test } from 'node:test';
import assert from 'node:assert/strict';

// Integration tests need a real Postgres — never mock the database, and never
// connect as a superuser: a superuser bypasses row-level security and makes
// the tenant isolation tests vacuous. Skips rather than fails when no database
// is configured, so `npm run test:integration` is safe to run locally.
const hasDatabase = Boolean(process.env.DATABASE_URL);

test('integration test runner is wired up', { skip: !hasDatabase && 'DATABASE_URL is not set' }, () => {
  assert.ok(process.env.DATABASE_URL);
});
