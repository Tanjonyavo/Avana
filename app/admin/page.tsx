import { requireAdminPageSession } from "@/lib/server/admin-page";
import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin-dashboard";
import { AdminLiveDashboard } from "@/components/admin-live-dashboard";
import { listAdminProducts } from "@/lib/server/admin-products";
import { getSubscriberCount, getSubmissionMetrics } from "@/lib/server/admin-submissions";
import { isSupabaseAdminConfigured } from "@/lib/server/config";
import { listAdminOrders } from "@/lib/server/orders";

export const metadata: Metadata = { title: "AVANA OS — Dashboard", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdminPageSession();
  if (!isSupabaseAdminConfigured()) return <AdminDashboard />;
  const [orders, products, submissions, subscribers] = await Promise.all([
    listAdminOrders(100).catch(() => []),
    listAdminProducts().catch(() => []),
    getSubmissionMetrics().catch(() => ({ total: 0, b2b: 0, activeB2B: 0, contact: 0, waitlist: 0 })),
    getSubscriberCount().catch(() => 0),
  ]);
  return (
    <AdminLiveDashboard
      orders={orders}
      products={products}
      leads={submissions.activeB2B}
      subscribers={subscribers}
    />
  );
}
