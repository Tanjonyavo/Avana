"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Box,
  BriefcaseBusiness,
  DollarSign,
  PackageCheck,
  ShoppingCart,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { businessLeads, lots, products, salesData } from "@/data/demo";
import { formatCurrency } from "@/lib/utils";

export function AdminDashboard() {
  return (
    <>
      <div className="admin-topbar">
        <div>
          <span className="small muted">Mercredi 9 septembre 2026</span>
          <h1>Bonjour, équipe AVANA.</h1>
        </div>
        <div className="admin-actions">
          <span className="presentation-badge">● Données de démonstration</span>
          <Link className="button button-dark button-sm" href="/">
            Voir la boutique <ArrowUpRight size={15} />
          </Link>
        </div>
      </div>
      <section
        className="chart-card"
        style={{
          background: "var(--forest-900)",
          color: "white",
          marginBottom: "1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <span className="small" style={{ color: "#b9c9c0" }}>
            Bienvenue dans AVANA OS
          </span>
          <h2
            style={{
              fontFamily: "inherit",
              fontSize: "1.35rem",
              fontWeight: 800,
              letterSpacing: "-.02em",
              margin: ".2rem 0",
            }}
          >
            Le commerce, les lots et la preuve de marché au même endroit.
          </h2>
          <p style={{ color: "#b9c9c0", margin: 0, fontSize: ".8rem" }}>
            Cette interface est en lecture seule pour le mode présentation.
          </p>
        </div>
        <div className="button-row">
          <Link href="/admin/lots" className="button button-light button-sm">
            Explorer les lots
          </Link>
          <Link
            href="/admin/b2b"
            className="button button-outline button-sm"
            style={{ color: "white", borderColor: "#71887b" }}
          >
            Voir le pipeline
          </Link>
        </div>
      </section>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card-top">
            <span>CA démo</span>
            <DollarSign size={17} />
          </div>
          <strong>{formatCurrency(5260)}</strong>
          <small>+11,4 % vs août</small>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <span>Commandes</span>
            <ShoppingCart size={17} />
          </div>
          <strong>94</strong>
          <small>Panier moyen {formatCurrency(55.96)}</small>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <span>Unités disponibles</span>
            <PackageCheck size={17} />
          </div>
          <strong>
            {products.reduce(
              (sum, product) => sum + product.variants.reduce((inner, variant) => inner + variant.stock, 0),
              0,
            )}
          </strong>
          <small>{lots.length} lots dans le système</small>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <span>Pipeline B2B</span>
            <BriefcaseBusiness size={17} />
          </div>
          <strong>{formatCurrency(businessLeads.reduce((sum, lead) => sum + lead.value, 0))}</strong>
          <small>{businessLeads.length} opportunités actives</small>
        </div>
      </div>
      <section className="admin-section chart-grid">
        <div className="chart-card">
          <h3>Revenus et commandes</h3>
          <p>Performance mensuelle · simulation</p>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <AreaChart data={salesData} margin={{ left: -15, right: 10 }}>
                <defs>
                  <linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#20473c" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#20473c" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ebe5dc" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value))}
                  contentStyle={{ borderRadius: 10, borderColor: "#e1d8cc" }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#20473c"
                  strokeWidth={2.5}
                  fill="url(#revenue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="chart-card">
          <h3>État des opérations</h3>
          <p>Repères clés du modèle démo</p>
          <div className="feature-list">
            <div className="feature-list-item">
              <div className="feature-list-icon">
                <Box size={18} />
              </div>
              <div>
                <h3>2 lots suivis</h3>
                <p>1 public · 1 en contrôle</p>
              </div>
            </div>
            <div className="feature-list-item">
              <div className="feature-list-icon">
                <UsersRound size={18} />
              </div>
              <div>
                <h3>4 leads B2B</h3>
                <p>3 segments qualifiés</p>
              </div>
            </div>
            <div className="feature-list-item">
              <div className="feature-list-icon">
                <TrendingUp size={18} />
              </div>
              <div>
                <h3>57 % marge brute</h3>
                <p>Scénario cible simulé</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="admin-section">
        <div className="admin-section-header">
          <h2>Lots récents</h2>
          <Link className="text-link small" href="/admin/lots">
            Voir tous
          </Link>
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Lot</th>
                <th>Origine</th>
                <th>Quantité</th>
                <th>Disponible</th>
                <th>Statut</th>
                <th>Donnée</th>
              </tr>
            </thead>
            <tbody>
              {lots.map((lot) => (
                <tr key={lot.id}>
                  <td>
                    <strong>{lot.code}</strong>
                    <span>{lot.species}</span>
                  </td>
                  <td>
                    {lot.country} · {lot.region}
                  </td>
                  <td>{lot.quantityKg} kg</td>
                  <td>{lot.availableKg} kg</td>
                  <td>
                    <span className={`status-badge ${lot.status === "Contrôle" ? "warning" : ""}`}>
                      {lot.status}
                    </span>
                  </td>
                  <td>
                    <span className="demo-badge">{lot.dataStatus}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
