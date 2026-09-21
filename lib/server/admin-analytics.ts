import "server-only";

import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import type { AdminAnalyticsData, AnalyticsDailyPoint } from "@/types/commerce";

interface CountRow {
  event_name: string;
  event_count: number | string;
}

function totals(rows: CountRow[] | null) {
  return Object.fromEntries((rows || []).map((row) => [row.event_name, Number(row.event_count)]));
}

export async function getAdminAnalytics(): Promise<AdminAnalyticsData> {
  const client = getSupabaseAdmin();
  const [week, month, dailyResult, pathsResult] = await Promise.all([
    client.rpc("analytics_funnel", { days_value: 7 }),
    client.rpc("analytics_funnel", { days_value: 30 }),
    client.rpc("analytics_daily", { days_value: 30 }),
    client.rpc("analytics_top_paths", { days_value: 30, result_limit: 10 }),
  ]);
  const error = week.error || month.error || dailyResult.error || pathsResult.error;
  if (error) throw new Error(`Analytics could not be loaded: ${error.code}`);

  const byDate = new Map<string, AnalyticsDailyPoint>();
  for (let offset = 29; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - offset);
    const key = date.toISOString().slice(0, 10);
    byDate.set(key, { date: key, pageViews: 0, productViews: 0, cartAdds: 0, checkouts: 0, purchases: 0 });
  }
  const keyForEvent: Record<string, keyof Omit<AnalyticsDailyPoint, "date">> = {
    page_view: "pageViews",
    view_item: "productViews",
    add_to_cart: "cartAdds",
    begin_checkout: "checkouts",
    purchase: "purchases",
  };
  for (const row of (dailyResult.data || []) as Array<{
    day: string;
    event_name: string;
    event_count: number | string;
  }>) {
    const point = byDate.get(row.day);
    const key = keyForEvent[row.event_name];
    if (point && key) point[key] = Number(row.event_count);
  }

  return {
    last7Days: totals(week.data as CountRow[] | null),
    last30Days: totals(month.data as CountRow[] | null),
    daily: [...byDate.values()],
    topPaths: ((pathsResult.data || []) as Array<{ path: string; view_count: number | string }>).map(
      (row) => ({
        path: row.path,
        views: Number(row.view_count),
      }),
    ),
  };
}

export async function pruneOperationalData() {
  const { data, error } = await getSupabaseAdmin().rpc("prune_operational_data");
  if (error) throw new Error(`Operational cleanup failed: ${error.code}`);
  return data as Record<string, number>;
}
