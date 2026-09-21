import Link from "next/link";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  MailCheck,
  PackageCheck,
  ShoppingCart,
  TriangleAlert,
} from "lucide-react";
import { fulfillmentStatusLabel, orderStatusLabel } from "@/lib/order-display";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { AdminOrder, AdminProduct } from "@/types/commerce";

export function AdminLiveDashboard({
  orders,
  products,
  leads,
  subscribers,
}: {
  orders: AdminOrder[];
  products: AdminProduct[];
  leads: number;
  subscribers: number;
}) {
  const paidOrders = orders.filter((order) => !["pending", "failed"].includes(order.paymentStatus));
  const revenueCents = paidOrders.reduce(
    (sum, order) => sum + Math.max(order.totalCents - order.refundedCents, 0),
    0,
  );
  const variants = products.flatMap((product) => product.variants);
  const availableStock = variants.reduce(
    (sum, variant) => sum + variant.stockOnHand - variant.stockReserved,
    0,
  );
  const lowStock = variants.filter(
    (variant) => variant.active && variant.stockOnHand - variant.stockReserved <= 5,
  );

  return (
    <>
      <div className="admin-topbar">
        <div>
          <span className="small muted">
            {new Intl.DateTimeFormat("fr-CA", { dateStyle: "full" }).format(new Date())}
          </span>
          <h1>Bonjour, équipe AVANA.</h1>
        </div>
        <div className="admin-actions">
          <span className="presentation-badge">● Données en direct</span>
          <Link className="button button-dark button-sm" href="/">
            Voir la boutique <ArrowUpRight size={15} />
          </Link>
        </div>
      </div>
      <section className="chart-card admin-welcome-card">
        <div>
          <span className="small">AVANA OS</span>
          <h2>Les ventes, stocks et suivis sont synchronisés.</h2>
          <p>Les paiements Stripe et les événements logistiques alimentent automatiquement ce tableau.</p>
        </div>
        <div className="button-row">
          <Link href="/admin/commandes" className="button button-light button-sm">
            Traiter les commandes
          </Link>
          <Link href="/admin/produits" className="button button-outline button-sm">
            Gérer le stock
          </Link>
        </div>
      </section>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card-top">
            <span>Chiffre d’affaires</span>
            <ShoppingCart size={17} />
          </div>
          <strong>{formatCurrency(revenueCents / 100)}</strong>
          <small>{paidOrders.length} paiements comptabilisés</small>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <span>À préparer</span>
            <PackageCheck size={17} />
          </div>
          <strong>{orders.filter((order) => ["paid", "processing"].includes(order.status)).length}</strong>
          <small>Commandes actives</small>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <span>Stock disponible</span>
            <TriangleAlert size={17} />
          </div>
          <strong>{availableStock}</strong>
          <small>{lowStock.length} formats à stock faible</small>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <span>Pipeline</span>
            <BriefcaseBusiness size={17} />
          </div>
          <strong>{leads}</strong>
          <small>Leads B2B actifs</small>
        </div>
        <div className="stat-card">
          <div className="stat-card-top">
            <span>Infolettre</span>
            <MailCheck size={17} />
          </div>
          <strong>{subscribers}</strong>
          <small>Abonnés confirmés</small>
        </div>
      </div>
      <section className="admin-section chart-grid">
        <div className="chart-card">
          <div className="admin-section-header">
            <h2>Commandes récentes</h2>
            <Link className="text-link small" href="/admin/commandes">
              Voir toutes
            </Link>
          </div>
          {orders.slice(0, 8).map((order) => (
            <Link className="admin-activity-row" href="/admin/commandes" key={order.id}>
              <div>
                <strong>{order.number}</strong>
                <span>
                  {order.customerName} · {formatDate(order.createdAt)}
                </span>
              </div>
              <div>
                <strong>{formatCurrency((order.totalCents - order.refundedCents) / 100)}</strong>
                <span>
                  {orderStatusLabel(order.status)} · {fulfillmentStatusLabel(order.fulfillmentStatus)}
                </span>
              </div>
            </Link>
          ))}
          {!orders.length && <p className="muted">Aucune commande pour le moment.</p>}
        </div>
        <div className="chart-card">
          <h2>Attention requise</h2>
          <div className="feature-list">
            {lowStock.map((variant) => (
              <div className="feature-list-item" key={variant.id}>
                <div className="feature-list-icon">
                  <TriangleAlert size={18} />
                </div>
                <div>
                  <h3>{variant.sku}</h3>
                  <p>{variant.stockOnHand - variant.stockReserved} unité(s) disponible(s)</p>
                </div>
              </div>
            ))}
            {!lowStock.length && (
              <div className="feature-list-item">
                <div className="feature-list-icon">
                  <PackageCheck size={18} />
                </div>
                <div>
                  <h3>Stocks sains</h3>
                  <p>Aucun format actif sous le seuil de 5 unités.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
