# Continuous integration

`.github/workflows/ci.yml` runs on every pull request, and on pushes to `main`.

| Job | What it does |
| --- | --- |
| Backend lint, unit and integration tests | Starts a real PostgreSQL 17 service, installs with `npm ci`, runs lint and the unit tests, applies every Prisma migration, creates the application role, then runs the integration tests as that role |
| Frontend build and lint | `npm ci`, lint (reported, not blocking yet, see below), then `npm run build` |
| All checks passed | Fails if either job above did not succeed. This is the check to require for merging |

## The database role

The integration tests connect as `bnpl_app`, never as the `postgres` superuser. `backend/scripts/ci/create_app_role.sql` creates it after the migrations have run. It can read and write rows and use sequences, and nothing else: no superuser, no row-level security bypass, no creating databases, roles or tables.

`backend/tests/integration/database.test.js` fails if the connection is a superuser (or can bypass row-level security, create databases or roles, or change the schema). It also checks the unique constraints, the foreign keys, the per-listing lock (`SELECT ... FOR UPDATE` on the listing, as the booking flow does) and that every migration in the repository is applied.

In CI a missing `DATABASE_URL` fails the integration tests. Locally they skip when it is not set.

## Run the integration tests on your own machine

Use a throwaway database. Never point them at staging or production: the tests write and then delete rows.

```bash
# one-off: a local PostgreSQL with an empty database called bnpl_test
export ADMIN_DATABASE_URL=postgresql://postgres:<password>@localhost:5432/bnpl_test
export APP_DB_PASSWORD=local-app-role
export DATABASE_URL=postgresql://bnpl_app:local-app-role@localhost:5432/bnpl_test

cd backend
DATABASE_URL="$ADMIN_DATABASE_URL" npx prisma migrate deploy
psql "$ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -v app_password="$APP_DB_PASSWORD" -f scripts/ci/create_app_role.sql
INTEGRATION_EXPECT_ROLE=bnpl_app npm run test:integration
```

## Blocking merges (needs a repository admin)

A failing check only blocks a merge once GitHub is told it is required. This is a repository setting, not code:

1. Open the repository on GitHub, **Settings**, **Branches**, **Add branch protection rule** (or **Rules**, **Rulesets**) for `main`.
2. Tick **Require a pull request before merging** and **Require status checks to pass before merging**.
3. Search for and select **All checks passed**. It only appears in the list after the workflow has run once, for example on the first pull request that contains this file.
4. Optionally tick **Require branches to be up to date before merging** and **Do not allow bypassing the above settings**.

## Known gaps

- The frontend has existing lint errors. The frontend lint step reports them without failing the check. Remove `continue-on-error: true` from that step in `ci.yml` once `npm run lint` is clean in `frontend`.
- The application role exists only in CI. Production and staging still connect as the `postgres` user that Dokploy creates. Giving them their own role is a separate change: create the role as above, grant it the same rights, and change `DATABASE_URL`. Migrations then need to run as the owner, for example with a separate `DIRECT_URL` or by running `prisma migrate deploy` with the owner's URL.
