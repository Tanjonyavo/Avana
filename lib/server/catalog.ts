import "server-only";
import { products as demoProducts } from "@/data/demo";
import { isSupabaseAdminConfigured } from "@/lib/server/config";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { COMMERCE_ENABLED } from "@/lib/site";
import { isSafeSitePathOrHttpsUrl } from "@/lib/security";
import type { CatalogSnapshot } from "@/types/commerce";
import type { Product, ProductCategory } from "@/types";

interface VariantRow {
  id: string;
  label: string;
  sku: string;
  price_cents: number;
  compare_at_price_cents: number | null;
  stock_on_hand: number;
  stock_reserved: number;
  weight_grams: number;
  active: boolean;
}

interface ProductRow {
  id: string;
  slug: string;
  name: string;
  eyebrow: string;
  category: ProductCategory;
  short_description: string;
  description: string;
  image: string;
  gallery: string[];
  origin: string;
  region: string;
  species: string;
  lot_code: string;
  status: Product["status"];
  featured: boolean;
  audience: Product["audience"];
  uses: string[];
  storage: string;
  composition: string;
  data_status: Product["dataStatus"];
  active: boolean;
  product_variants: VariantRow[];
}

function weightLabel(grams: number) {
  return grams >= 1000 ? `${Number((grams / 1000).toFixed(2))} kg` : `${grams} g`;
}

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    eyebrow: row.eyebrow,
    category: row.category,
    shortDescription: row.short_description,
    description: row.description,
    image: isSafeSitePathOrHttpsUrl(row.image) ? row.image : "/images/avana-hero.png",
    gallery: Array.isArray(row.gallery) ? row.gallery.filter(isSafeSitePathOrHttpsUrl) : [],
    origin: row.origin,
    region: row.region,
    species: row.species,
    lotCode: row.lot_code,
    status: row.status,
    featured: row.featured,
    audience: Array.isArray(row.audience) ? row.audience : ["B2C"],
    variants: row.product_variants
      .filter((variant) => variant.active)
      .map((variant) => ({
        id: variant.id,
        label: variant.label,
        sku: variant.sku,
        price: variant.price_cents / 100,
        compareAtPrice:
          variant.compare_at_price_cents === null ? undefined : variant.compare_at_price_cents / 100,
        stock: Math.max(0, variant.stock_on_hand - variant.stock_reserved),
        weight: weightLabel(variant.weight_grams),
      })),
    uses: Array.isArray(row.uses) ? row.uses : [],
    storage: row.storage,
    composition: row.composition,
    dataStatus: row.data_status,
  };
}

export async function getCatalogSnapshot(includeInactive = false): Promise<CatalogSnapshot> {
  if (!COMMERCE_ENABLED) return { products: demoProducts, mode: "demo" };
  if (!isSupabaseAdminConfigured()) {
    return {
      products: [],
      mode: "unconfigured",
      message: "Le catalogue serveur doit être configuré avant d’ouvrir les ventes.",
    };
  }

  let query = getSupabaseAdmin()
    .from("products")
    .select("*, product_variants(*)")
    .order("featured", { ascending: false })
    .order("created_at", { ascending: true });
  if (!includeInactive) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) {
    console.error("AVANA catalog unavailable", { code: error.code });
    return { products: [], mode: "unconfigured", message: "Le catalogue est momentanément indisponible." };
  }

  const products = (data as ProductRow[]).map(mapProduct).filter((product) => product.variants.length > 0);
  return { products, mode: "live" };
}
