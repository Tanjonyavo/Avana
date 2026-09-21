"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/utils";

export function FinanceCalculator() {
  const [values, setValues] = useState({
    material: 8.4,
    freight: 1.8,
    customs: 0.7,
    importer: 1.2,
    packaging: 2.1,
    labour: 1.6,
    storage: 0.4,
    payment: 0.85,
    marketing: 2.2,
    price: 28,
  });
  const update = (key: keyof typeof values, value: string) =>
    setValues({ ...values, [key]: Number(value) || 0 });
  const cost = useMemo(
    () =>
      Object.entries(values)
        .filter(([key]) => key !== "price")
        .reduce((sum, [, value]) => sum + value, 0),
    [values],
  );
  const margin = values.price - cost;
  const marginRate = values.price ? (margin / values.price) * 100 : 0;
  const scenarios = [
    { name: "Prudent", revenue: 8500, contribution: 2150 },
    { name: "Cible", revenue: 15400, contribution: 5730 },
    { name: "Optimiste", revenue: 27900, contribution: 11700 },
  ];
  const labels: Record<string, string> = {
    material: "Matière première",
    freight: "Transport",
    customs: "Douane et taxes",
    importer: "Importateur",
    packaging: "Emballage",
    labour: "Main-d’œuvre",
    storage: "Stockage",
    payment: "Paiement",
    marketing: "Marketing",
    price: "Prix de vente",
  };
  return (
    <>
      <div className="admin-topbar">
        <div>
          <span className="small muted">Unit economics et scénarios</span>
          <h1>Finances</h1>
        </div>
        <span className="presentation-badge">Hypothèses configurables</span>
      </div>
      <div className="finance-grid">
        <section className="calculator">
          <div className="admin-section-header">
            <h2>Coût unitaire · 5 gousses</h2>
            <span className="demo-badge">Hypothèse</span>
          </div>
          {Object.entries(values).map(([key, value]) => (
            <div className="calculator-row" key={key}>
              <label htmlFor={`cost-${key}`}>{labels[key]}</label>
              <input
                id={`cost-${key}`}
                type="number"
                min="0"
                step="0.05"
                value={value}
                onChange={(event) => update(key as keyof typeof values, event.target.value)}
              />
            </div>
          ))}
          <div className="calculator-results">
            <div className="calculator-result">
              <span>Coût unitaire</span>
              <strong>{formatCurrency(cost)}</strong>
            </div>
            <div className="calculator-result">
              <span>Marge brute</span>
              <strong>{formatCurrency(margin)}</strong>
            </div>
            <div className="calculator-result primary">
              <span>Taux de marge</span>
              <strong>{marginRate.toFixed(1)} %</strong>
            </div>
          </div>
        </section>
        <section className="chart-card">
          <h3>Scénarios annuels</h3>
          <p>Revenus et contribution projetés selon trois hypothèses</p>
          <div style={{ height: 390, width: "100%" }}>
            <ResponsiveContainer>
              <AreaChart data={scenarios} margin={{ left: -5, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ebe5dc" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Area
                  dataKey="revenue"
                  name="Revenus"
                  type="monotone"
                  stroke="#20473c"
                  fill="#dae7df"
                  strokeWidth={2}
                />
                <Area
                  dataKey="contribution"
                  name="Contribution"
                  type="monotone"
                  stroke="#b76744"
                  fill="#eed4c7"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="payment-demo">
            Ces calculs n’ont pas valeur de prévision financière. Ils illustrent un outil interne de décision
            dont toutes les hypothèses restent modifiables.
          </div>
        </section>
      </div>
    </>
  );
}
