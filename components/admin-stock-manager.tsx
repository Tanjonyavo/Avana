"use client";

import Link from "next/link";
import { ArrowUpRight, ClipboardList, Download, Plus, Warehouse } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { AdminProduct, InventoryMovement, InventorySummary } from "@/types/commerce";

const reasonLabels: Record<string, string> = {
  initial: "Stock initial",
  receipt: "Réception",
  loss: "Perte",
  correction_add: "Correction +",
  correction_remove: "Correction −",
  sale: "Vente",
  refund_restock: "Retour remboursé",
  manual_adjustment: "Ajustement fiche",
};

export function AdminStockManager({
  products,
  summary,
  movements,
  lowStockThreshold,
}: {
  products: AdminProduct[];
  summary: InventorySummary[];
  movements: InventoryMovement[];
  lowStockThreshold: number;
}) {
  const router = useRouter();
  const [variantId, setVariantId] = useState("");
  const [reason, setReason] = useState("receipt");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const rows = useMemo(
    () => products.flatMap((product) => product.variants.map((variant) => ({ product, variant }))),
    [products],
  );
  const summaryByVariant = useMemo(() => new Map(summary.map((item) => [item.variantId, item])), [summary]);
  const physical = rows.reduce((sum, row) => sum + row.variant.stockOnHand, 0);
  const reserved = rows.reduce((sum, row) => sum + row.variant.stockReserved, 0);
  const sold = summary.reduce((sum, item) => sum + item.soldUnits, 0);
  const losses = summary.reduce((sum, item) => sum + item.lossUnits, 0);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/stocks/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId, reason, quantity: Number(quantity), note }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Ajustement impossible.");
      setMessage("Mouvement enregistré.");
      setQuantity("1");
      setNote("");
      router.refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Ajustement impossible.");
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <div className="admin-topbar">
        <div>
          <span className="small muted">Inventaire en direct</span>
          <h1>Stocks</h1>
        </div>
        <div className="admin-actions">
          <Link className="button button-outline button-sm" href="/api/admin/stocks/export" prefetch={false}>
            <Download size={15} /> Exporter CSV
          </Link>
          <Link className="button button-dark button-sm" href="/admin/produits">
            Fiches produits <ArrowUpRight size={15} />
          </Link>
        </div>
      </div>
      <div className="stat-grid">
        <div className="stat-card">
          <span>Stock physique</span>
          <strong>{physical}</strong>
          <small>Unités enregistrées</small>
        </div>
        <div className="stat-card">
          <span>Réservé</span>
          <strong>{reserved}</strong>
          <small>Checkouts en cours</small>
        </div>
        <div className="stat-card">
          <span>Vendu</span>
          <strong>{sold}</strong>
          <small>Unités payées</small>
        </div>
        <div className="stat-card">
          <span>Pertes</span>
          <strong>{losses}</strong>
          <small>Unités documentées</small>
        </div>
      </div>

      <details className="admin-create-panel">
        <summary>
          <Plus size={17} /> Enregistrer un mouvement
        </summary>
        <form className="admin-product-form" onSubmit={submit}>
          <label>
            Produit et format
            <select required value={variantId} onChange={(event) => setVariantId(event.target.value)}>
              <option value="">Choisir…</option>
              {rows.map(({ product, variant }) => (
                <option value={variant.id} key={variant.id}>
                  {product.name} · {variant.label} · {variant.sku}
                </option>
              ))}
            </select>
          </label>
          <label>
            Motif
            <select value={reason} onChange={(event) => setReason(event.target.value)}>
              <option value="receipt">Réception</option>
              <option value="loss">Perte</option>
              <option value="correction_add">Correction positive</option>
              <option value="correction_remove">Correction négative</option>
            </select>
          </label>
          <label>
            Quantité
            <input
              required
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </label>
          <label className="full">
            Justification
            <textarea
              required={reason !== "receipt"}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Référence de réception, cause de perte ou justification de correction"
            />
          </label>
          <button className="button button-dark" disabled={pending} type="submit">
            <ClipboardList size={15} /> {pending ? "Enregistrement…" : "Enregistrer"}
          </button>
        </form>
      </details>
      {message && (
        <p className="form-feedback admin-global-feedback" role="status">
          {message}
        </p>
      )}

      <section className="admin-section">
        {!rows.length ? (
          <div className="empty-state admin-empty">
            <div>
              <Warehouse size={34} />
              <h2>Aucun format.</h2>
              <p>Créez un produit et son premier format pour commencer l’inventaire.</p>
            </div>
          </div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>SKU</th>
                  <th>Format</th>
                  <th>Prix</th>
                  <th>Physique</th>
                  <th>Réservé</th>
                  <th>Disponible</th>
                  <th>Vendu</th>
                  <th>Pertes</th>
                  <th>État</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ product, variant }) => {
                  const metrics = summaryByVariant.get(variant.id);
                  const available = variant.stockOnHand - variant.stockReserved;
                  return (
                    <tr key={variant.id}>
                      <td>
                        <strong>{product.name}</strong>
                        <span>{product.lotCode}</span>
                      </td>
                      <td>{variant.sku}</td>
                      <td>{variant.label}</td>
                      <td>{formatCurrency(variant.priceCents / 100)}</td>
                      <td>{variant.stockOnHand}</td>
                      <td>{variant.stockReserved}</td>
                      <td>
                        <strong>{available}</strong>
                      </td>
                      <td>{metrics?.soldUnits || 0}</td>
                      <td>{metrics?.lossUnits || 0}</td>
                      <td>
                        <span className={`status-badge ${available <= lowStockThreshold ? "warning" : ""}`}>
                          {variant.active ? (available <= lowStockThreshold ? "Faible" : "Actif") : "Inactif"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="admin-section">
        <div className="admin-section-header">
          <div>
            <h2>Journal d’inventaire</h2>
            <p>Les 100 mouvements les plus récents.</p>
          </div>
        </div>
        {!movements.length ? (
          <p className="muted">Aucun mouvement enregistré.</p>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Produit</th>
                  <th>SKU</th>
                  <th>Mouvement</th>
                  <th>Motif</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => (
                  <tr key={movement.id}>
                    <td>{formatDate(movement.createdAt)}</td>
                    <td>
                      <strong>{movement.productName}</strong>
                      <span>{movement.variantLabel}</span>
                    </td>
                    <td>{movement.sku}</td>
                    <td>
                      <strong
                        className={movement.quantityDelta > 0 ? "inventory-positive" : "inventory-negative"}
                      >
                        {movement.quantityDelta > 0 ? "+" : ""}
                        {movement.quantityDelta}
                      </strong>
                    </td>
                    <td>{reasonLabels[movement.reason] || movement.reason}</td>
                    <td>{movement.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
