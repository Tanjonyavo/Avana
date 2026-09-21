import { requireAdminPageSession } from "@/lib/server/admin-page";
import { AdminB2B } from "@/components/admin-b2b";
import { AdminB2BLive } from "@/components/admin-b2b-live";
import { listB2BSubmissions } from "@/lib/server/admin-submissions";
import { isSupabaseAdminConfigured } from "@/lib/server/config";

export const dynamic = "force-dynamic";

export default async function AdminB2BPage() {
  await requireAdminPageSession();
  if (!isSupabaseAdminConfigured()) return <AdminB2B />;
  return <AdminB2BLive leads={await listB2BSubmissions().catch(() => [])} />;
}
