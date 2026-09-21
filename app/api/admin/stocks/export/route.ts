import { NextRequest, NextResponse } from "next/server";
import { listAdminProducts } from "@/lib/server/admin-products";
import { isAuthorizedAdminRequest } from "@/lib/server/admin-request";
import { csvDocument } from "@/lib/server/csv";
import { listInventorySummary } from "@/lib/server/inventory";
import { recordAuditLog } from "@/lib/server/orders";

export async function GET(request: NextRequest) {
  if (!(await isAuthorizedAdminRequest(request))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const [products, summary] = await Promise.all([listAdminProducts(), listInventorySummary()]);
  const summaryByVariant = new Map(summary.map((item) => [item.variantId, item]));
  const rows = [
    [
      "Produit",
      "Lot",
      "SKU",
      "Format",
      "Prix CAD",
      "Physique",
      "Réservé",
      "Disponible",
      "Vendu",
      "Pertes",
      "Poids g",
      "Actif",
    ],
    ...products.flatMap((product) =>
      product.variants.map((variant) => {
        const metrics = summaryByVariant.get(variant.id);
        return [
          product.name,
          product.lotCode,
          variant.sku,
          variant.label,
          (variant.priceCents / 100).toFixed(2),
          variant.stockOnHand,
          variant.stockReserved,
          variant.stockOnHand - variant.stockReserved,
          metrics?.soldUnits || 0,
          metrics?.lossUnits || 0,
          variant.weightGrams,
          variant.active,
        ];
      }),
    ),
  ];
  await recordAuditLog({
    action: "stocks.exported",
    entityType: "stock",
    entityId: "all",
    metadata: { count: rows.length - 1 },
  });
  return new NextResponse(csvDocument(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="avana-stocks-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
