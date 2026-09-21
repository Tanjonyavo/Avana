import "server-only";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import type { InventoryAdjustmentReason, InventoryMovement, InventorySummary } from "@/types/commerce";

export async function listInventorySummary(): Promise<InventorySummary[]> {
  const { data, error } = await getSupabaseAdmin().rpc("admin_inventory_summary");
  if (error) throw new Error(`Inventory summary could not be loaded: ${error.code}`);
  return (
    (data || []) as Array<{ variant_id: string; sold_units: number | string; loss_units: number | string }>
  ).map((row) => ({
    variantId: row.variant_id,
    soldUnits: Number(row.sold_units),
    lossUnits: Number(row.loss_units),
  }));
}

export async function listInventoryMovements(limit = 100): Promise<InventoryMovement[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("inventory_movements")
    .select(
      "id, variant_id, quantity_delta, reason, note, actor, created_at, product_variants(label, sku, products(name))",
    )
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 250)));
  if (error) throw new Error(`Inventory movements could not be loaded: ${error.code}`);
  return (data || []).map((row) => {
    const variantRelation = row.product_variants as unknown as
      | {
          label?: string;
          sku?: string;
          products?: { name?: string } | Array<{ name?: string }> | null;
        }
      | Array<{
          label?: string;
          sku?: string;
          products?: { name?: string } | Array<{ name?: string }> | null;
        }>
      | null;
    const variant = Array.isArray(variantRelation) ? variantRelation[0] : variantRelation;
    const productRelation = variant?.products;
    const product = Array.isArray(productRelation) ? productRelation[0] : productRelation;
    return {
      id: row.id,
      variantId: row.variant_id,
      sku: variant?.sku || "—",
      productName: product?.name || "Produit",
      variantLabel: variant?.label || "Format archivé",
      quantityDelta: Number(row.quantity_delta),
      reason: row.reason,
      note: row.note,
      actor: row.actor,
      createdAt: row.created_at,
    };
  });
}

export async function adjustInventory(input: {
  variantId: string;
  reason: InventoryAdjustmentReason;
  quantity: number;
  note: string;
}) {
  const direction = input.reason === "loss" || input.reason === "correction_remove" ? -1 : 1;
  const { data, error } = await getSupabaseAdmin().rpc("adjust_inventory", {
    variant_id_value: input.variantId,
    quantity_delta_value: input.quantity * direction,
    reason_value: input.reason,
    note_value: input.note,
  });
  if (error) throw new Error(`Inventory could not be adjusted: ${error.message}`);
  return Number(data);
}
