import { requireAdminPageSession } from "@/lib/server/admin-page";
import { Megaphone } from "lucide-react";
import { AdminMarketingManager } from "@/components/admin-marketing-manager";
import { isSupabaseAdminConfigured } from "@/lib/server/config";
import { getAdminMarketingData } from "@/lib/server/marketing";

export const dynamic = "force-dynamic";

export default async function AdminMarketingPage() {
  await requireAdminPageSession();
  const configured = isSupabaseAdminConfigured();
  const data = configured ? await getAdminMarketingData().catch(() => null) : null;
  return (
    <>
      <div className="admin-topbar">
        <div>
          <span className="small muted">Consentement et infolettre</span>
          <h1>Marketing</h1>
        </div>
        <div className="admin-actions">
          <span className="presentation-badge">{data ? "Données en direct" : "Configuration requise"}</span>
        </div>
      </div>
      {data ? (
        <AdminMarketingManager data={data} />
      ) : (
        <section className="chart-card admin-config-card">
          <Megaphone size={28} />
          <h2>Marketing non configuré.</h2>
          <p>Appliquez la migration Supabase et configurez Resend.</p>
        </section>
      )}
    </>
  );
}
