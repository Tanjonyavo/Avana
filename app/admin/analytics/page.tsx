import { requireAdminPageSession } from "@/lib/server/admin-page";
import { BarChart3 } from "lucide-react";
import { AdminAnalyticsDashboard } from "@/components/admin-analytics-dashboard";
import { getAdminAnalytics } from "@/lib/server/admin-analytics";
import { isSupabaseAdminConfigured } from "@/lib/server/config";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  await requireAdminPageSession();
  const configured = isSupabaseAdminConfigured();
  const data = configured ? await getAdminAnalytics().catch(() => null) : null;
  return (
    <>
      <div className="admin-topbar">
        <div>
          <span className="small muted">Mesure consentie</span>
          <h1>Analytics</h1>
        </div>
        <div className="admin-actions">
          <span className="presentation-badge">{data ? "Données en direct" : "Configuration requise"}</span>
        </div>
      </div>
      {data ? (
        <AdminAnalyticsDashboard data={data} />
      ) : (
        <section className="chart-card admin-config-card">
          <BarChart3 size={28} />
          <h2>Mesure indisponible.</h2>
          <p>Appliquez la migration Supabase pour activer les agrégats de conversion.</p>
        </section>
      )}
    </>
  );
}
