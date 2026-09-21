import "server-only";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import type { AdminProduct } from "@/types/commerce";

interface AdminProductRow {
  id: string;
  slug: string;
  name: string;
  short_description: string;
  description: string;
  category: string;
  image: string;
  origin: string;
  region: string;
  species: string;
  lot_code: string;
  status: AdminProduct["status"];
  featured: boolean;
  active: boolean;
  data_status: string;
  audience: Array<"B2C" | "Professionnels">;
  uses: string[];
  storage: string;
  composition: string;
  product_variants: Array<{
    id: string;
    label: string;
    sku: string;
    price_cents: number;
    compare_at_price_cents: number | null;
    stock_on_hand: number;
    stock_reserved: number;
    weight_grams: number;
    active: boolean;
  }>;
}

function mapAdminProduct(row: AdminProductRow): AdminProduct {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortDescription: row.short_description,
    description: row.description,
    category: row.category,
    image: row.image,
    origin: row.origin,
    region: row.region,
    species: row.species,
    lotCode: row.lot_code,
    status: row.status,
    featured: row.featured,
    active: row.active,
    dataStatus: row.data_status,
    audience: Array.isArray(row.audience) ? row.audience : ["B2C"],
    uses: Array.isArray(row.uses) ? row.uses : [],
    storage: row.storage,
    composition: row.composition,
    variants: row.product_variants.map((variant) => ({
      id: variant.id,
      label: variant.label,
      sku: variant.sku,
      priceCents: variant.price_cents,
      compareAtPriceCents: variant.compare_at_price_cents,
      stockOnHand: variant.stock_on_hand,
      stockReserved: variant.stock_reserved,
      weightGrams: variant.weight_grams,
      active: variant.active,
    })),
  };
}

export async function listAdminProducts() {
  const { data, error } = await getSupabaseAdmin()
    .from("products")
    .select("*, product_variants(*)")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Products could not be listed: ${error.code}`);
  return (data as AdminProductRow[]).map(mapAdminProduct);
}

export async function createAdminProduct(input: {
  name: string;
  slug: string;
  category: "Gousses" | "Poudre" | "Coffret";
  shortDescription: string;
  description: string;
  image: string;
  origin: string;
  region: string;
  species: string;
  lotCode: string;
  status: AdminProduct["status"];
  featured: boolean;
  active: boolean;
  audience: Array<"B2C" | "Professionnels">;
  uses: string[];
  storage: string;
  composition: string;
  dataStatus: "Réel" | "Hypothèse" | "Démo";
  variant: {
    label: string;
    sku: string;
    priceCents: number;
    compareAtPriceCents: number | null;
    stockOnHand: number;
    weightGrams: number;
    active: boolean;
  };
}) {
  const { data: lot, error: lotError } = await getSupabaseAdmin()
    .from("lots")
    .select("id")
    .eq("code", input.lotCode)
    .neq("status", "Archivé")
    .maybeSingle();
  if (lotError) throw new Error(`Product lot could not be checked: ${lotError.message}`);
  if (!lot) throw new Error("PRODUCT_LOT_NOT_FOUND");
  const productId = `product-${crypto.randomUUID()}`;
  const variantId = `variant-${crypto.randomUUID()}`;
  const { error: productError } = await getSupabaseAdmin()
    .from("products")
    .insert({
      id: productId,
      slug: input.slug,
      name: input.name,
      eyebrow: input.category,
      category: input.category,
      short_description: input.shortDescription,
      description: input.description,
      image: input.image,
      gallery: [input.image],
      origin: input.origin,
      region: input.region,
      species: input.species,
      lot_code: input.lotCode,
      status: input.status,
      featured: input.featured,
      audience: input.audience,
      uses: input.uses,
      storage: input.storage,
      composition: input.composition,
      data_status: input.dataStatus,
      active: input.active,
    });
  if (productError) throw new Error(`Product could not be created: ${productError.message}`);

  const { error: variantError } = await getSupabaseAdmin().from("product_variants").insert({
    id: variantId,
    product_id: productId,
    label: input.variant.label,
    sku: input.variant.sku,
    price_cents: input.variant.priceCents,
    compare_at_price_cents: input.variant.compareAtPriceCents,
    stock_on_hand: input.variant.stockOnHand,
    stock_reserved: 0,
    weight_grams: input.variant.weightGrams,
    active: input.variant.active,
  });
  if (variantError) {
    await getSupabaseAdmin().from("products").delete().eq("id", productId);
    throw new Error(`Product variant could not be created: ${variantError.message}`);
  }
  if (input.variant.stockOnHand > 0) {
    const { error: movementError } = await getSupabaseAdmin().from("inventory_movements").insert({
      variant_id: variantId,
      quantity_delta: input.variant.stockOnHand,
      reason: "initial",
      note: "Stock initial à la création du produit.",
      actor: "admin",
    });
    if (movementError) {
      await getSupabaseAdmin().from("products").delete().eq("id", productId);
      throw new Error(`Initial inventory could not be recorded: ${movementError.message}`);
    }
  }
  return { productId, variantId };
}

export async function updateAdminProduct(
  productId: string,
  input: {
    name: string;
    slug: string;
    category: "Gousses" | "Poudre" | "Coffret";
    shortDescription: string;
    description: string;
    image: string;
    origin: string;
    region: string;
    species: string;
    lotCode: string;
    status: AdminProduct["status"];
    featured: boolean;
    active: boolean;
    audience: Array<"B2C" | "Professionnels">;
    uses: string[];
    storage: string;
    composition: string;
    dataStatus: "Réel" | "Hypothèse" | "Démo";
  },
) {
  const { data: lot, error: lotError } = await getSupabaseAdmin()
    .from("lots")
    .select("id")
    .eq("code", input.lotCode)
    .neq("status", "Archivé")
    .maybeSingle();
  if (lotError) throw new Error(`Product lot could not be checked: ${lotError.message}`);
  if (!lot) throw new Error("PRODUCT_LOT_NOT_FOUND");
  const { data, error } = await getSupabaseAdmin()
    .from("products")
    .update({
      name: input.name,
      slug: input.slug,
      eyebrow: input.category,
      category: input.category,
      short_description: input.shortDescription,
      description: input.description,
      image: input.image,
      gallery: [input.image],
      origin: input.origin,
      region: input.region,
      species: input.species,
      lot_code: input.lotCode,
      status: input.status,
      featured: input.featured,
      active: input.active,
      audience: input.audience,
      uses: input.uses,
      storage: input.storage,
      composition: input.composition,
      data_status: input.dataStatus,
    })
    .eq("id", productId)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`Product could not be updated: ${error.message}`);
  return Boolean(data);
}

export async function updateAdminVariant(
  variantId: string,
  input: {
    label: string;
    sku: string;
    priceCents: number;
    compareAtPriceCents: number | null;
    stockOnHand: number;
    weightGrams: number;
    active: boolean;
  },
) {
  const { data, error } = await getSupabaseAdmin().rpc("admin_update_variant", {
    variant_id_value: variantId,
    label_value: input.label,
    sku_value: input.sku,
    price_cents_value: input.priceCents,
    compare_at_price_cents_value: input.compareAtPriceCents,
    stock_on_hand_value: input.stockOnHand,
    weight_grams_value: input.weightGrams,
    active_value: input.active,
  });
  if (error) throw new Error(`Variant could not be updated: ${error.message}`);
  return data === true;
}

export async function createAdminVariant(
  productId: string,
  input: {
    label: string;
    sku: string;
    priceCents: number;
    compareAtPriceCents: number | null;
    stockOnHand: number;
    weightGrams: number;
    active: boolean;
  },
) {
  const { data: product, error: productError } = await getSupabaseAdmin()
    .from("products")
    .select("id")
    .eq("id", productId)
    .maybeSingle();
  if (productError) throw new Error(`Product could not be checked: ${productError.code}`);
  if (!product) return null;
  const variantId = `variant-${crypto.randomUUID()}`;
  const { error } = await getSupabaseAdmin().from("product_variants").insert({
    id: variantId,
    product_id: productId,
    label: input.label,
    sku: input.sku,
    price_cents: input.priceCents,
    compare_at_price_cents: input.compareAtPriceCents,
    stock_on_hand: input.stockOnHand,
    stock_reserved: 0,
    weight_grams: input.weightGrams,
    active: input.active,
  });
  if (error) throw new Error(`Product variant could not be created: ${error.message}`);
  if (input.stockOnHand > 0) {
    const { error: movementError } = await getSupabaseAdmin().from("inventory_movements").insert({
      variant_id: variantId,
      quantity_delta: input.stockOnHand,
      reason: "initial",
      note: "Stock initial à la création du format.",
      actor: "admin",
    });
    if (movementError) {
      await getSupabaseAdmin().from("product_variants").delete().eq("id", variantId);
      throw new Error(`Initial inventory could not be recorded: ${movementError.message}`);
    }
  }
  return variantId;
}
