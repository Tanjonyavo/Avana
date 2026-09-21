import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/commerce.sql", "utf8");
const migration = readFileSync("supabase/migrations/20260911000000_security_v2.sql", "utf8");

describe("database security regression", () => {
  it("enables RLS on every application table", () => {
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
    ];
    for (const table of tables) {
      expect(sql).toContain(`alter table public.${table} enable row level security;`);
    }
  });

  it("prevents direct client writes to commerce and privileged data", () => {
    for (const table of [
      "profiles",
      "customer_addresses",
      "products",
      "product_variants",
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
      "audit_logs",
      "api_rate_limits",
    ]) {
      expect(sql).toContain(
        `revoke insert, update, delete on table public.${table} from anon, authenticated;`,
      );
    }
    expect(sql).toContain("revoke all on table public.operational_records from anon, authenticated;");
    expect(sql).toContain("revoke all on table public.inventory_movements from anon, authenticated;");
  });

  it("keeps privileged transactional functions service-role only", () => {
    const reserveSignature =
      "public.reserve_order(uuid, text, jsonb, text, jsonb, integer, integer, integer, integer)";
    expect(sql).toContain(`revoke all on function ${reserveSignature} from public, anon, authenticated;`);
    expect(sql).toContain(`grant execute on function ${reserveSignature} to service_role;`);
    expect(sql).toContain(
      "revoke all on function public.complete_order_payment(uuid, text, text, text, integer, integer, integer, integer, jsonb) from public, anon, authenticated;",
    );
    expect(sql).toContain(
      "revoke all on function public.update_customer_address(uuid, uuid, jsonb) from public, anon, authenticated;",
    );
  });

  it("ships the checkout race fix in both baseline and incremental migration", () => {
    for (const source of [sql, migration]) {
      expect(source).toContain("orders_checkout_attempt_id_idx");
      expect(source).toContain("pg_advisory_xact_lock");
      expect(source).toContain("CHECKOUT_ATTEMPT_PAYLOAD_MISMATCH");
      expect(source).toContain("STRIPE_SESSION_ALREADY_ATTACHED");
    }
    expect(migration).toContain("select 4;");
    expect(sql).toContain("select 6;");
  });

  it("keeps PDFs out of the public storage bucket", () => {
    const publicBucket = sql.slice(0, sql.indexOf("'avana-private'"));
    expect(publicBucket).toContain("array['image/jpeg', 'image/png', 'image/webp', 'image/avif']");
    expect(publicBucket).not.toContain("application/pdf");
    expect(migration).toContain("where id = 'avana-public';");
  });
});
