import { NextRequest, NextResponse } from "next/server";
import { secretsMatch } from "@/lib/admin-auth";
import { isSupabaseAdminConfigured } from "@/lib/server/config";
import { enqueueLowStockAlert, processPendingNotifications } from "@/lib/server/notifications";
import { syncCanadaPostTracking } from "@/lib/server/canada-post";
import { reconcileExpiredCheckoutOrders } from "@/lib/server/stripe-checkout";
import { pruneOperationalData } from "@/lib/server/admin-analytics";

export const runtime = "nodejs";
export const maxDuration = 300;

async function settle<T>(operation: Promise<T>) {
  try {
    return { ok: true as const, value: await operation };
  } catch {
    return { ok: false as const };
  }
}

export async function GET(request: NextRequest) {
  const configuredSecret = process.env.CRON_SECRET;
  const providedSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!configuredSecret || !(await secretsMatch(providedSecret, configuredSecret))) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: "Supabase non configuré." }, { status: 503 });
  }

  const [checkoutReconciliation, tracking, maintenance] = await Promise.all([
    settle(reconcileExpiredCheckoutOrders()),
    settle(syncCanadaPostTracking()),
    settle(pruneOperationalData()),
  ]);
  const lowStockAlert = await settle(enqueueLowStockAlert());
  const notifications = await settle(processPendingNotifications(25));
  const ok =
    checkoutReconciliation.ok &&
    checkoutReconciliation.value.failed === 0 &&
    tracking.ok &&
    tracking.value.failed === 0 &&
    maintenance.ok &&
    lowStockAlert.ok &&
    notifications.ok &&
    notifications.value.failed === 0 &&
    notifications.value.persistenceErrors === 0;
  return NextResponse.json(
    {
      ok,
      releasedOrders: checkoutReconciliation.ok ? checkoutReconciliation.value.released : 0,
      recoveredOrders: checkoutReconciliation.ok ? checkoutReconciliation.value.fulfilled : 0,
      checkoutReconciliation,
      tracking,
      lowStockAlert,
      notifications,
      maintenance,
    },
    { status: ok ? 200 : 500 },
  );
}
