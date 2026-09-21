"use client";

import Image from "next/image";
import Link from "next/link";
import { FileDown, Heart, LogOut, Package, Settings, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/components/app-providers";
import { CustomerAccountSettings } from "@/components/customer-account-settings";
import { fulfillmentStatusLabel, orderStatusLabel } from "@/lib/order-display";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { CustomerAddress, CustomerProfile, PublicOrder } from "@/types/commerce";

export function AccountPortal({
  email,
  orders,
  profile,
  addresses,
}: {
  email: string;
  orders: PublicOrder[];
  profile: CustomerProfile;
  addresses: CustomerAddress[];
}) {
  const router = useRouter();
  const { catalog, favorites } = useApp();
  const [pending, setPending] = useState(false);
  const favoriteProducts = catalog.filter((product) => favorites.includes(product.id));

  const logout = async () => {
    setPending(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
  };

  return (
    <section className="page-section">
      <div className="section-shell account-layout">
        <nav className="account-nav" aria-label="Compte">
          <Link href="#overview">
            <UserRound size={16} /> Vue d’ensemble
          </Link>
          <Link href="#orders">
            <Package size={16} /> Commandes
          </Link>
          <Link href="#favorites">
            <Heart size={16} /> Favoris
          </Link>
          <Link href="#settings">
            <Settings size={16} /> Préférences
          </Link>
        </nav>
        <div className="account-content" id="overview">
          <div className="account-heading-row">
            <div>
              <span className="status-badge">Compte sécurisé</span>
              <h1>Bonjour.</h1>
              <p className="lead">Connecté avec {email}</p>
            </div>
            <button className="button button-outline button-sm" disabled={pending} onClick={logout}>
              <LogOut size={15} /> Déconnexion
            </button>
          </div>
          <div className="stat-grid">
            <div className="stat-card">
              <span>Commandes</span>
              <strong>{orders.length}</strong>
              <small>Historique sécurisé</small>
            </div>
            <div className="stat-card">
              <span>Favoris</span>
              <strong>{favoriteProducts.length}</strong>
              <small>Dans ce navigateur</small>
            </div>
            <div className="stat-card">
              <span>En livraison</span>
              <strong>{orders.filter((order) => order.fulfillmentStatus === "shipped").length}</strong>
              <small>Suivi actif</small>
            </div>
            <div className="stat-card">
              <span>Total</span>
              <strong>
                {formatCurrency(
                  orders.reduce(
                    (sum, order) =>
                      ["paid", "partially_refunded", "refunded"].includes(order.paymentStatus)
                        ? sum + Math.max(order.totalCents - order.refundedCents, 0)
                        : sum,
                    0,
                  ) / 100,
                )}
              </strong>
              <small>Montant net payé</small>
            </div>
          </div>

          <section className="admin-section" id="orders">
            <div className="admin-section-header">
              <h2>Commandes</h2>
              <Link className="text-link small" href="/boutique">
                Nouvelle commande
              </Link>
            </div>
            {orders.length ? (
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Commande</th>
                      <th>Date</th>
                      <th>Articles</th>
                      <th>Total</th>
                      <th>Commande</th>
                      <th>Livraison</th>
                      <th>Facture</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.number}>
                        <td>
                          <Link className="order-link" href={`/commande/${encodeURIComponent(order.number)}`}>
                            {order.number}
                          </Link>
                        </td>
                        <td>{formatDate(order.createdAt)}</td>
                        <td>{order.items.reduce((sum, item) => sum + item.quantity, 0)}</td>
                        <td>
                          {formatCurrency((order.totalCents - order.refundedCents) / 100)}
                          {order.refundedCents > 0 && (
                            <small> · {formatCurrency(order.refundedCents / 100)} remboursé</small>
                          )}
                        </td>
                        <td>
                          <span className="status-badge">{orderStatusLabel(order.status)}</span>
                        </td>
                        <td>{fulfillmentStatusLabel(order.fulfillmentStatus)}</td>
                        <td>
                          {order.invoicePdfUrl ? (
                            <a
                              className="icon-small-button"
                              href={order.invoicePdfUrl}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`Télécharger la facture ${order.number}`}
                            >
                              <FileDown size={15} />
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state account-empty">
                <div>
                  <Package size={34} />
                  <h3>Aucune commande.</h3>
                  <p>Votre première commande apparaîtra ici.</p>
                </div>
              </div>
            )}
          </section>

          <section className="admin-section" id="favorites">
            <div className="admin-section-header">
              <h2>Favoris</h2>
            </div>
            {favoriteProducts.length ? (
              <div className="favorite-list">
                {favoriteProducts.map((product) => (
                  <Link className="search-result" href={`/boutique/${product.slug}`} key={product.id}>
                    <Image src={product.image} alt="" width={64} height={64} />
                    <div>
                      <strong>{product.name}</strong>
                      <span>{product.eyebrow}</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="muted">Aucun favori enregistré.</p>
            )}
          </section>

          <section className="admin-section account-panel" id="settings">
            <h2>Préférences</h2>
            <CustomerAccountSettings initialProfile={profile} addresses={addresses} />
          </section>
        </div>
      </div>
    </section>
  );
}
