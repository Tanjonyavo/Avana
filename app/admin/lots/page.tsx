import { requireAdminPageSession } from "@/lib/server/admin-page";
import { Tags } from "lucide-react";
import { AdminLotsManager } from "@/components/admin-lots-manager";
import { isSupabaseAdminConfigured } from "@/lib/server/config";
import { listAdminLots } from "@/lib/server/lots";

export const dynamic = "force-dynamic";

export default async function AdminLotsPage() {
  await requireAdminPageSession();
  const configured = isSupabaseAdminConfigured();
  const lots = configured ? await listAdminLots().catch(() => []) : [];
  return (
    <>
      <div className="admin-topbar">
        <div>
          <span className="small muted">Traçabilité et contrôle</span>
          <h1>Lots</h1>
        </div>
        <div className="admin-actions">
          <span className="presentation-badge">
            {configured ? "Édition active" : "Configuration requise"}
          </span>
        </div>
      </div>
      {!configured ? (
        <section className="chart-card admin-config-card">
          <Tags size={28} />
          <h2>Connectez Supabase.</h2>
          <p>Les lots, étapes publiques et QR apparaîtront ici après application de la migration.</p>
        </section>
      ) : (
        <AdminLotsManager lots={lots} />
      )}
    </>
  );
}
