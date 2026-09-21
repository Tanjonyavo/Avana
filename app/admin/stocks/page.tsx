import { requireAdminPageSession } from "@/lib/server/admin-page";
import { Warehouse } from "lucide-react";
import { AdminStockManager } from "@/components/admin-stock-manager";
import { listAdminProducts } from "@/lib/server/admin-products";
import { commerceSettings, isSupabaseAdminConfigured } from "@/lib/server/config";
import { listInventoryMovements, listInventorySummary } from "@/lib/server/inventory";

export const dynamic = "force-dynamic";

export default async function AdminStocksPage() {
  await requireAdminPageSession();
  if (!isSupabaseAdminConfigured()) {
    return (
      <section className="chart-card admin-config-card">
        <Warehouse size={28} />
        <h2>Connectez Supabase.</h2>
        <p>L’inventaire réel remplacera automatiquement cette vue.</p>
      </section>
    );
  }
  const [products, summary, movements] = await Promise.all([
    listAdminProducts().catch(() => []),
    listInventorySummary().catch(() => []),
    listInventoryMovements().catch(() => []),
  ]);
  return (
    <AdminStockManager
      products={products}
      summary={summary}
      movements={movements}
      lowStockThreshold={commerceSettings.lowStockThreshold}
    />
  );
}
