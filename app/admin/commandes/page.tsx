import { requireAdminPageSession } from "@/lib/server/admin-page";
import { Download, ShoppingCart } from "lucide-react";
import { AdminOrdersManager } from "@/components/admin-orders-manager";
import { isSupabaseAdminConfigured } from "@/lib/server/config";
import { listAdminOrders } from "@/lib/server/orders";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  await requireAdminPageSession();
  const orders = isSupabaseAdminConfigured() ? await listAdminOrders(150).catch(() => []) : [];
  return (
    <>
      <div className="admin-topbar">
        <div>
          <span className="small muted">Ventes et exécution</span>
          <h1>Commandes</h1>
        </div>
        <div className="admin-actions">
          <span className="presentation-badge">
            {isSupabaseAdminConfigured() ? "Données serveur" : "Configuration requise"}
          </span>
          <a className="button button-outline button-sm" href="/api/admin/orders/export">
            <Download size={15} /> Exporter
          </a>
        </div>
      </div>
      {!isSupabaseAdminConfigured() ? (
        <section className="chart-card admin-config-card">
          <ShoppingCart size={28} />
          <h2>Connectez Supabase.</h2>
          <p>Appliquez la migration commerce puis renseignez les variables serveur.</p>
        </section>
      ) : (
        <AdminOrdersManager orders={orders} />
      )}
    </>
  );
}
