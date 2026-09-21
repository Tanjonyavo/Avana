import { createServer, type Server } from "node:http";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

interface NotificationFixture {
  id: string;
  order_id: null;
  kind: string;
  recipient_email: string;
  payload: { campaignId?: string; body: string };
  attempts: number;
  status: string;
  last_error?: string | null;
  scheduled_at?: string;
  sent_at?: string;
}

// The application and installed Supabase SDK run unchanged. A local HTTP
// PostgREST contract supplies database responses; only outbound Resend delivery
// is intercepted. These checks do not claim to test a deployed mail provider.
describe("newsletter consent at delivery", () => {
  let server: Server;
  let databaseOrigin: string;
  let notifications: NotificationFixture[];
  let subscribers: Map<string, string>;
  let subscriberFailure: boolean;
  let cancellationFailure: boolean;
  let withdrawAfterClaim: boolean;
  let consentQueries: string[];
  let unexpectedRequests: string[];
  let sentMessages: Array<{ to: string[]; subject: string }>;
  let campaignStatus: string | undefined;
  const nativeFetch = globalThis.fetch;

  function notification(email = "customer@example.test", kind = "newsletter_campaign") {
    return {
      id: `notification-${notifications.length + 1}`,
      order_id: null,
      kind,
      recipient_email: email,
      payload: { campaignId: kind === "newsletter_campaign" ? "campaign-1" : undefined, body: "AVANA" },
      attempts: 0,
      status: "pending",
    } satisfies NotificationFixture;
  }

  beforeAll(async () => {
    server = createServer(async (request, response) => {
      const url = new URL(request.url || "/", databaseOrigin);
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const rawBody = Buffer.concat(chunks).toString("utf8");
      const body = rawBody ? JSON.parse(rawBody) : undefined;
      const reply = (value: unknown, status = 200) => {
        response.writeHead(status, { "Content-Type": "application/json" });
        response.end(JSON.stringify(value));
      };

      if (url.pathname === "/rest/v1/newsletter_subscribers" && request.method === "GET") {
        const email = url.searchParams.get("email")?.replace(/^eq\./, "") || "";
        consentQueries.push(email);
        if (subscriberFailure) return reply({ code: "XX000", message: "private database detail" }, 500);
        const status = subscribers.get(email);
        return reply(status ? [{ status }] : []);
      }
      if (url.pathname === "/rest/v1/notifications") {
        if (request.method === "GET") {
          if (url.searchParams.get("select") === "status,attempts") {
            return reply(notifications.map(({ status, attempts }) => ({ status, attempts })));
          }
          // The contract honors eligibility filters so a second worker run
          // verifies that terminal cancellations do not become deliverable.
          return reply(
            notifications.filter((row) => ["pending", "failed"].includes(row.status) && row.attempts < 5),
          );
        }
        if (request.method === "PATCH") {
          if (url.searchParams.get("status") === "eq.processing") return reply([]);
          const id = url.searchParams.get("id")?.replace(/^eq\./, "");
          const row = notifications.find((entry) => entry.id === id);
          if (row) {
            if (cancellationFailure && body.attempts === 5) {
              return reply({ code: "XX000", message: "private database detail" }, 500);
            }
            Object.assign(row, body);
            if (body.status === "processing" && withdrawAfterClaim) {
              subscribers.set(row.recipient_email, "unsubscribed");
            }
            return reply(url.searchParams.has("select") ? { id: row.id } : []);
          }
        }
      }
      if (url.pathname === "/rest/v1/marketing_campaigns" && request.method === "PATCH") {
        campaignStatus = body.status;
        return reply([]);
      }
      unexpectedRequests.push(`${request.method} ${url.pathname}`);
      reply({ message: "Unexpected test request" }, 400);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing local test server port");
    databaseOrigin = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => {
    vi.resetModules();
    notifications = [];
    notifications.push(notification());
    subscribers = new Map([["customer@example.test", "subscribed"]]);
    subscriberFailure = false;
    cancellationFailure = false;
    withdrawAfterClaim = false;
    consentQueries = [];
    unexpectedRequests = [];
    sentMessages = [];
    campaignStatus = undefined;
    vi.stubEnv("SUPABASE_URL", databaseOrigin);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "synthetic-database-transport-fixture");
    vi.stubEnv("RESEND_API_KEY", "synthetic-email-transport-fixture");
    vi.stubEnv("RESEND_FROM_EMAIL", "AVANA <noreply@example.test>");
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url === "https://api.resend.com/emails") {
        sentMessages.push(JSON.parse(String(init?.body)));
        return Response.json({ id: "synthetic-email-id" });
      }
      if (url.startsWith(`${databaseOrigin}/`)) return nativeFetch(input, init);
      throw new Error("External networking is forbidden in this test");
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    expect(unexpectedRequests).toEqual([]);
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  it("sends a queued campaign when the recipient is still subscribed", async () => {
    const { processPendingNotifications } = await import("@/lib/server/notifications");
    expect(await processPendingNotifications()).toEqual({ sent: 1, failed: 0, persistenceErrors: 0 });
    expect(consentQueries).toEqual(["customer@example.test"]);
    expect(sentMessages.map((mail) => mail.to)).toEqual([["customer@example.test"]]);
    expect(notifications[0].status).toBe("sent");
    expect(campaignStatus).toBe("sent");
  });

  it("cancels a queued campaign when consent is withdrawn after the worker claims it", async () => {
    withdrawAfterClaim = true;
    const { processPendingNotifications } = await import("@/lib/server/notifications");
    expect(await processPendingNotifications()).toEqual({ sent: 0, failed: 1, persistenceErrors: 0 });
    expect(sentMessages).toEqual([]);
    expect(notifications[0]).toMatchObject({ status: "failed", attempts: 5 });
    expect(notifications[0].last_error).toContain("consentement");
    expect(notifications[0].sent_at).toBeUndefined();
    expect(campaignStatus).toBe("failed");
    expect(await processPendingNotifications()).toEqual({ sent: 0, failed: 0, persistenceErrors: 0 });
    expect(consentQueries).toHaveLength(1);
  });

  it.each(["pending", "unsubscribed", "missing"])(
    "rejects recipients whose current consent is %s",
    async (status) => {
      if (status === "missing") subscribers.clear();
      else subscribers.set("customer@example.test", status);
      const { processPendingNotifications } = await import("@/lib/server/notifications");
      const result = await processPendingNotifications();
      expect(result.sent).toBe(0);
      expect(notifications[0]).toMatchObject({ status: "failed", attempts: 5 });
      expect(sentMessages).toEqual([]);
    },
  );

  it("fails closed on a consent lookup error and keeps a retry without leaking database details", async () => {
    subscriberFailure = true;
    const { processPendingNotifications } = await import("@/lib/server/notifications");
    expect(await processPendingNotifications()).toEqual({ sent: 0, failed: 1, persistenceErrors: 0 });
    expect(sentMessages).toEqual([]);
    expect(notifications[0]).toMatchObject({ status: "failed", attempts: 1 });
    expect(notifications[0].last_error).toBe("Newsletter consent could not be verified");
    expect(Date.parse(notifications[0].scheduled_at || "")).toBeGreaterThan(Date.now());
  });

  it("never sends when saving a cancellation fails", async () => {
    subscribers.clear();
    cancellationFailure = true;
    const { processPendingNotifications } = await import("@/lib/server/notifications");
    expect(await processPendingNotifications()).toEqual({ sent: 0, failed: 1, persistenceErrors: 1 });
    expect(sentMessages).toEqual([]);
  });

  it("keeps operational emails independent of marketing subscription", async () => {
    notifications = [notification("operations@example.test", "low_stock")];
    subscribers.clear();
    const { processPendingNotifications } = await import("@/lib/server/notifications");
    expect(await processPendingNotifications()).toEqual({ sent: 1, failed: 0, persistenceErrors: 0 });
    expect(consentQueries).toEqual([]);
    expect(sentMessages.map((mail) => mail.to)).toEqual([["operations@example.test"]]);
  });
});
