import { describe, expect, it } from "vitest";
import { lots, products } from "../data/demo";
import { readFileSync } from "node:fs";

describe("données de démonstration", () => {
  it("utilise des identifiants explicites pour tous les objets simulés", () => {
    expect(products.every((product) => product.id.includes("demo"))).toBe(true);
    expect(lots.every((lot) => lot.id.includes("demo") && lot.code.startsWith("DEMO-"))).toBe(true);
  });

  it("centralise les prix dans des variantes uniques", () => {
    const skus = products.flatMap((product) => product.variants.map((variant) => variant.sku));
    expect(new Set(skus).size).toBe(skus.length);
    expect(products.every((product) => product.variants.every((variant) => variant.price > 0))).toBe(true);
  });

  it("relie chaque produit à un lot connu", () => {
    const lotCodes = new Set(lots.map((lot) => lot.code));
    expect(products.every((product) => lotCodes.has(product.lotCode))).toBe(true);
  });

  it("réserve atomiquement les webhooks et interdit la modification directe des rôles", () => {
    const sql = readFileSync("supabase/commerce.sql", "utf8");
    expect(sql).toContain("create or replace function public.claim_payment_event");
    expect(sql).toContain("on conflict (provider_event_id) do update");
    expect(sql).toContain("for update of variant");
    expect(sql).toContain("selected_order.status <> 'pending_payment'");
    expect(sql).toContain("CHECKOUT_SESSION_MISMATCH");
    expect(sql).toContain('drop policy if exists "Users update own profile" on public.profiles;');
    expect(sql).not.toContain('create policy "Users update own profile" on public.profiles');
    expect(sql).not.toContain('create policy "Users create own addresses" on public.customer_addresses');
    expect(sql).toContain(
      "revoke insert, update, delete on table public.customer_addresses from anon, authenticated;",
    );
    expect(sql).toContain(
      "alter table public.newsletter_subscribers drop column if exists unsubscribe_token;",
    );
    expect(sql).not.toMatch(/\bunsubscribe_token\s+text/);
    expect(sql).toContain("status in ('processing', 'processed', 'failed')");
  });
});
