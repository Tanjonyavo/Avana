# Security Review: Avana project web

## Scope

Whole current AVANA directory snapshot; first-party application TS/TSX, SQL, scripts and configuration reviewed. Explicit vendor/generated, static asset and deployed-platform limitations mean overall coverage is partial.

- Scan mode: repository
- Target kind: directory_snapshot
- Target ID: target_sha256_a32e495f6029b94e76f3800509813d0ec0f37355f18706307992d48494ff42c5
- Snapshot digest: codex-security-snapshot/v1:sha256:3d674712bd44db596037b7d7bb5f11653dc4050802c393be1c00f0ac3b194e08
- Inventory strategy: directory
- Included paths: .
- Excluded paths: none
- Runtime or test status: 141 Vitest tests and 18 production Playwright tests passed; TypeScript, lint, formatting and Next build passed. npm audit: zero known vulnerabilities.

Limitations and exclusions:

- Snapshot includes 37297 files, largely generated/vendor; not every snapshot file was reviewed.
- No Git metadata/history available.
- Live Supabase policies/Auth/Storage, Stripe/Resend and production hosting configuration not validated.
- PGlite tests do not simulate independent database connections or the production Supabase HTTP services.
- Excluded node_modules/\*\*: Dependency advisories, lockfile and installation scripts checked separately; vendor implementation not exhaustively audited.
- Excluded .next/\*\*: Production build, browser CSP checks and client secret scan; generated implementation not exhaustively audited.

### Scan Summary

| Field               | Value                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Scan outcome        | completed                                                                                                                       |
| Reportable findings | 1                                                                                                                               |
| Severity mix        | medium: 1                                                                                                                       |
| Confidence mix      | high: 1                                                                                                                         |
| Coverage            | partial                                                                                                                         |
| Validation mode     | Independent source baseline, focused SQL/payments review, independent final source rescan, actual local behavioral verification |

Canonical artifacts: `scan-manifest.json`, `findings.json`, and `coverage.json`. This report is a deterministic projection of those files.

## Threat Model

AVANA Next.js 16.3.5 / React 19.3 storefront and administration. Route Handlers call server-only Supabase service_role clients and transactional PostgreSQL RPCs; Stripe hosted checkout, signed webhooks and Resend notification delivery. Vercel configuration exists, actual cloud not configured here (package.json; lib/server/config.ts; vercel.json).

### Assets

- Customer PII, orders, addresses and exports (lib/server/customer-account.ts; lib/server/orders.ts).
- Inventory/payment integrity and notifications (supabase/commerce.sql).
- Admin credentials, TOTP/session tokens and server provider credentials (lib/admin-auth.ts; lib/server/config.ts).

### Trust Boundaries

- Browser → customer routes: Supabase auth.getUser, email-confirmation guard, ownership filters, Origin and Zod (lib/supabase/server.ts:29; app/api/account/profile/route.ts).
- Admin browser → API: HMAC token, 2h lifetime, TOTP at login, Origin on mutation (lib/admin-auth.ts:61; lib/server/admin-request.ts:6).
- Direct Supabase anon/authenticated → PostgreSQL: RLS and explicit function/table grants; service_role bypasses RLS only server-side (supabase/commerce.sql; lib/server/supabase-admin.ts).
- Stripe → webhook: real SDK signature/timestamp/mode validation, persistent claim, server order correlation (app/api/webhooks/stripe/route.ts:112).
- Admin upload → private storage/public publication: streamed bounds, type checks, constrained paths, attachment sandbox (lib/upload-security.ts; lib/server/private-file-response.ts).

### Attacker Capabilities

- Unauthenticated callers control request bodies, params, headers and their own browser storage.
- Authenticated ordinary customers may call direct Supabase APIs and choose target IDs, but cannot set profile roles or execute privileged RPCs.
- An attacker with a previously copied valid admin cookie retains its authority until expiry; no cookie theft vulnerability established.

### Security Objectives

- Preserve business functionality and existing UI while preventing cross-customer disclosure and privileged operations.
- Prices and inventory changes must derive from server/SQL; payments and notifications must survive duplicate deliveries and interrupted work.
- No secret values in report/logs/client bundle; retain actual controls and honest test limitations.

### Assumptions

- Local runtime has no configured Supabase, Stripe or Resend credentials; remote policies/settings and real checkout are not validated.
- Confirm Email must be enabled in Supabase: autoconfirm can populate email_confirmed_at without mailbox proof (local Auth SDK plus provider configuration prerequisite).
- Vercel must overwrite trusted forwarding headers; arbitrary self-hosted forwarding headers would not establish trustworthy IP rate limits.
- All application TS/TSX source reviewed by independent baseline/rescan and focused SQL/payment reviewer; vendor/generated/binary files not line-by-line reviewed.
- PGlite executes actual PostgreSQL RLS/RPCs but models platform auth/storage schema prerequisites; not a deployed Supabase or multi-connection race test.

## Findings

| Finding                                                               | Severity | Confidence | Detailed write-up |
| --------------------------------------------------------------------- | -------- | ---------- | ----------------- |
| [Administrator logout leaves copied session tokens valid](#finding-1) | medium   | high       | inline below      |

### Confidence Scale

| Label  | Meaning                                                                                  |
| ------ | ---------------------------------------------------------------------------------------- |
| high   | Direct evidence supports the finding with no material unresolved blocker.                |
| medium | Evidence supports a plausible issue, but material runtime or reachability proof remains. |
| low    | Evidence is incomplete and the item is retained only for explicit follow-up.             |

<a id="finding-1"></a>

### [1] Administrator logout leaves copied session tokens valid

| Field                | Value                                                                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Severity             | medium                                                                                                                                    |
| Confidence           | high                                                                                                                                      |
| Confidence rationale | Logout, common authorization helper and token verifier fully reviewed; no session persistence or revocation lookup exists.                |
| Category             | authentication                                                                                                                            |
| CWE                  | CWE-613                                                                                                                                   |
| Affected lines       | app/api/admin/logout/route.ts:18-20, lib/server/admin-request.ts:6-12, lib/admin-auth.ts:70-93, app/api/admin/orders/export/route.ts:6-10 |

#### Summary

Logging out clears the administrator's browser cookie but does not revoke its server-side authority. An attacker who already copied a valid token can retain access to admin data and mutations until the original two-hour expiry.

#### Root Cause

The administrator session is a signed role/expiry/nonce tuple. Logout removes the requesting browser's cookie and writes an audit event, but neither operation changes verification state. Later protected routes read a supplied cookie and call the stateless HMAC/expiry verifier, which still accepts the original token.

**Logout changes only browser-held token state** — `app/api/admin/logout/route.ts:18-20`

The response expires this browser's cookie. The preceding audit event does not revoke the signed nonce for other token holders.

```typescript
const response = NextResponse.json({ ok: true });
response.cookies.set({ name: ADMIN_SESSION_COOKIE, value: "", maxAge: 0, path: "/" });
return response;
```

**Protected routes forward the supplied cookie to signature verification** — `lib/server/admin-request.ts:6-12`

A copied cookie reaches the same HMAC verifier after logout; no revocation state is consulted.

```typescript
export async function isAuthorizedAdminRequest(request: NextRequest, mutation = false) {
  if (!isAdminAuthConfigured()) return false;
  if (mutation && !hasValidOrigin(request)) return false;
  return verifyAdminSessionToken(
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
    process.env.SESSION_SECRET,
  );
```

**Valid copied token retains customer export authority** — `app/api/admin/orders/export/route.ts:6-10`

A request accepted by the unchanged verifier reaches the privileged order export. The same helper protects other administrator mutations.

```typescript
export async function GET(request: NextRequest) {
  if (!(await isAuthorizedAdminRequest(request))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const orders = await listAdminOrders(250);
```

#### Validation

Confirmed logout only expires the response cookie; the common guard forwards any supplied cookie to signature/expiry validation without persisted session or revocation lookup. Previously copied, unexpired tokens therefore reach administrator sinks after logout.

Validation method: independent baseline plus parent static source trace and final source rescan

**Logout changes only browser-held token state** — `app/api/admin/logout/route.ts:18-20`

The response expires this browser's cookie. The preceding audit event does not revoke the signed nonce for other token holders.

```typescript
const response = NextResponse.json({ ok: true });
response.cookies.set({ name: ADMIN_SESSION_COOKIE, value: "", maxAge: 0, path: "/" });
return response;
```

**Protected routes forward the supplied cookie to signature verification** — `lib/server/admin-request.ts:6-12`

A copied cookie reaches the same HMAC verifier after logout; no revocation state is consulted.

```typescript
export async function isAuthorizedAdminRequest(request: NextRequest, mutation = false) {
  if (!isAdminAuthConfigured()) return false;
  if (mutation && !hasValidOrigin(request)) return false;
  return verifyAdminSessionToken(
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
    process.env.SESSION_SECRET,
  );
```

**Valid copied token retains customer export authority** — `app/api/admin/orders/export/route.ts:6-10`

A request accepted by the unchanged verifier reaches the privileged order export. The same helper protects other administrator mutations.

```typescript
export async function GET(request: NextRequest) {
  if (!(await isAuthorizedAdminRequest(request))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const orders = await listAdminOrders(250);
```

Assertions:

- No source-backed cookie theft is claimed.
- The signed nonce is never revoked on logout.
- Changing any signing credential invalidates existing tokens.

Limitations:

- No deployed administrator account was accessed.
- Local tests validate signed/tampered token behavior; no real stolen cookie is used.

#### Dataflow

Supplied admin cookie → isAuthorizedAdminRequest → verifyAdminSessionToken → privileged data or mutation.

- **Source:** Previously captured administrator cookie

- **Sink:** Administrator order export and protected mutations

- **Outcome:** Retained administrator access after intended session termination

**Protected routes forward the supplied cookie to signature verification** — `lib/server/admin-request.ts:6-12`

A copied cookie reaches the same HMAC verifier after logout; no revocation state is consulted.

```typescript
export async function isAuthorizedAdminRequest(request: NextRequest, mutation = false) {
  if (!isAdminAuthConfigured()) return false;
  if (mutation && !hasValidOrigin(request)) return false;
  return verifyAdminSessionToken(
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
    process.env.SESSION_SECRET,
  );
```

**Valid copied token retains customer export authority** — `app/api/admin/orders/export/route.ts:6-10`

A request accepted by the unchanged verifier reaches the privileged order export. The same helper protects other administrator mutations.

```typescript
export async function GET(request: NextRequest) {
  if (!(await isAuthorizedAdminRequest(request))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const orders = await listAdminOrders(250);
```

#### Reachability

Requires prior possession of a genuine signed administrator token; logout is not an authentication bypass or cookie theft primitive.

- **Attacker:** Holder of a previously copied administrator cookie

- **Entry point:** Protected /api/admin endpoints

- **Outcome:** Authority persists for the remaining two-hour lifetime

Preconditions:

- Configured admin authentication
- A genuine unexpired administrator cookie obtained before logout

**Logout changes only browser-held token state** — `app/api/admin/logout/route.ts:18-20`

The response expires this browser's cookie. The preceding audit event does not revoke the signed nonce for other token holders.

```typescript
const response = NextResponse.json({ ok: true });
response.cookies.set({ name: ADMIN_SESSION_COOKIE, value: "", maxAge: 0, path: "/" });
return response;
```

**Protected routes forward the supplied cookie to signature verification** — `lib/server/admin-request.ts:6-12`

A copied cookie reaches the same HMAC verifier after logout; no revocation state is consulted.

```typescript
export async function isAuthorizedAdminRequest(request: NextRequest, mutation = false) {
  if (!isAdminAuthConfigured()) return false;
  if (mutation && !hasValidOrigin(request)) return false;
  return verifyAdminSessionToken(
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value,
    process.env.SESSION_SECRET,
  );
```

**Valid copied token retains customer export authority** — `app/api/admin/orders/export/route.ts:6-10`

A request accepted by the unchanged verifier reaches the privileged order export. The same helper protects other administrator mutations.

```typescript
export async function GET(request: NextRequest) {
  if (!(await isAuthorizedAdminRequest(request))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const orders = await listAdminOrders(250);
```

#### Severity

**Medium** — High-impact administrator authority, but requires prior theft of an authenticated cookie; no theft primitive identified. Two-hour lifetime, protected cookies and rotation limit exposure.

Additional runtime or deployment evidence could raise or lower this severity.

#### Remediation

Persist hashed administrator session identifiers with expiry/revocation state, require an active session in page/API guards, and revoke it before confirming logout. Review and approve the persistent-session architecture and deployment migration first.

Tests:

- A token accepted before logout is rejected by page and API guards immediately afterward.
- Failure of revocation storage must not silently authorize a revoked session.

Preventive controls:

- Retain HttpOnly/Secure/SameSite protections, TOTP login, short expiration and credential rotation.

## Reviewed Surfaces

| Surface                                              | Risk Area    | Outcome         | Notes                                                                                                                                                                                                        |
| ---------------------------------------------------- | ------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Administrator session termination                    | not recorded | Reported        | Copied tokens remain valid after logout; auth helper and export sink reviewed.                                                                                                                               |
| Customer authentication and ownership                | not recorded | No issue found  | getUser verified identity, confirmation guard, PKCE flow cookies, server ownership and public DTOs reviewed. 17 SDK contract tests; deployed Confirm Email required.                                         |
| PostgreSQL RLS and commerce transactions             | not recorded | No issue found  | All 19 application tables and SQL RPCs reviewed. 46 real PostgreSQL tests cover A/B/anon, denial of privileged writes/functions, price forgery, inventory/payment/refund idempotence and v4→v5 migration.    |
| Webhook cryptography and interrupted work            | not recorded | No issue found  | Real Stripe signatures/timestamp/mode verified locally; busy503 and completed200 via actual PostgreSQL claims; source correspondence reviewed.                                                               |
| Browser serialization, uploads and private documents | not recorded | No issue found  | All first-party app/components/hooks/lib/data/types TS/TSX source reviewed in baseline plus final independent pass. JSON-LD escaped; uploads bounded; private attachments sandboxed.                         |
| Newsletter consent and queue durability              | not recorded | No issue found  | Consent rechecked before queued campaign sends; fail closed lookup; compatible upsert unique index. HTTP contract tests, not actual Resend delivery.                                                         |
| Deployment and platform settings                     | not recorded | Needs follow-up | Supabase/Stripe/Resend credentials absent locally, no cloud RLS/Auth/Storage or live commerce verification. Direct Auth abuse controls and database privileged-role attribution must be reviewed in staging. |
| Dependency and agent environment                     | not recorded | Needs follow-up | npm audit0 known advisories; AgentShield triaged. Host Guard inactive and mutable MCP package outside repository scope documented separately.                                                                |

## Open Questions And Follow Up

- Cloud settings/RLS deployment unavailable.
- Git history unavailable.
- Binary/static assets and CSS not fully source-audited.
