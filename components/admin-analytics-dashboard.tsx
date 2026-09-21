"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, Eye, MousePointerClick, ShoppingBag, ShoppingCart } from "lucide-react";
import type { AdminAnalyticsData } from "@/types/commerce";

function percent(numerator: number, denominator: number) {
  if (!denominator) return "0 %";
  return `${new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 1 }).format((numerator / denominator) * 100)} %`;
}

export function AdminAnalyticsDashboard({ data }: { data: AdminAnalyticsData }) {
  const month = data.last30Days;
  const views = month.page_view || 0;
  const productViews = month.view_item || 0;
  const cartAdds = month.add_to_cart || 0;
  const checkouts = month.begin_checkout || 0;
  const purchases = month.purchase || 0;
  const chartData = data.daily.map((point) => ({ ...point, label: point.date.slice(5) }));

  return (
    <>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card-top">
            <span>Pages vues</span>
            <Eye size={17} />
          </div>
          <strong>{views}</strong>
          <small>{data.last7Days.page_view || 0} sur 7 jours</small>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <span>Ajouts panier</span>
            <ShoppingBag size={17} />
          </div>
          <strong>{cartAdds}</strong>
          <small>{percent(cartAdds, productViews)} des vues produit</small>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <span>Checkouts</span>
            <MousePointerClick size={17} />
          </div>
          <strong>{checkouts}</strong>
          <small>{percent(checkouts, cartAdds)} des ajouts</small>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <span>Achats</span>
            <ShoppingCart size={17} />
          </div>
          <strong>{purchases}</strong>
          <small>{percent(purchases, checkouts)} des checkouts</small>
        </div>
      </div>

      <section className="admin-section chart-grid">
        <div className="chart-card admin-analytics-chart">
          <div className="admin-section-header">
            <div>
              <span className="small muted">30 derniers jours</span>
              <h2>Parcours de conversion</h2>
            </div>
            <BarChart3 size={20} />
          </div>
          <div
            className="analytics-chart-wrap"
            aria-label="Évolution des pages vues, ajouts au panier, checkouts et achats"
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 8, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#315f52" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#315f52" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5ded2" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="pageViews"
                  name="Pages vues"
                  stroke="#315f52"
                  fill="url(#viewsGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="cartAdds"
                  name="Ajouts panier"
                  stroke="#9b7049"
                  fill="transparent"
                />
                <Area
                  type="monotone"
                  dataKey="checkouts"
                  name="Checkouts"
                  stroke="#714c3d"
                  fill="transparent"
                />
                <Area type="monotone" dataKey="purchases" name="Achats" stroke="#1f2f2a" fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="chart-card">
          <h2>Pages les plus consultées</h2>
          <div className="analytics-paths">
            {data.topPaths.map((item) => (
              <div className="admin-activity-row" key={item.path}>
                <strong>{item.path}</strong>
                <span>
                  {item.views} vue{item.views > 1 ? "s" : ""}
                </span>
              </div>
            ))}
            {!data.topPaths.length && <p className="muted">Aucune donnée consentie pour le moment.</p>}
          </div>
          <p className="small muted">
            Mesure interne sans adresse IP stockée. Les événements sont conservés 13 mois.
          </p>
        </div>
      </section>
    </>
  );
}
