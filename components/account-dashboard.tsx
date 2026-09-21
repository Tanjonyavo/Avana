"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart, MapPin, Package, ReceiptText, Settings, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "@/components/app-providers";
import { readStorage } from "@/lib/storage";
import { storedOrderSchema, type StoredOrder } from "@/lib/validation";
import { formatCurrency, formatDate } from "@/lib/utils";

const ordersSchema = storedOrderSchema.array().max(100);

export function AccountDashboard() {
  const { catalog, favorites } = useApp();
  const [orders, setOrders] = useState<StoredOrder[]>([]);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() =>
      setOrders(readStorage(localStorage, "avana-orders", ordersSchema, [])),
    );
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const favoriteProducts = catalog.filter((product) => favorites.includes(product.id));

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
          <Link href="#addresses">
            <MapPin size={16} /> Adresses
          </Link>
          <Link href="#invoices">
            <ReceiptText size={16} /> Factures
          </Link>
          <Link href="#settings">
            <Settings size={16} /> Préférences
          </Link>
        </nav>
        <div className="account-content" id="overview">
          <span className="demo-badge">Compte fictif local</span>
          <h1>Bonjour, membre AVANA.</h1>
          <p className="lead">
            Ce tableau de démonstration rassemble uniquement des reçus anonymisés et vos favoris. Aucune
            authentification réelle n’est active.
          </p>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-card-top">
                <span>Commandes</span>
              </div>
              <strong>{orders.length}</strong>
              <small>Dans ce navigateur</small>
            </div>
            <div className="stat-card">
              <div className="stat-card-top">
                <span>Favoris</span>
              </div>
              <strong>{favoriteProducts.length}</strong>
              <small>Produits enregistrés</small>
            </div>
            <div className="stat-card">
              <div className="stat-card-top">
                <span>Adresse</span>
              </div>
              <strong>0</strong>
              <small>Non conservée</small>
            </div>
            <div className="stat-card">
              <div className="stat-card-top">
                <span>Profil</span>
              </div>
              <strong>Démo</strong>
              <small>Non authentifié</small>
            </div>
          </div>

          <section className="admin-section" id="orders">
            <div className="admin-section-header">
              <h2>Commandes récentes</h2>
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
                      <th>Lot</th>
                      <th>Total</th>
                      <th>Statut</th>
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
                        <td>{order.items[0]?.lot}</td>
                        <td>{formatCurrency(order.total)}</td>
                        <td>
                          <span className="status-badge">{order.status}</span>
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
                  <h3>Aucune commande pour le moment.</h3>
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
              <p className="muted">Aucun favori enregistré. Utilisez le cœur sur une fiche produit.</p>
            )}
          </section>

          <section className="admin-section form-card account-panel" id="addresses">
            <h2>Adresses</h2>
            <p className="muted">
              Pour protéger vos données dans cette démonstration, aucune adresse n’est conservée après le
              checkout.
            </p>
            <button className="button button-outline" disabled>
              Disponible avec un compte sécurisé
            </button>
          </section>
          <section className="admin-section form-card account-panel" id="invoices">
            <h2>Factures</h2>
            <p className="muted">
              Les reçus fictifs sont accessibles en cliquant sur le numéro d’une commande. Aucune facture
              fiscale n’est produite.
            </p>
          </section>
          <section className="admin-section form-card account-panel" id="settings">
            <h2>Préférences</h2>
            <p className="muted">
              Gérez le stockage local depuis les préférences de confidentialité dans le pied de page.
            </p>
            <button
              className="button button-outline"
              onClick={() => window.dispatchEvent(new Event("avana:privacy"))}
            >
              Ouvrir les préférences
            </button>
          </section>
        </div>
      </div>
    </section>
  );
}
