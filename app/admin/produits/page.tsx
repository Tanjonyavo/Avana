import { requireAdminPageSession } from "@/lib/server/admin-page";
import { Package } from "lucide-react";
import { AdminProductsManager } from "@/components/admin-products-manager";
import { listAdminProducts } from "@/lib/server/admin-products";
import { isSupabaseAdminConfigured } from "@/lib/server/config";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  await requireAdminPageSession();
  const products = isSupabaseAdminConfigured() ? await listAdminProducts().catch(() => []) : [];
  return (
    <>
      <div className="admin-topbar">
        <div>
          <span className="small muted">Catalogue centralisé</span>
          <h1>Produits et stocks</h1>
        </div>
        <div className="admin-actions">
          <span className="presentation-badge">
            {isSupabaseAdminConfigured() ? "Édition active" : "Configuration requise"}
          </span>
        </div>
      </div>
      {!isSupabaseAdminConfigured() ? (
        <section className="chart-card admin-config-card">
          <Package size={28} />
          <h2>Connectez Supabase.</h2>
          <p>Le catalogue réel apparaîtra ici après application de la migration.</p>
        </section>
      ) : (
        <AdminProductsManager products={products} />
      )}
    </>
  );
}
