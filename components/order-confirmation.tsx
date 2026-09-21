"use client";

import Link from "next/link";
import { Check, Clock3, FileDown, PackageSearch, RefreshCw, Truck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/components/app-providers";
import { fulfillmentStatusLabel, orderStatusLabel, paymentStatusLabel } from "@/lib/order-display";
import { readStorage } from "@/lib/storage";
import { storedOrderSchema, type StoredOrder } from "@/lib/validation";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { PublicOrder } from "@/types/commerce";
import { trackEvent } from "@/lib/analytics-client";

const ordersSchema = storedOrderSchema.array().max(100);

export function OrderConfirmation({
  orderNumber,
  live,
  initialOrder,
  accessToken,
}: {
  orderNumber: string;
  live: boolean;
  initialOrder: PublicOrder | null;
  accessToken: string;
}) {
  const { clearCart } = useApp();
  const [liveOrder, setLiveOrder] = useState(initialOrder);
  const [demoOrder, setDemoOrder] = useState<StoredOrder | null>(null);
  const [loading, setLoading] = useState(live && !initialOrder);
  const [attempts, setAttempts] = useState(0);
  const cartCleared = useRef(false);

  const refreshOrder = useCallback(async () => {
    const query = accessToken ? `?token=${encodeURIComponent(accessToken)}` : "";
    const response = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}${query}`, {
      cache: "no-store",
    });
    if (!response.ok) return false;
    const result = (await response.json()) as { order?: PublicOrder };
    if (!result.order) return false;
    setLiveOrder(result.order);
    setLoading(false);
    return true;
  }, [accessToken, orderNumber]);

  useEffect(() => {
    if (live) return;
    const frame = window.requestAnimationFrame(() => {
      const recent = readStorage(sessionStorage, "avana-last-order", storedOrderSchema.nullable(), null);
      const stored = readStorage(localStorage, "avana-orders", ordersSchema, []).find(
        (item) => item.number === orderNumber,
      );
      setDemoOrder(recent?.number === orderNumber ? recent : stored || null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [live, orderNumber]);

  useEffect(() => {
    if (!live || (liveOrder && liveOrder.paymentStatus !== "pending") || attempts >= 10) return;
    const timeout = window.setTimeout(
      async () => {
        await refreshOrder();
        setAttempts((current) => current + 1);
      },
      attempts === 0 ? 400 : 2000,
    );
    return () => window.clearTimeout(timeout);
  }, [attempts, live, liveOrder, refreshOrder]);

  useEffect(() => {
    if (
      liveOrder &&
      ["paid", "partially_refunded"].includes(liveOrder.paymentStatus) &&
      !cartCleared.current
    ) {
      cartCleared.current = true;
      clearCart();
      const purchaseKey = `avana-purchase-${liveOrder.number}`;
      if (!sessionStorage.getItem(purchaseKey)) {
        sessionStorage.setItem(purchaseKey, "1");
        trackEvent("purchase", { totalCents: liveOrder.totalCents });
      }
    }
  }, [clearCart, liveOrder]);

  if (!live) return <DemoConfirmation orderNumber={orderNumber} order={demoOrder} />;

  if (!liveOrder) {
    return (
      <div className="confirmation-card">
        <div className="confirmation-icon pending">
          <Clock3 size={30} />
        </div>
        <span className="status-badge">Accès privé</span>
        <h1>{loading && attempts < 10 ? "Confirmation en cours…" : "Retrouvez votre commande."}</h1>
        <p className="lead">
          {loading && attempts < 10
            ? "Nous attendons la confirmation sécurisée du paiement. Cette page se met à jour automatiquement."
            : "Connectez-vous avec le courriel utilisé au paiement ou demandez un nouveau lien privé."}
        </p>
        <div className="order-number">{orderNumber}</div>
        <div className="button-row" style={{ justifyContent: "center", marginTop: "2rem" }}>
          <Link className="button button-dark" href="/compte">
            <PackageSearch size={17} /> Accéder à mon compte
          </Link>
          <button className="button button-outline" onClick={() => void refreshOrder()}>
            <RefreshCw size={16} /> Actualiser
          </button>
        </div>
      </div>
    );
  }

  const paid = ["paid", "partially_refunded"].includes(liveOrder.paymentStatus);
  const refunded = liveOrder.paymentStatus === "refunded";
  const shipment = liveOrder.shipments.at(-1);
  return (
    <div className="confirmation-card order-live-card">
      <div className={`confirmation-icon ${paid || refunded ? "" : "pending"}`}>
        {paid ? <Check size={32} /> : refunded ? <RefreshCw size={30} /> : <Clock3 size={30} />}
      </div>
      <span className="status-badge">{paymentStatusLabel(liveOrder.paymentStatus)}</span>
      <h1>
        {refunded
          ? "Votre remboursement est confirmé."
          : paid
            ? "Merci. Votre commande est confirmée."
            : "Votre paiement est en vérification."}
      </h1>
      <p className="lead">
        {refunded
          ? "Le délai d’affichage du crédit dépend maintenant de votre institution financière."
          : paid
            ? "Un courriel de confirmation a été envoyé. Vous pourrez suivre chaque étape depuis cette page."
            : "La confirmation bancaire peut prendre quelques instants. Ne recommencez pas le paiement."}
      </p>
      <div className="order-number">{liveOrder.number}</div>

      <div className="order-live-grid">
        <section className="order-live-summary">
          <h2>Résumé</h2>
          <div className="summary-line">
            <span>Date</span>
            <strong>{formatDate(liveOrder.createdAt)}</strong>
          </div>
          <div className="summary-line">
            <span>Commande</span>
            <span className="status-badge">{orderStatusLabel(liveOrder.status)}</span>
          </div>
          <div className="summary-line">
            <span>Préparation</span>
            <strong>{fulfillmentStatusLabel(liveOrder.fulfillmentStatus)}</strong>
          </div>
          <div className="summary-line">
            <span>Livraison</span>
            <strong>{liveOrder.shippingMethod === "express" ? "Express" : "Standard"}</strong>
          </div>
          {liveOrder.items.map((item) => (
            <div className="summary-line" key={item.sku}>
              <span>
                {item.quantity} × {item.productName}
                <small>
                  {item.variantLabel}
                  {item.lotCode ? ` · Lot ${item.lotCode}` : ""}
                </small>
              </span>
              <strong>{formatCurrency(item.lineTotalCents / 100)}</strong>
            </div>
          ))}
          <div className="summary-line">
            <span>Sous-total</span>
            <span>{formatCurrency(liveOrder.subtotalCents / 100)}</span>
          </div>
          <div className="summary-line">
            <span>Livraison</span>
            <span>{formatCurrency(liveOrder.shippingCents / 100)}</span>
          </div>
          {liveOrder.discountCents > 0 && (
            <div className="summary-line">
              <span>Remise</span>
              <span>−{formatCurrency(liveOrder.discountCents / 100)}</span>
            </div>
          )}
          <div className="summary-line">
            <span>Taxes</span>
            <span>{formatCurrency(liveOrder.taxCents / 100)}</span>
          </div>
          <div className="summary-line total">
            <span>Total</span>
            <span>{formatCurrency(liveOrder.totalCents / 100)}</span>
          </div>
          {liveOrder.refundedCents > 0 && (
            <>
              <div className="summary-line">
                <span>Remboursé</span>
                <span>−{formatCurrency(liveOrder.refundedCents / 100)}</span>
              </div>
              <div className="summary-line total">
                <span>Net</span>
                <span>{formatCurrency((liveOrder.totalCents - liveOrder.refundedCents) / 100)}</span>
              </div>
            </>
          )}
        </section>

        <section className="order-timeline" aria-label="Suivi de commande">
          <h2>Suivi</h2>
          {liveOrder.events.map((event, index) => (
            <div className="order-timeline-item" key={`${event.status}-${event.createdAt}`}>
              <span className={index === liveOrder.events.length - 1 ? "active" : ""} />
              <div>
                <strong>{event.message}</strong>
                <small>{formatDate(event.createdAt)}</small>
              </div>
            </div>
          ))}
          {shipment && (
            <div className="shipment-card">
              <Truck size={20} />
              <div>
                <strong>{shipment.carrier}</strong>
                <span>{shipment.trackingNumber}</span>
              </div>
              {shipment.trackingUrl && (
                <a className="text-link" href={shipment.trackingUrl} target="_blank" rel="noreferrer">
                  Suivre
                </a>
              )}
            </div>
          )}
        </section>
      </div>

      <div className="button-row" style={{ justifyContent: "center", marginTop: "2rem" }}>
        {liveOrder.invoicePdfUrl && (
          <a
            className="button button-outline"
            href={liveOrder.invoicePdfUrl}
            target="_blank"
            rel="noreferrer"
          >
            <FileDown size={17} /> Télécharger la facture
          </a>
        )}
        <Link className="button button-dark" href="/compte">
          <PackageSearch size={17} /> Toutes mes commandes
        </Link>
        <Link className="button button-outline" href="/boutique">
          Retour à la boutique
        </Link>
      </div>
    </div>
  );
}

function DemoConfirmation({ orderNumber, order }: { orderNumber: string; order: StoredOrder | null }) {
  return (
    <div className="confirmation-card">
      <div className="confirmation-icon">
        <Check size={32} />
      </div>
      <span className="demo-badge">Commande simulée</span>
      <h1>Merci. Votre commande démo est créée.</h1>
      <p className="lead">Aucun paiement n’a été traité. Cette confirmation illustre le parcours prévu.</p>
      <div className="order-number">{orderNumber}</div>
      {order && (
        <div className="order-demo-summary">
          <div className="summary-line">
            <span>Date</span>
            <strong>{formatDate(order.createdAt)}</strong>
          </div>
          {order.items.map((item) => (
            <div className="summary-line" key={`${item.product}-${item.variant}`}>
              <span>
                {item.quantity} × {item.product}
                <small>{item.variant}</small>
              </span>
              <strong>{formatCurrency(item.price * item.quantity)}</strong>
            </div>
          ))}
          <div className="summary-line total">
            <span>Total démo</span>
            <span>{formatCurrency(order.total)}</span>
          </div>
        </div>
      )}
      <div className="button-row" style={{ justifyContent: "center", marginTop: "2rem" }}>
        <Link className="button button-dark" href="/compte">
          <PackageSearch size={17} /> Suivre ma commande
        </Link>
        <Link className="button button-outline" href="/boutique">
          Retour à la boutique
        </Link>
      </div>
    </div>
  );
}
