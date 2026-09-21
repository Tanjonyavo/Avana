# Database security regression tests

Run `npm test -- tests/security/database-behavior.test.ts`.

The suite starts an ephemeral in-memory **PostgreSQL engine (PGlite)** and
executes `supabase/commerce.sql`, `supabase/submissions.sql`, and every SQL file
in `supabase/migrations/`, unmodified and in filename order. Each test inserts
synthetic fixtures in a transaction and finishes with `ROLLBACK`.

`platform-contract.sql` supplies the external prerequisites normally owned by
Supabase: `anon`, `authenticated`, `service_role`, the minimal `auth.users`
columns AVANA uses, `auth.uid()` reading the request claim, and the bucket
configuration table. It starts with permissive Supabase-style default grants
so that application revocations and RLS actually have to prevent access.
No application policy, mutation function, constraint, or trigger is mocked.
Tests check the effective database role before accessing private rows.

This validates PostgreSQL policies, privileges, trigger behavior and commerce
transactions against the repository SQL. It does **not** validate deployed
Supabase policy drift, GoTrue JWT verification or settings, PostgREST exposure,
Storage HTTP authorization or Stripe's service.
PGlite is a single-session engine; parallel calls cannot prove multi-connection
locking. The separate native PostgreSQL runner below checks selected lock
interleavings locally. Real Supabase still requires a staging integration run
with two verified test accounts, anon requests and Stripe test mode.

Never run `platform-contract.sql` or `fixtures.sql` on an existing production
database. The test runner does not read a database URL or environment secrets,
does not open a database port, and does not connect to an external service.

## Admin sessions (schema v6)

`npm test -- tests/security/admin-session.test.ts` executes the actual session
RPCs, grants and RLS in PGlite, along with the application login/logout handlers.
It verifies login with TOTP, cookie capture, logout, and rejection of replay on
every protected admin Route Handler plus the shared page guard. The adapter
only transports Supabase RPC calls to local SQL; it does not replace authorization
or revocation with a mock decision. Failure cases, reauthentication rotation,
expiry and audit idempotence are covered. These 13 tests supplement the original
46 database behavior tests; no deployed Supabase session is involved.

## Independent PostgreSQL connections

`npm run test:postgres` requires a **disposable local PostgreSQL cluster**.
The default URL targets `127.0.0.1:55432/avana_security_test`. The optional
`AVANA_TEST_POSTGRES_URL` must retain a loopback host and this entry database
name. Never point it at an SSH tunnel, Supabase, or a cluster containing real
data. The runner creates test roles and its own random database, then drops
only that database. It rejects incompatible existing role attributes.

For a new local test container, after verifying the name is unused:

```powershell
docker run --name avana-security-postgres --label avana.purpose=local-security-test --publish 127.0.0.1:55432:5432 --env POSTGRES_HOST_AUTH_METHOD=trust --env POSTGRES_DB=avana_security_test --tmpfs /var/lib/postgresql/data postgres:17.11-bookworm@sha256:051f7b7b3abdd564d5d1bd1e8c4b9c1b6e77087d1dd22020ede611c096a272e0
```

This foreground command runs an empty, temporary cluster with no application
credentials. Trust authentication is restricted to this local test container;
it is never an instruction for an existing database. In a second terminal,
wait for PostgreSQL readiness and run `npm run test:postgres`. Stop only this
owned container when finished.

The four tests verify actual lock waits through `pg_stat_activity` and use
separate connections to check last-unit contention, retry contention, duplicate
payment/refund effects and committed admin revocation. They do not exhaust all
multi-item, payment/cron or distributed failure interleavings.

## Read-only comparison with an authorized staging

The native runner exports the local metadata fingerprint to
`docs/security/phase2/local-schema.json`. `schema-fingerprint.sql` reads
catalog metadata, not customer records or secrets. Export its result from
an authorized staging SQL Editor, then compare the two files:

```powershell
node scripts/compare-supabase-schema.mjs docs/security/phase2/local-schema.json staging-schema.json
```

Differences or invalid input cause a nonzero exit. The script does not connect
to a database or apply migrations. PostgreSQL versions and platform-managed
policies can cause legitimate differences that must be reviewed. Auth settings,
role memberships and Storage HTTP checks require a separate staging review
before production deployment.
