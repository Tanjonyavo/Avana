"use client";

import { CheckCircle2, CreditCard, FileDown, PackageCheck, RefreshCw, RotateCcw, Truck } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { fulfillmentStatusLabel, orderStatusLabel, paymentStatusLabel } from "@/lib/order-display";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { AdminOrder } from "@/types/commerce";

interface ShipmentDraft {
  carrier: string;
  service: string;
  trackingNumber: string;
  trackingUrl: string;
}

function addressLines(address: Record<string, unknown> | null) {
  if (!address) return [];
  return [
    address.line1,
    address.line2,
    [address.city, address.state, address.postal_code].filter(Boolean).join(" "),
    address.country,
  ].filter((value): value is string => typeof value === "string" && Boolean(value));
}

export function AdminOrdersManager({ orders }: { orders: AdminOrder[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [shipments, setShipments] = useState<Record<string, ShipmentDraft>>({});
  const [restock, setRestock] = useState<Record<string, boolean>>({});
  const [refundAmounts, setRefundAmounts] = useState<Record<string, string>>({});

  const shipmentFor = (orderId: string): ShipmentDraft =>
    shipments[orderId] || { carrier: "Postes Canada", service: "", trackingNumber: "", trackingUrl: "" };

  const updateShipment = (orderId: string, field: keyof ShipmentDraft, value: string) => {
    setShipments((current) => ({ ...current, [orderId]: { ...shipmentFor(orderId), [field]: value } }));
  };

  const runAction = async (key: string, url: string, body: unknown) => {
    setPending(key);
    setMessage("");
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error || "Action impossible.");
      setMessage(result.message || "Modification enregistrée et notification traitée.");
      router.refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Action impossible.");
    } finally {
      setPending(null);
    }
  };

  if (!orders.length) {
    return (
      <div className="empty-state admin-empty">
        <div>
          <PackageCheck size={36} />
          <h2>Aucune commande réelle.</h2>
          <p>Les commandes payées apparaîtront ici automatiquement.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-orders-stack">
      {message && (
        <p className="form-feedback admin-global-feedback" role="status">
          {message}
        </p>
      )}
      {orders.map((order) => {
        const shipment = shipmentFor(order.id);
        const paidLike = ["paid", "partially_refunded"].includes(order.paymentStatus);
        const canPrepare = paidLike && order.status === "paid";
        const canShip = paidLike && !["fulfilled", "refunded", "cancelled"].includes(order.status);
        const canDeliver = order.fulfillmentStatus === "shipped";
        const refundableCents = Math.max(order.totalCents - order.refundedCents, 0);
        const refundAmount = refundAmounts[order.id] ?? (refundableCents / 100).toFixed(2);
        const refundCents = Math.round(Number(refundAmount) * 100);
        const validRefund =
          Number.isInteger(refundCents) && refundCents > 0 && refundCents <= refundableCents;
        const completesRefund = validRefund && refundCents === refundableCents;
        const canRefund = paidLike && refundableCents > 0;
        return (
          <article className="admin-order-card" key={order.id}>
            <header className="admin-order-header">
              <div>
                <span className="small muted">{formatDate(order.createdAt)}</span>
                <h2>{order.number}</h2>
                <p>
                  {order.customerName} · <a href={`mailto:${order.email}`}>{order.email}</a>
                </p>
              </div>
              <div className="admin-order-statuses">
                <span className="status-badge">
                  <CreditCard size={13} /> {paymentStatusLabel(order.paymentStatus)}
                </span>
                <span className="status-badge">
                  <PackageCheck size={13} /> {orderStatusLabel(order.status)}
                </span>
                <span className="status-badge">
                  <Truck size={13} /> {fulfillmentStatusLabel(order.fulfillmentStatus)}
                </span>
              </div>
            </header>

            <div className="admin-order-grid">
              <div>
                <h3>Articles</h3>
                {order.items.map((item) => (
                  <div className="summary-line" key={item.sku}>
                    <span>
                      {item.quantity} × {item.productName}
                      <small>
                        {item.variantLabel} · {item.sku}
                        {item.lotCode && (
                          <>
                            {" · "}
                            <Link href={`/admin/lots#lot-${encodeURIComponent(item.lotCode)}`}>
                              Lot {item.lotCode}
                            </Link>
                          </>
                        )}
                      </small>
                    </span>
                    <strong>{formatCurrency(item.lineTotalCents / 100)}</strong>
                  </div>
                ))}
                <div className="summary-line">
                  <span>Sous-total</span>
                  <span>{formatCurrency(order.subtotalCents / 100)}</span>
                </div>
                <div className="summary-line">
                  <span>Livraison</span>
                  <span>{formatCurrency(order.shippingCents / 100)}</span>
                </div>
                {order.discountCents > 0 && (
                  <div className="summary-line">
                    <span>Remise</span>
                    <span>−{formatCurrency(order.discountCents / 100)}</span>
                  </div>
                )}
                <div className="summary-line">
                  <span>Taxes</span>
                  <span>{formatCurrency(order.taxCents / 100)}</span>
                </div>
                <div className="summary-line total">
                  <span>Total</span>
                  <span>{formatCurrency(order.totalCents / 100)}</span>
                </div>
                {order.refundedCents > 0 && (
                  <>
                    <div className="summary-line">
                      <span>Remboursé</span>
                      <span>−{formatCurrency(order.refundedCents / 100)}</span>
                    </div>
                    <div className="summary-line total">
                      <span>Net encaissé</span>
                      <span>{formatCurrency((order.totalCents - order.refundedCents) / 100)}</span>
                    </div>
                  </>
                )}
              </div>
              <div>
                <h3>Livraison</h3>
                <address className="admin-address">
                  {addressLines(order.shippingAddress).map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </address>
                {order.phone && <a href={`tel:${order.phone}`}>{order.phone}</a>}
                {order.shipments.map((item) => (
                  <div className="shipment-card compact" key={item.trackingNumber}>
                    <Truck size={18} />
                    <div>
                      <strong>{item.carrier}</strong>
                      <span>{item.trackingNumber}</span>
                    </div>
                    {item.trackingUrl && (
                      <a className="text-link" href={item.trackingUrl} target="_blank" rel="noreferrer">
                        Suivre
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="admin-order-actions">
              {order.invoicePdfUrl && (
                <a
                  className="button button-outline button-sm"
                  href={order.invoicePdfUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <FileDown size={15} /> Facture
                </a>
              )}
              {canPrepare && (
                <button
                  className="button button-outline button-sm"
                  disabled={pending !== null}
                  onClick={() =>
                    void runAction(`${order.id}-processing`, `/api/admin/orders/${order.id}/status`, {
                      action: "processing",
                    })
                  }
                >
                  <RefreshCw size={15} /> Passer en préparation
                </button>
              )}
              {canDeliver && (
                <button
                  className="button button-green button-sm"
                  disabled={pending !== null}
                  onClick={() =>
                    void runAction(`${order.id}-delivered`, `/api/admin/orders/${order.id}/status`, {
                      action: "delivered",
                    })
                  }
                >
                  <CheckCircle2 size={15} /> Confirmer la livraison
                </button>
              )}
              {canShip && (
                <details className="admin-action-details">
                  <summary>
                    <Truck size={15} /> Ajouter une expédition
                  </summary>
                  <form
                    className="admin-inline-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void runAction(`${order.id}-ship`, `/api/admin/orders/${order.id}/ship`, shipment);
                    }}
                  >
                    <label>
                      Transporteur
                      <input
                        required
                        value={shipment.carrier}
                        onChange={(event) => updateShipment(order.id, "carrier", event.target.value)}
                      />
                    </label>
                    <label>
                      Service
                      <input
                        value={shipment.service}
                        onChange={(event) => updateShipment(order.id, "service", event.target.value)}
                        placeholder="Colis accélérés"
                      />
                    </label>
                    <label>
                      Numéro de suivi
                      <input
                        required
                        value={shipment.trackingNumber}
                        onChange={(event) => updateShipment(order.id, "trackingNumber", event.target.value)}
                      />
                    </label>
                    <label>
                      Lien facultatif
                      <input
                        type="url"
                        value={shipment.trackingUrl}
                        onChange={(event) => updateShipment(order.id, "trackingUrl", event.target.value)}
                      />
                    </label>
                    <button
                      className="button button-dark button-sm"
                      disabled={pending !== null}
                      type="submit"
                    >
                      Enregistrer et notifier
                    </button>
                  </form>
                </details>
              )}
              {canRefund && (
                <details className="admin-action-details danger">
                  <summary>
                    <RotateCcw size={15} /> Rembourser
                  </summary>
                  <div className="admin-inline-form">
                    <label>
                      Montant (CAD)
                      <input
                        inputMode="decimal"
                        min="0.01"
                        max={(refundableCents / 100).toFixed(2)}
                        step="0.01"
                        type="number"
                        value={refundAmount}
                        onChange={(event) =>
                          setRefundAmounts((current) => ({ ...current, [order.id]: event.target.value }))
                        }
                      />
                    </label>
                    <label className="consent-check">
                      <input
                        type="checkbox"
                        checked={Boolean(restock[order.id])}
                        disabled={!completesRefund}
                        onChange={(event) =>
                          setRestock((current) => ({ ...current, [order.id]: event.target.checked }))
                        }
                      />
                      <span>Remettre les articles en stock après remboursement intégral</span>
                    </label>
                    <button
                      className="button button-danger button-sm"
                      disabled={pending !== null || !validRefund}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Rembourser ${formatCurrency(refundCents / 100)} sur ${order.number} ?`,
                          )
                        ) {
                          void runAction(`${order.id}-refund`, `/api/admin/orders/${order.id}/refund`, {
                            amountCents: refundCents,
                            restock: completesRefund && Boolean(restock[order.id]),
                          });
                        }
                      }}
                    >
                      Confirmer le remboursement
                    </button>
                  </div>
                </details>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
