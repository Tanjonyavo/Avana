import { requireAdminPageSession } from "@/lib/server/admin-page";
import { AdminMessagesManager } from "@/components/admin-messages-manager";
import { listGeneralSubmissions } from "@/lib/server/admin-submissions";
import { isSupabaseAdminConfigured } from "@/lib/server/config";

export const dynamic = "force-dynamic";

export default async function AdminMessagesPage() {
  await requireAdminPageSession();
  const submissions = isSupabaseAdminConfigured() ? await listGeneralSubmissions().catch(() => []) : [];
  return <AdminMessagesManager submissions={submissions} />;
}
