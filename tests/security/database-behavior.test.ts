import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as stripeWebhook } from "../../app/api/webhooks/stripe/route";
import { claimPaymentEvent } from "../../lib/server/orders";
import { getStripe } from "../../lib/server/stripe";

const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ADMIN = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ORDER_A = "aaaaaaaa-2222-4222-8222-222222222222";
const ADDRESS_B = "bbbbbbbb-1111-4111-8111-111111111111";
const ATTEMPT = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const REQUEST_HASH = "a".repeat(64);
const CONTACT = { email: "buyer@example.invalid", firstName: "Buyer", lastName: "Test" };

const tables = [
  "profiles",
  "customer_addresses",
  "products",
  "product_variants",
  "inventory_movements",
  "lots",
  "orders",
  "order_items",
  "order_status_events",
  "shipments",
  "payment_events",
  "notifications",
  "newsletter_subscribers",
  "submissions",
  "analytics_events",
  "marketing_campaigns",
  "operational_records",
  "audit_logs",
  "api_rate_limits",
] as const;
const internalTables = [
  "lots",
  "payment_events",
  "notifications",
  "newsletter_subscribers",
  "submissions",
  "analytics_events",
  "marketing_campaigns",
  "audit_logs",
  "api_rate_limits",
] as const;
type Role = "anon" | "authenticated" | "service_role";
let db: PGlite;

// Transport adapter only: the production service and Route Handler below run
// unchanged against the real RPCs/rows in PostgreSQL. No authorization decision,
// claim result or event status is fabricated. External HTTP is never used.
vi.mock("@/lib/server/supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    rpc: async (name: string, args: Record<string, unknown>) => {
      const parameters: Record<string, string[]> = {
        claim_payment_event: ["provider_event_id_value", "event_type_value", "payload_value"],
        complete_payment_event: ["provider_event_id_value", "order_id_value"],
        fail_payment_event: ["provider_event_id_value", "error_code_value"],
      };
      const names = parameters[name];
      if (!names) throw new Error(`Unsupported test transport RPC: ${name}`);
      const placeholders = names.map((parameter, index) => `${parameter} => $${index + 1}`);
      const data = await value(
        `select public.${name}(${placeholders.join(", ")}) as result`,
        names.map((key) => args[key]),
      );
      return { data, error: null };
    },
    from: (table: string) => ({
      select: (columns: string) => ({
        eq: (column: string, eventId: string) => ({
          maybeSingle: async () => {
            if (table !== "payment_events" || columns !== "status" || column !== "provider_event_id") {
              throw new Error("Unsupported test transport query");
            }
            const result = await rows(
              "select status from public.payment_events where provider_event_id = $1",
              [eventId],
            );
            return { data: result[0] || null, error: null };
          },
        }),
      }),
    }),
  }),
}));

async function rows(sql: string, params: unknown[] = []) {
  return (await db.query(sql, params)).rows;
}

async function value<T>(sql: string, params: unknown[] = []): Promise<T> {
  const result = await db.query<{ result: T }>(sql, params);
  return result.rows[0].result;
}

async function asRole(role: Role, userId = "") {
  // Role is an internal enum, never user input. SET LOCAL expires at rollback.
  await db.exec(`set local role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
  const effective = await db.query<{ role: string; bypass: boolean; superuser: boolean }>(
    `select current_user as role, rolbypassrls as bypass, rolsuper as superuser
     from pg_roles where rolname = current_user`,
  );
  expect(effective.rows).toEqual([{ role, bypass: role === "service_role", superuser: false }]);
}

async function expectSqlError(
  sql: string,
  params: unknown[] = [],
  expected: { code?: string; message?: string } = {},
) {
  // Expected SQL failures abort a transaction. A real savepoint permits the
  // following assertions without bypassing the failed policy or constraint.
  await db.exec("savepoint expected_denial");
  let caught: unknown;
  try {
    await db.query(sql, params);
  } catch (error) {
    caught = error;
  }
  await db.exec("rollback to savepoint expected_denial; release savepoint expected_denial");
  expect(caught, "PostgreSQL must reject the operation").toBeDefined();
  if (expected.code) expect(caught).toMatchObject({ code: expected.code });
  if (expected.message) expect(caught).toMatchObject({ message: expect.stringContaining(expected.message) });
}

function reserveSql() {
  return `select public.reserve_order($1::uuid, $2, $3::jsonb, 'standard', $4::jsonb, 800, 1600, 6000, 30) as result`;
}

function reservationParams(
  items: unknown = [{ variant_id: "test-v1", quantity: 2 }],
  attempt = ATTEMPT,
  hash = REQUEST_HASH,
) {
  return [attempt, hash, JSON.stringify(CONTACT), JSON.stringify(items)];
}

async function reserve(items?: unknown, attempt?: string, hash?: string) {
  return value<{
    id: string;
    number: string;
    subtotalCents: number;
    shippingCents: number;
    totalCents: number;
  }>(reserveSql(), reservationParams(items, attempt, hash));
}

function paymentSql() {
  return `select public.complete_order_payment($1::uuid, $2, 'pi_test', 'cus_test', $3, $4, $5, $6, '{"country":"CA"}'::jsonb) as result`;
}

async function paidOrder() {
  const order = await reserve();
  await db.query("select public.attach_stripe_session($1, 'cs_test')", [order.id]);
  await db.query(paymentSql(), [order.id, "cs_test", 5000, 800, 0, 5800]);
  return order;
}

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(readFileSync("supabase/tests/platform-contract.sql", "utf8"));
  await db.exec(readFileSync("supabase/commerce.sql", "utf8"));
  await db.exec(readFileSync("supabase/submissions.sql", "utf8"));
  for (const filename of readdirSync("supabase/migrations")
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    await db.exec(readFileSync(`supabase/migrations/${filename}`, "utf8"));
  }
}, 60_000);

beforeEach(async () => {
  await db.exec("begin");
  await db.exec(readFileSync("supabase/tests/fixtures.sql", "utf8"));
});

afterEach(async () => {
  await db.exec("rollback");
});

afterAll(async () => {
  await db?.close();
});

describe("real PostgreSQL RLS and privileges", () => {
  it("enables RLS on all 19 application tables in the deployed schema", async () => {
    const result = await db.query<{ name: string; enabled: boolean }>(
      `select relname as name, relrowsecurity as enabled from pg_class
       where relnamespace = 'public'::regnamespace and relkind = 'r' and relname = any($1)`,
      [tables],
    );
    expect(result.rows).toHaveLength(tables.length);
    expect(result.rows.every((row) => row.enabled)).toBe(true);
  });

  it("exposes schema version 6 only to the server role", async () => {
    await asRole("anon");
    await expectSqlError("select public.commerce_schema_version()", [], { code: "42501" });
    await asRole("service_role");
    expect(await value<number>("select public.commerce_schema_version() as result")).toBe(6);
  });

  it("upgrades a legacy partial notification index with the actual incremental migration", async () => {
    const legacy = new PGlite({ extensions: { pgcrypto } });
    try {
      await legacy.exec(readFileSync("supabase/tests/platform-contract.sql", "utf8"));
      await legacy.exec(readFileSync("supabase/commerce.sql", "utf8"));
      await legacy.exec(readFileSync("supabase/migrations/20260911000000_security_v2.sql", "utf8"));
      // This second, disposable database reproduces schema v4. Its original
      // partial UNIQUE index stays active, so duplicate-key protection remains.
      await legacy.exec("drop index public.notifications_dedupe_upsert_idx");
      const insert = `insert into public.notifications (kind, recipient_email, dedupe_key)
        values ('order_access', 'a@example.invalid', 'legacy-delivery')
        on conflict (dedupe_key) do nothing`;
      await expect(legacy.exec(insert)).rejects.toMatchObject({ code: "42P10" });
      await legacy.exec(`insert into public.notifications (kind, recipient_email)
        values ('order_paid', 'a@example.invalid'), ('order_paid', 'b@example.invalid')`);

      const migration = readFileSync("supabase/migrations/20260914000000_notification_upsert.sql", "utf8");
      await legacy.exec(migration);
      await legacy.exec(migration);
      await legacy.exec(insert);
      await legacy.exec(insert);
      expect(
        (await legacy.query("select count(*)::integer as total from public.notifications")).rows,
      ).toEqual([{ total: 3 }]);
      expect((await legacy.query("select public.commerce_schema_version() as version")).rows).toEqual([
        { version: 5 },
      ]);
    } finally {
      await legacy.close();
    }
  }, 30_000);

  it.each([USER_A, USER_B])(
    "isolates profile, addresses, orders, items, public events and shipments for %s",
    async (user) => {
      await asRole("authenticated", user);
      expect(await rows("select id from public.profiles")).toEqual([{ id: user }]);
      expect(await rows("select user_id from public.customer_addresses")).toEqual([{ user_id: user }]);
      expect(await rows("select customer_id from public.orders")).toEqual([{ customer_id: user }]);
      expect(await value<number>("select count(*)::integer as result from public.order_items")).toBe(1);
      expect(await rows("select message from public.order_status_events")).toEqual([
        { message: "Public event" },
      ]);
      expect(await value<number>("select count(*)::integer as result from public.shipments")).toBe(1);
    },
  );

  it("does not trust admin roles supplied in signup metadata", async () => {
    await asRole("authenticated", USER_A);
    expect(await rows("select role from public.profiles")).toEqual([{ role: "customer" }]);
    expect(await value<boolean>("select public.is_admin() as result")).toBe(false);
  });

  it("preserves the explicit database admin read policy", async () => {
    await asRole("authenticated", ADMIN);
    expect(await value<boolean>("select public.is_admin() as result")).toBe(true);
    expect(await value<number>("select count(*)::integer as result from public.orders")).toBe(3);
  });

  it("hides all customer data from an anonymous caller", async () => {
    await asRole("anon");
    for (const table of [
      "profiles",
      "customer_addresses",
      "orders",
      "order_items",
      "order_status_events",
      "shipments",
    ]) {
      expect(await rows(`select * from public.${table}`), table).toEqual([]);
    }
  });

  it.each(["anon", "authenticated"] as const)(
    "allows public catalog but hides inactive products and variants from %s",
    async (role) => {
      await asRole(role, role === "authenticated" ? USER_A : "");
      expect(await rows("select id from public.products order by id")).toEqual([
        { id: "test-active" },
        { id: "test-waitlist" },
      ]);
      expect(await rows("select id from public.product_variants order by id")).toEqual([
        { id: "test-v-waitlist" },
        { id: "test-v1" },
        { id: "test-v2" },
      ]);
    },
  );

  it.each(["anon", "authenticated"] as const)("denies internal data reads for %s", async (role) => {
    await asRole(role, role === "authenticated" ? USER_A : "");
    for (const table of internalTables) {
      if (table === "submissions") {
        await expectSqlError(`select * from public.${table}`, [], { code: "42501" });
      } else {
        expect(await rows(`select * from public.${table}`), table).toEqual([]);
      }
    }
    for (const table of ["inventory_movements", "operational_records"]) {
      await expectSqlError(`select * from public.${table}`, [], { code: "42501" });
    }
  });

  it.each(["anon", "authenticated"] as const)(
    "denies direct insert/update/delete on all application tables for %s",
    async (role) => {
      await asRole(role, role === "authenticated" ? USER_A : "");
      for (const table of tables) {
        const key = table === "newsletter_subscribers" ? "email" : table === "api_rate_limits" ? "key" : "id";
        await expectSqlError(`insert into public.${table} default values`, [], { code: "42501" });
        await expectSqlError(`update public.${table} set ${key} = ${key}`, [], { code: "42501" });
        await expectSqlError(`delete from public.${table}`, [], { code: "42501" });
      }
    },
  );

  it.each(["anon", "authenticated"] as const)(
    "denies every service-only RPC to %s, including role and payment mutations",
    async (role) => {
      const functions = await db.query<{ signature: string; name: string; nargs: number; callable: boolean }>(
        `select p.oid::regprocedure::text as signature, p.proname as name, p.pronargs as nargs,
         has_function_privilege($1, p.oid, 'EXECUTE') as callable
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.prosecdef and p.proname not in ('is_admin', 'handle_new_user')`,
        [role],
      );
      expect(functions.rows.length).toBeGreaterThanOrEqual(29);
      expect(functions.rows.filter((row) => row.callable)).toEqual([]);
      await asRole(role, role === "authenticated" ? USER_A : "");
      for (const fn of functions.rows) {
        // Function names come solely from the schema under test. All privileged
        // functions have one signature; typed NULLs are unnecessary for lookup.
        expect(fn.name).toMatch(/^[a-z_]+$/);
        await expectSqlError(`select public.${fn.name}(${Array(fn.nargs).fill("null").join(", ")})`, [], {
          code: "42501",
        });
      }
    },
  );

  it("keeps service-role operations available while enforcing address ownership inside the RPC", async () => {
    await asRole("service_role");
    expect(
      await value<boolean>("select public.update_customer_address($1, $2, '{}'::jsonb) as result", [
        USER_A,
        ADDRESS_B,
      ]),
    ).toBe(false);
    expect(
      await value<boolean>("select public.delete_customer_address($1, $2) as result", [USER_A, ADDRESS_B]),
    ).toBe(false);
    expect(await rows("select label from public.customer_addresses where id = $1", [ADDRESS_B])).toEqual([
      { label: "Home B" },
    ]);
    await db.query("select public.update_customer_profile($1, $2, 'Changed safely', null, false)", [
      USER_A,
      "a@example.invalid",
    ]);
    expect(await rows("select display_name, role from public.profiles where id = $1", [USER_A])).toEqual([
      { display_name: "Changed safely", role: "customer" },
    ]);
  });

  it("keeps the private bucket private and restricts allowed types and size", async () => {
    expect(
      await rows(
        "select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'avana-private'",
      ),
    ).toEqual([
      {
        public: false,
        file_size_limit: 8000000,
        allowed_mime_types: ["image/jpeg", "image/png", "image/webp", "image/avif", "application/pdf"],
      },
    ]);
    expect(
      await value<boolean>(
        "select 'application/pdf' = any(allowed_mime_types) as result from storage.buckets where id = 'avana-public'",
      ),
    ).toBe(false);
  });
});

describe("real PostgreSQL commerce transactions", () => {
  beforeEach(async () => {
    await asRole("service_role");
  });

  it("ignores a forged frontend price and snapshots server prices", async () => {
    const order = await reserve([
      { variant_id: "test-v1", quantity: 2, price_cents: 1, unit_price_cents: 1, discount: 100 },
    ]);
    expect(order).toMatchObject({ subtotalCents: 5000, shippingCents: 800, totalCents: 5800 });
    expect(
      await rows(
        "select quantity, unit_price_cents, line_total_cents from public.order_items where order_id = $1",
        [order.id],
      ),
    ).toEqual([{ quantity: 2, unit_price_cents: 2500, line_total_cents: 5000 }]);
  });

  it("reserves a checkout attempt once and rejects replay with changed payload", async () => {
    const first = await reserve();
    expect(await reserve()).toEqual(first);
    expect(
      await value<number>(
        "select stock_reserved as result from public.product_variants where id = 'test-v1'",
      ),
    ).toBe(2);
    await expectSqlError(reserveSql(), reservationParams(undefined, undefined, "b".repeat(64)), {
      message: "CHECKOUT_ATTEMPT_PAYLOAD_MISMATCH",
    });
    expect(
      await value<number>(
        "select count(*)::integer as result from public.orders where checkout_attempt_id = $1",
        [ATTEMPT],
      ),
    ).toBe(1);
  });

  it.each([-1, 0, 11])("rejects invalid quantity %s without leaving reserved stock", async (quantity) => {
    await expectSqlError(reserveSql(), reservationParams([{ variant_id: "test-v1", quantity }]), {
      message: "INVALID_QUANTITY",
    });
    expect(
      await value<number>(
        "select stock_reserved as result from public.product_variants where id = 'test-v1'",
      ),
    ).toBe(0);
  });

  it("rejects duplicate variants atomically", async () => {
    await expectSqlError(
      reserveSql(),
      reservationParams([
        { variant_id: "test-v1", quantity: 1 },
        { variant_id: "test-v1", quantity: 1 },
      ]),
      { message: "DUPLICATE_VARIANT" },
    );
    expect(
      await value<number>(
        "select count(*)::integer as result from public.orders where checkout_attempt_id = $1",
        [ATTEMPT],
      ),
    ).toBe(0);
  });

  it.each(["test-v-inactive", "test-v-parent-inactive", "test-v-waitlist"])(
    "rejects unavailable catalog variant %s",
    async (variant_id) => {
      await expectSqlError(reserveSql(), reservationParams([{ variant_id, quantity: 1 }]), {
        message: "VARIANT_NOT_AVAILABLE",
      });
    },
  );

  it("rolls back earlier line reservations when a later item has insufficient stock", async () => {
    await expectSqlError(
      reserveSql(),
      reservationParams([
        { variant_id: "test-v1", quantity: 2 },
        { variant_id: "test-v2", quantity: 2 },
      ]),
      { message: "INSUFFICIENT_STOCK" },
    );
    expect(
      await value<number>(
        "select stock_reserved as result from public.product_variants where id = 'test-v1'",
      ),
    ).toBe(0);
    expect(
      await value<number>(
        "select count(*)::integer as result from public.orders where checkout_attempt_id = $1",
        [ATTEMPT],
      ),
    ).toBe(0);
  });

  it("prevents a second reservation from consuming already reserved stock", async () => {
    await reserve([{ variant_id: "test-v2", quantity: 1 }]);
    await expectSqlError(
      reserveSql(),
      reservationParams([{ variant_id: "test-v2", quantity: 1 }], "ffffffff-ffff-4fff-8fff-ffffffffffff"),
      { message: "INSUFFICIENT_STOCK" },
    );
    expect(
      await value<number>(
        "select stock_reserved as result from public.product_variants where id = 'test-v2'",
      ),
    ).toBe(1);
  });

  it("refuses replacing the Stripe session attached to an order", async () => {
    const order = await reserve();
    await db.query("select public.attach_stripe_session($1, 'cs_test')", [order.id]);
    await expectSqlError("select public.attach_stripe_session($1, 'cs_other')", [order.id], {
      message: "STRIPE_SESSION_ALREADY_ATTACHED",
    });
  });

  it.each([
    ["cs_wrong", 5000, 800, 0, 5800, "CHECKOUT_SESSION_MISMATCH"],
    ["cs_test", 1, 800, 0, 801, "PAYMENT_TOTAL_MISMATCH"],
    ["cs_test", 5000, 0, 0, 5000, "PAYMENT_TOTAL_MISMATCH"],
    ["cs_test", 5000, 800, 0, -1, "INVALID_PAYMENT_TOTAL"],
    ["cs_test", 5000, 800, 0, 5801, "INVALID_PAYMENT_TOTAL"],
  ])(
    "rejects a mismatched payment (%s, %s, %s, %s, %s)",
    async (session, subtotal, shipping, tax, total, message) => {
      const order = await reserve();
      await db.query("select public.attach_stripe_session($1, 'cs_test')", [order.id]);
      await expectSqlError(paymentSql(), [order.id, session, subtotal, shipping, tax, total], {
        message: String(message),
      });
      expect(
        await rows("select status, payment_status from public.orders where id = $1", [order.id]),
      ).toEqual([{ status: "pending_payment", payment_status: "pending" }]);
      expect(
        await value<number>(
          "select stock_on_hand as result from public.product_variants where id = 'test-v1'",
        ),
      ).toBe(10);
    },
  );

  it("commits stock, payment status and notification exactly once on payment replay", async () => {
    const order = await paidOrder();
    expect(await value<boolean>(paymentSql(), [order.id, "cs_test", 5000, 800, 0, 5800])).toBe(false);
    expect(
      await rows("select stock_on_hand, stock_reserved from public.product_variants where id = 'test-v1'"),
    ).toEqual([{ stock_on_hand: 8, stock_reserved: 0 }]);
    expect(
      await value<number>(
        "select count(*)::integer as result from public.inventory_movements where order_id = $1 and reason = 'sale'",
        [order.id],
      ),
    ).toBe(1);
    expect(
      await value<number>(
        "select count(*)::integer as result from public.notifications where order_id = $1 and kind = 'order_paid'",
        [order.id],
      ),
    ).toBe(1);
  });

  it("allows legitimate Stripe promotions without trusting a frontend total", async () => {
    const order = await reserve();
    await db.query("select public.attach_stripe_session($1, 'cs_test')", [order.id]);
    expect(await value<boolean>(paymentSql(), [order.id, "cs_test", 5000, 800, 0, 4800])).toBe(true);
    expect(
      await value<number>("select discount_cents as result from public.orders where id = $1", [order.id]),
    ).toBe(1000);
  });

  it("releases an unpaid reservation once and rejects subsequent payment", async () => {
    const order = await reserve();
    expect(await value<boolean>("select public.release_order_reservation($1) as result", [order.id])).toBe(
      true,
    );
    expect(await value<boolean>("select public.release_order_reservation($1) as result", [order.id])).toBe(
      false,
    );
    expect(
      await value<number>(
        "select stock_reserved as result from public.product_variants where id = 'test-v1'",
      ),
    ).toBe(0);
    await expectSqlError(paymentSql(), [order.id, "cs_test", 5000, 800, 0, 5800], {
      message: "ORDER_NOT_PAYABLE",
    });
  });

  it("does not release a paid order", async () => {
    const order = await paidOrder();
    expect(await value<boolean>("select public.release_order_reservation($1) as result", [order.id])).toBe(
      false,
    );
  });

  it("keeps partial refund amounts monotone and restocks only once for a completed refund", async () => {
    const order = await paidOrder();
    expect(
      await value<boolean>("select public.mark_order_partially_refunded($1, 1000) as result", [order.id]),
    ).toBe(true);
    expect(
      await value<boolean>("select public.mark_order_partially_refunded($1, 500) as result", [order.id]),
    ).toBe(false);
    expect(
      await value<number>("select refunded_cents as result from public.orders where id = $1", [order.id]),
    ).toBe(1000);
    await expectSqlError("select public.mark_order_partially_refunded($1, 5801)", [order.id], {
      message: "INVALID_REFUND_TOTAL",
    });
    expect(await value<boolean>("select public.mark_order_refunded($1, true) as result", [order.id])).toBe(
      true,
    );
    expect(await value<boolean>("select public.mark_order_refunded($1, true) as result", [order.id])).toBe(
      false,
    );
    expect(
      await value<number>("select stock_on_hand as result from public.product_variants where id = 'test-v1'"),
    ).toBe(10);
    expect(
      await value<number>(
        "select count(*)::integer as result from public.inventory_movements where order_id = $1 and reason = 'refund_restock'",
        [order.id],
      ),
    ).toBe(1);
  });

  it("claims webhook events once, retries failed work, and never reclaims processed events", async () => {
    const claim =
      "select public.claim_payment_event('evt_new', 'checkout.session.completed', '{}'::jsonb) as result";
    expect(await value<boolean>(claim)).toBe(true);
    expect(await value<boolean>(claim)).toBe(false);
    expect(
      await value<boolean>("select public.fail_payment_event('evt_new', 'test_failure') as result"),
    ).toBe(true);
    expect(await value<boolean>(claim)).toBe(true);
    expect(
      await value<boolean>("select public.complete_payment_event('evt_new', $1) as result", [ORDER_A]),
    ).toBe(true);
    expect(await value<boolean>(claim)).toBe(false);
    expect(
      await value<number>(
        "select attempt_count as result from public.payment_events where provider_event_id = 'evt_new'",
      ),
    ).toBe(2);
  });

  it("accepts PostgREST notification upsert conflict targets and deduplicates delivery", async () => {
    // Supabase upsert({ onConflict: 'dedupe_key', ignoreDuplicates: true })
    // uses this conflict target without a partial-index predicate.
    const insert = `insert into public.notifications (kind, recipient_email, dedupe_key)
      values ('order_access', 'a@example.invalid', 'test-delivery')
      on conflict (dedupe_key) do nothing`;
    await db.exec(insert);
    await db.exec(insert);
    expect(
      await value<number>(
        "select count(*)::integer as result from public.notifications where dedupe_key = 'test-delivery'",
      ),
    ).toBe(1);
  });
});

describe("Stripe webhook with real PostgreSQL event claims", () => {
  const webhookSecret = "whsec_local_test_fixture";
  const eventId = "evt_local_database_test";

  beforeEach(async () => {
    await asRole("service_role");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_example");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", webhookSecret);
  });

  afterEach(() => vi.unstubAllEnvs());

  function signedRequest() {
    const payload = JSON.stringify({
      id: eventId,
      object: "event",
      type: "customer.created",
      livemode: false,
      created: Math.floor(Date.now() / 1000),
      data: { object: { id: "cus_local_test", object: "customer" } },
    });
    return new NextRequest("https://avana.example/api/webhooks/stripe", {
      method: "POST",
      body: payload,
      headers: {
        "stripe-signature": getStripe().webhooks.generateTestHeaderString({ payload, secret: webhookSecret }),
      },
    });
  }

  it("distinguishes a busy claim from already completed work", async () => {
    const input = { providerEventId: eventId, eventType: "customer.created" };
    expect(await claimPaymentEvent(input)).toBe("claimed");
    expect(await claimPaymentEvent(input)).toBe("busy");
    await db.query("select public.complete_payment_event($1, null)", [eventId]);
    expect(await claimPaymentEvent(input)).toBe("processed");
  });

  it("returns 503 for an active claim so a crashed worker does not stop provider retries", async () => {
    await db.query("select public.claim_payment_event($1, 'customer.created', '{}'::jsonb)", [eventId]);
    const response = await stripeWebhook(signedRequest());
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(
      await rows("select status, attempt_count from public.payment_events where provider_event_id = $1", [
        eventId,
      ]),
    ).toEqual([{ status: "processing", attempt_count: 1 }]);
  });

  it("recovers an expired processing lease and acknowledges only after completion", async () => {
    await db.query("select public.claim_payment_event($1, 'customer.created', '{}'::jsonb)", [eventId]);
    await db.query(
      "update public.payment_events set updated_at = now() - interval '11 minutes' where provider_event_id = $1",
      [eventId],
    );
    const response = await stripeWebhook(signedRequest());
    expect(response.status).toBe(200);
    expect(
      await rows("select status, attempt_count from public.payment_events where provider_event_id = $1", [
        eventId,
      ]),
    ).toEqual([{ status: "processed", attempt_count: 2 }]);
    const replay = await stripeWebhook(signedRequest());
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({ received: true, duplicate: true });
  });

  it("rejects an unsigned webhook before claiming an event", async () => {
    const response = await stripeWebhook(
      new NextRequest("https://avana.example/api/webhooks/stripe", {
        method: "POST",
        body: JSON.stringify({ id: eventId }),
      }),
    );
    expect(response.status).toBe(400);
    expect(
      await value<number>(
        "select count(*)::integer as result from public.payment_events where provider_event_id = $1",
        [eventId],
      ),
    ).toBe(0);
  });
});
