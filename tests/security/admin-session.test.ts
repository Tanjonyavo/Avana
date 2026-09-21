import { createHash, createHmac } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { NextRequest } from "next/server";
import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { POST as login } from "@/app/api/admin/login/route";
import { POST as logout } from "@/app/api/admin/logout/route";
import { ADMIN_SESSION_COOKIE, createAdminSessionToken } from "@/lib/admin-auth";
import { isAuthorizedAdminRequest } from "@/lib/server/admin-request";
import { isActiveAdminSession, registerAdminSession } from "@/lib/server/admin-session";
import { requireAdminPageSession } from "@/lib/server/admin-page";

const adapter = vi.hoisted(() => ({
  query: null as null | ((sql: string, args: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>),
  fail: "",
  cookie: "",
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: adapter.cookie }) }) }));
// Transport only. The production authentication, TOTP, rate limit and session
// decisions execute unchanged; SQL rows/functions are the actual migration.
vi.mock("@/lib/server/supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    rpc: async (name: string, args: Record<string, unknown>) => {
      if (adapter.fail === name) return { data: null, error: { code: "TEST_TRANSPORT_UNAVAILABLE" } };
      const signatures: Record<string, string[]> = {
        register_admin_session: [
          "session_hash_value",
          "expires_at_value",
          "mfa_verified_value",
          "previous_hash_value",
        ],
        is_admin_session_active: ["session_hash_value", "require_mfa"],
        revoke_admin_session: ["session_hash_value"],
        check_rate_limit: ["key_value", "maximum_requests", "window_seconds"],
      };
      const names = signatures[name];
      if (!names) throw new Error("Unexpected test RPC");
      try {
        const result = await adapter.query!(
          `select public.${name}(${names.map((_, i) => `$${i + 1}`).join(",")}) as value`,
          names.map((n) => args[n]),
        );
        return { data: result.rows[0].value, error: null };
      } catch {
        return { data: null, error: { code: "TEST_SQL_FAILURE" } };
      }
    },
    from: (table: string) => ({
      insert: async (row: Record<string, unknown>) => {
        if (table !== "audit_logs") throw new Error("Unexpected test insert");
        await adapter.query!(
          "insert into public.audit_logs(actor, action, entity_type, entity_id, metadata) values ($1,$2,$3,$4,$5)",
          [row.actor, row.action, row.entity_type, row.entity_id, row.metadata],
        );
        return { error: null };
      },
    }),
  }),
}));

let db: PGlite;
const origin = "https://avana.example";
const password = "synthetic-admin-password";
const secret = "synthetic-admin-session-test-secret-only";
const totpSecret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
function otp() {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const digest = createHmac("sha1", Buffer.from("12345678901234567890")).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}
function request(endpoint: string, token = "", data?: unknown) {
  return new NextRequest(origin + endpoint, {
    method: "POST",
    headers: { origin, cookie: `${ADMIN_SESSION_COOKIE}=${token}`, "content-type": "application/json" },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
}
async function signIn(previous = "") {
  const response = await login(request("/api/admin/login", previous, { password, otp: otp() }));
  expect(response.status).toBe(200);
  const cookie = response.cookies.get(ADMIN_SESSION_COOKIE)!;
  expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: "strict", maxAge: 7200 });
  return cookie.value;
}
beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(readFileSync("supabase/tests/platform-contract.sql", "utf8"));
  // Load the exact application schema, including the real quota and audit tables.
  await db.exec(readFileSync("supabase/commerce.sql", "utf8"));
  adapter.query = (sql, args) => db.query(sql, args);
}, 60_000);
beforeEach(async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", origin);
  vi.stubEnv("ADMIN_PASSWORD", password);
  vi.stubEnv("SESSION_SECRET", secret);
  vi.stubEnv("ADMIN_TOTP_SECRET", totpSecret);
  vi.stubEnv("SUPABASE_URL", "https://test.invalid");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "synthetic-service-key");
  adapter.fail = "";
  adapter.cookie = "";
  await db.exec("begin; set local role service_role");
});
afterEach(async () => {
  await db.exec("rollback");
  vi.unstubAllEnvs();
});
afterAll(async () => {
  await db.close();
});

describe("persisted administrator sessions", () => {
  it("logs in with MFA, revokes before logout success, and rejects the copied session at every admin API", async () => {
    const token = await signIn();
    adapter.cookie = token;
    await expect(isAuthorizedAdminRequest(request("/api/admin/products", token), true)).resolves.toBe(true);
    await expect(requireAdminPageSession()).resolves.toBeUndefined();
    const response = await logout(request("/api/admin/logout", token));
    expect(response.status).toBe(200);
    expect(response.cookies.get(ADMIN_SESSION_COOKIE)?.maxAge).toBe(0);
    await expect(isActiveAdminSession(token)).resolves.toBe(false);
    await expect(requireAdminPageSession()).rejects.toThrow("NEXT_REDIRECT");
    const root = path.resolve("app/api/admin");
    const files = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory()
          ? files(path.join(dir, e.name))
          : e.name === "route.ts"
            ? [path.join(dir, e.name)]
            : [],
      );
    let checked = 0;
    for (const file of files(root)) {
      const relative = path.relative(root, path.dirname(file)).replaceAll(path.sep, "/");
      if (["login", "logout"].includes(relative)) continue;
      const route = await import(/* @vite-ignore */ file);
      for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
        if (!route[method]) continue;
        const req = new NextRequest(`${origin}/api/admin/${relative}`, {
          method,
          headers: { origin, cookie: `${ADMIN_SESSION_COOKIE}=${token}` },
        });
        const result = await route[method](req, {
          params: Promise.resolve({
            id: "550e8400-e29b-41d4-a716-446655440000",
            module: "suppliers",
            path: ["internal-documents", "file.pdf"],
          }),
        });
        expect(result.status, `${method} ${relative}`).toBe(401);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(20);
  });
  it("does not accept a legacy signed cookie absent from the registry", async () => {
    await expect(isActiveAdminSession(await createAdminSessionToken(secret))).resolves.toBe(false);
  });
  it("stores only a digest and enforces MFA in production", async () => {
    const token = await registerAdminSession(undefined, false);
    const rows = await db.query<{ session_hash: string }>("select * from public.admin_sessions");
    expect(JSON.stringify(rows.rows)).not.toContain(token);
    expect(rows.rows[0].session_hash).toBe(createHash("sha256").update(token).digest("hex"));
    await expect(isActiveAdminSession(token)).resolves.toBe(false);
  });
  it("rotates a session on reauthentication without revoking another device", async () => {
    const old = await registerAdminSession(undefined, true);
    const other = await registerAdminSession(undefined, true);
    const current = await signIn(old);
    await expect(isActiveAdminSession(old)).resolves.toBe(false);
    await expect(isActiveAdminSession(current)).resolves.toBe(true);
    await expect(isActiveAdminSession(other)).resolves.toBe(true);
  });
  it("fails closed when session verification is unavailable", async () => {
    const token = await signIn();
    adapter.fail = "is_admin_session_active";
    await expect(isActiveAdminSession(token)).resolves.toBe(false);
  });
  it("does not confirm logout or delete its cookie when revocation fails", async () => {
    const token = await signIn();
    adapter.fail = "revoke_admin_session";
    const response = await logout(request("/api/admin/logout", token));
    expect(response.status).toBe(503);
    expect(response.cookies.get(ADMIN_SESSION_COOKIE)).toBeUndefined();
    adapter.fail = "";
    await expect(isActiveAdminSession(token)).resolves.toBe(true);
    expect((await logout(request("/api/admin/logout", token))).status).toBe(200);
    await expect(isActiveAdminSession(token)).resolves.toBe(false);
  });
  it("does not issue a cookie if registration fails", async () => {
    adapter.fail = "register_admin_session";
    const response = await login(request("/api/admin/login", "", { password, otp: otp() }));
    expect(response.status).toBe(503);
    expect(response.cookies.get(ADMIN_SESSION_COOKIE)).toBeUndefined();
  });
  it("keeps revocation idempotent", async () => {
    const token = await signIn();
    expect((await logout(request("/api/admin/logout", token))).status).toBe(200);
    expect((await logout(request("/api/admin/logout", token))).status).toBe(200);
    await expect(isActiveAdminSession(token)).resolves.toBe(false);
    expect(
      (
        await db.query<{ total: number }>(
          "select count(*)::integer as total from public.audit_logs where action='admin.logout'",
        )
      ).rows[0].total,
    ).toBe(1);
  });
  it("does not forge admin logout audits for an arbitrary cookie", async () => {
    expect((await logout(request("/api/admin/logout", "invalid-cookie"))).status).toBe(200);
    expect(
      (
        await db.query<{ total: number }>(
          "select count(*)::integer as total from public.audit_logs where action='admin.logout'",
        )
      ).rows[0].total,
    ).toBe(0);
  });
  it.each(["anon", "authenticated"])("denies all session table access and RPCs to %s", async (role) => {
    await db.exec(`set local role ${role}`);
    for (const query of [
      "select * from public.admin_sessions",
      "insert into public.admin_sessions(session_hash,expires_at,mfa_verified) values (repeat('a',64),now()+interval '1 hour',true)",
      "update public.admin_sessions set revoked_at=null",
      "delete from public.admin_sessions",
      "select public.is_admin_session_active(repeat('a',64),false)",
      "select public.revoke_admin_session(repeat('a',64))",
      "select public.register_admin_session(repeat('a',64),now()+interval '1 hour',true,null)",
    ]) {
      await db.exec("savepoint denied");
      await expect(db.exec(query)).rejects.toMatchObject({ code: "42501" });
      await db.exec("rollback to savepoint denied");
    }
  });
  it("enforces database expiry independently of the signed cookie", async () => {
    const token = await signIn();
    await db.exec(
      "update public.admin_sessions set created_at=now()-interval '2 hours', expires_at=now()-interval '1 second'",
    );
    await expect(isActiveAdminSession(token)).resolves.toBe(false);
  });
  it("invalidates existing authority after a credential rotation", async () => {
    const token = await signIn();
    vi.stubEnv("ADMIN_PASSWORD", "different-synthetic-credential");
    await expect(isActiveAdminSession(token)).resolves.toBe(false);
  });
});
