import { createHash, randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import { NextRequest, type NextResponse } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Only Next's request-local cookie adapter is replaced. Route handlers and the
// installed Supabase SSR/Auth SDK make real HTTP requests to this local contract.
// This does not verify a deployed GoTrue email-confirmation policy: autoconfirm
// can populate email_confirmed_at without proving control of the mailbox.
const cookieContext = vi.hoisted(() => ({ values: new Map<string, string>() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [...cookieContext.values].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string, options?: { maxAge?: number }) => {
      if (options?.maxAge === 0) cookieContext.values.delete(name);
      else cookieContext.values.set(name, value);
    },
  }),
}));

const siteOrigin = "https://avana-auth.example.test";
const fixtureEmail = "customer@example.test";
const fixtureUserId = "15535346-36e0-4c4a-bd0b-1f11a094e2f9";
type CookieJar = Map<string, string>;
interface EmailFlow {
  code: string;
  challenge: string;
  challengeMethod: string;
  redirectTo: string;
}

function userFixture() {
  return {
    id: fixtureUserId,
    aud: "authenticated",
    role: "authenticated",
    email: fixtureEmail as string | undefined,
    email_confirmed_at: "2026-01-01T00:00:00.000Z" as string | null,
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    identities: [],
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    is_anonymous: false,
  };
}

function accessTokenFixture() {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
    sub: fixtureUserId,
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}.${Buffer.from(randomUUID()).toString("base64url")}`;
}

function cookieHeader(jar: CookieJar) {
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

function receiveCookies(jar: CookieJar, response: NextResponse) {
  for (const cookie of response.cookies.getAll()) {
    if (cookie.maxAge === 0) jar.delete(cookie.name);
    else jar.set(cookie.name, cookie.value);
  }
}

function expectProtectedCookies(response: NextResponse) {
  const cookies = response.cookies.getAll().filter((cookie) => cookie.value && cookie.maxAge !== 0);
  expect(cookies.length).toBeGreaterThan(0);
  for (const cookie of cookies) {
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.secure).toBe(true);
    expect(cookie.sameSite).toBe("lax");
    expect(cookie.path).toBe("/");
  }
}

describe("customer authentication with the real Supabase SSR SDK", () => {
  let server: Server;
  let authOrigin: string;
  let currentUser = userFixture();
  let requestSequence = 0;
  let userRequests = 0;
  const flows: EmailFlow[] = [];
  const redeemedCodes = new Set<string>();
  const issuedTokens = new Set<string>();
  const tokenRequests: Array<{ code: string; verifier: string }> = [];
  const unexpectedRequests: string[] = [];

  beforeAll(async () => {
    server = createServer((request, response) => {
      void (async () => {
        const url = new URL(request.url || "/", "http://127.0.0.1");
        response.setHeader("Content-Type", "application/json");
        const reply = (status: number, data: unknown) => {
          response.statusCode = status;
          response.end(JSON.stringify(data));
        };
        let raw = "";
        for await (const chunk of request) raw += String(chunk);
        const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};

        if (request.method === "POST" && url.pathname === "/auth/v1/otp") {
          if (body.email !== fixtureEmail) {
            reply(400, { code: "unexpected_email", msg: "Unexpected test recipient" });
            return;
          }
          flows.push({
            code: randomUUID(),
            challenge: String(body.code_challenge || ""),
            challengeMethod: String(body.code_challenge_method || ""),
            redirectTo: url.searchParams.get("redirect_to") || "",
          });
          reply(200, {});
          return;
        }

        if (request.method === "POST" && url.pathname === "/auth/v1/token") {
          const code = String(body.auth_code || "");
          const verifier = String(body.code_verifier || "");
          tokenRequests.push({ code, verifier });
          const flow = flows.find((candidate) => candidate.code === code);
          const challenge = createHash("sha256").update(verifier).digest("base64url");
          if (
            url.searchParams.get("grant_type") !== "pkce" ||
            !flow ||
            flow.challengeMethod !== "s256" ||
            flow.challenge !== challenge ||
            !verifier ||
            redeemedCodes.has(code)
          ) {
            reply(400, { code: "bad_code_verifier", msg: "Invalid or already used PKCE exchange" });
            return;
          }
          redeemedCodes.add(code);
          const accessToken = accessTokenFixture();
          issuedTokens.add(accessToken);
          reply(200, {
            access_token: accessToken,
            refresh_token: randomUUID(),
            token_type: "bearer",
            expires_in: 3600,
            user: currentUser,
          });
          return;
        }

        if (request.method === "GET" && url.pathname === "/auth/v1/user") {
          userRequests += 1;
          const token = request.headers.authorization?.replace(/^Bearer /, "") || "";
          if (!issuedTokens.has(token)) {
            reply(401, { code: "bad_jwt", msg: "Unknown test session" });
            return;
          }
          reply(200, currentUser);
          return;
        }

        unexpectedRequests.push(`${request.method} ${url.pathname}`);
        reply(404, { message: "Unknown local Auth contract endpoint" });
      })().catch(() => {
        unexpectedRequests.push("local Auth contract exception");
        response.statusCode = 500;
        response.end("{}");
      });
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Local Auth server did not bind");
    authOrigin = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", siteOrigin);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", authOrigin);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "local-auth-contract-anon-key");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("SESSION_SECRET", "local-auth-contract-secret-at-least-32-characters");
    currentUser = userFixture();
    cookieContext.values.clear();
    flows.length = 0;
    tokenRequests.length = 0;
    unexpectedRequests.length = 0;
    redeemedCodes.clear();
    issuedTokens.clear();
    userRequests = 0;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    expect(unexpectedRequests).toEqual([]);
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
  });

  async function beginSignIn(jar: CookieJar) {
    const { POST } = await import("../../app/api/auth/magic-link/route");
    const response = await POST(
      new NextRequest(`${siteOrigin}/api/auth/magic-link`, {
        method: "POST",
        headers: {
          Origin: siteOrigin,
          "Content-Type": "application/json",
          Cookie: cookieHeader(jar),
          "x-vercel-forwarded-for": `192.0.2.${++requestSequence}`,
        },
        body: JSON.stringify({ email: fixtureEmail }),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    const flow = flows.at(-1);
    if (!flow) throw new Error("The SDK did not request a magic link");
    receiveCookies(jar, response);
    return { flow, response };
  }

  async function finishSignIn(flow: EmailFlow, jar: CookieJar, next?: string, requestOrigin?: string) {
    const { GET } = await import("../../app/api/auth/callback/route");
    const url = new URL(flow.redirectTo);
    url.searchParams.set("code", flow.code);
    if (next !== undefined) url.searchParams.set("next", next);
    const requestUrl = requestOrigin ? `${requestOrigin}${url.pathname}${url.search}` : url.toString();
    const response = await GET(new NextRequest(requestUrl, { headers: { Cookie: cookieHeader(jar) } }));
    receiveCookies(jar, response);
    return response;
  }

  async function authenticatedJar() {
    const jar: CookieJar = new Map();
    const { flow } = await beginSignIn(jar);
    const response = await finishSignIn(flow, jar);
    expect(response.headers.get("location")).toBe(`${siteOrigin}/compte`);
    cookieContext.values = jar;
    return jar;
  }

  it("uses S256 and a protected verifier cookie to complete a real SDK exchange", async () => {
    const jar: CookieJar = new Map();
    const { flow, response: initiation } = await beginSignIn(jar);
    expect(flow.challengeMethod).toBe("s256");
    expect(flow.challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const redirect = new URL(flow.redirectTo);
    expect(redirect.origin).toBe(siteOrigin);
    expect(redirect.pathname).toBe("/api/auth/callback");
    expect(redirect.searchParams.get("next")).toBe("/compte");
    expect([...jar.keys()].some((name) => name.endsWith("-code-verifier"))).toBe(true);
    expectProtectedCookies(initiation);

    const callback = await finishSignIn(flow, jar);
    expect(callback.headers.get("location")).toBe(`${siteOrigin}/compte`);
    expect(callback.headers.get("cache-control")).toContain("no-store");
    expect(callback.headers.get("referrer-policy")).toBe("no-referrer");
    expectProtectedCookies(callback);
    expect(tokenRequests).toHaveLength(1);
    expect(tokenRequests[0].code).toBe(flow.code);
    expect(createHash("sha256").update(tokenRequests[0].verifier).digest("base64url")).toBe(flow.challenge);
    expect(redeemedCodes.has(flow.code)).toBe(true);

    // HttpOnly affects browser JavaScript, not the server cookie adapter. No
    // browser Supabase client is needed to authenticate the subsequent request.
    cookieContext.values = jar;
    const { getCurrentUser } = await import("../../lib/supabase/server");
    expect((await getCurrentUser())?.email).toBe(fixtureEmail);
    expect(userRequests).toBe(1);
  });

  it("keeps each emailed link bound to its own verifier when two requests overlap", async () => {
    const jar: CookieJar = new Map();
    const first = await beginSignIn(jar);
    const second = await beginSignIn(jar);
    expect(first.flow.challenge).not.toBe(second.flow.challenge);
    expect(new URL(first.flow.redirectTo).searchParams.get("sb_flow_id")).toBeTruthy();

    const firstCallback = await finishSignIn(first.flow, jar);
    expect(firstCallback.headers.get("location")).toBe(`${siteOrigin}/compte`);
    const secondCallback = await finishSignIn(second.flow, jar);
    expect(secondCallback.headers.get("location")).toBe(`${siteOrigin}/compte`);
    expect(redeemedCodes.size).toBe(2);
  });

  it("rejects an intercepted callback without the initiating browser's verifier", async () => {
    const { flow } = await beginSignIn(new Map());
    const attackerJar: CookieJar = new Map();
    const response = await finishSignIn(flow, attackerJar);
    expect(response.headers.get("location")).toBe(`${siteOrigin}/compte?erreur=lien`);
    expect(issuedTokens.size).toBe(0);
    expect(attackerJar.size).toBe(0);
  });

  it("does not issue a session when Auth rejects an already redeemed code", async () => {
    const jar: CookieJar = new Map();
    const { flow } = await beginSignIn(jar);
    const copiedVerifierCookies = new Map(jar);
    await finishSignIn(flow, jar);
    const replay = await finishSignIn(flow, copiedVerifierCookies);
    expect(replay.headers.get("location")).toBe(`${siteOrigin}/compte?erreur=lien`);
    expect(replay.headers.get("cache-control")).toContain("no-store");
    expect(replay.headers.get("referrer-policy")).toBe("no-referrer");
    expect(issuedTokens.size).toBe(1);
    expect(replay.cookies.getAll().filter((cookie) => cookie.value && cookie.maxAge !== 0)).toEqual([]);
  });

  it.each([
    { name: "missing code", query: "" },
    { name: "oversized code", query: `code=${"x".repeat(2049)}` },
    { name: "invalid flow identifier", query: "code=fixture-code&sb_flow_id=invalid%2Fflow" },
  ])("does not cache failed callbacks: $name", async ({ query }) => {
    const { GET } = await import("../../app/api/auth/callback/route");
    const response = await GET(new NextRequest(`${siteOrigin}/api/auth/callback?${query}`));
    expect(response.headers.get("location")).toBe(`${siteOrigin}/compte?erreur=lien`);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(tokenRequests).toHaveLength(0);
  });

  it.each([
    "//attacker.example/collect",
    "https://attacker.example/collect",
    "/\\attacker.example",
    "/api/orders/access",
  ])("keeps an unsafe callback destination on the configured site: %s", async (destination) => {
    const jar: CookieJar = new Map();
    const { flow } = await beginSignIn(jar);
    const response = await finishSignIn(flow, jar, destination, "https://untrusted-request.example");
    expect(response.headers.get("location")).toBe(`${siteOrigin}/compte`);
    expect(redeemedCodes.size).toBe(1);
  });

  it("preserves a permitted local return path after authentication", async () => {
    const jar: CookieJar = new Map();
    const { flow } = await beginSignIn(jar);
    const response = await finishSignIn(flow, jar, "/commande/AVA-2026-000001?suivi=1");
    expect(response.headers.get("location")).toBe(`${siteOrigin}/commande/AVA-2026-000001?suivi=1`);
  });

  it("rejects an authenticated account whose email has not been confirmed", async () => {
    await authenticatedJar();
    currentUser.email_confirmed_at = null;
    const { getCurrentUser } = await import("../../lib/supabase/server");
    expect(await getCurrentUser()).toBeNull();
    expect(userRequests).toBe(1);
  });

  it("rejects anonymous accounts even when an email is present", async () => {
    await authenticatedJar();
    currentUser.is_anonymous = true;
    const { getCurrentUser } = await import("../../lib/supabase/server");
    expect(await getCurrentUser()).toBeNull();
    expect(userRequests).toBe(1);
  });

  it("does not accept user-editable verified metadata as email confirmation", async () => {
    await authenticatedJar();
    currentUser.email_confirmed_at = null;
    currentUser.user_metadata = { email_verified: true, verified: true };
    const { getCurrentUser } = await import("../../lib/supabase/server");
    expect(await getCurrentUser()).toBeNull();
    expect(userRequests).toBe(1);
  });

  it("uses the Auth server's current identity rather than cached cookie user data", async () => {
    await authenticatedJar();
    currentUser.email = "verified-current@example.test";
    const { getCurrentUser } = await import("../../lib/supabase/server");
    expect((await getCurrentUser())?.email).toBe("verified-current@example.test");
    expect(userRequests).toBe(1);
  });

  it("rejects sessions that the Auth server no longer accepts", async () => {
    await authenticatedJar();
    issuedTokens.clear();
    const { getCurrentUser } = await import("../../lib/supabase/server");
    expect(await getCurrentUser()).toBeNull();
    expect(userRequests).toBe(1);
  });
});
