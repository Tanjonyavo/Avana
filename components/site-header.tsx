"use client";

import Link from "next/link";
import { Heart, Menu, Search, ShoppingBag, UserRound, X } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/components/app-providers";

const links = [
  ["Boutique", "/boutique"],
  ["Traçabilité", "/tracabilite"],
  ["Professionnels", "/professionnels"],
  ["Notre histoire", "/notre-histoire"],
  ["Journal", "/journal"],
];

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { cartCount, favorites, catalogMode, setCartOpen, setSearchOpen } = useApp();
  const announcement =
    catalogMode === "live"
      ? "Paiement sécurisé · Livraison au Canada · Prix en dollars canadiens"
      : catalogMode === "unconfigured"
        ? "La boutique est temporairement indisponible · Le contenu AVANA reste accessible"
        : "Mode démonstration — lancement commercial à confirmer · Livraison non active";
  return (
    <>
      <div className="announcement">
        <span className="announcement-wide">{announcement}</span>
        <span className="announcement-compact">
          {catalogMode === "live"
            ? "Boutique ouverte · CAD"
            : catalogMode === "unconfigured"
              ? "Boutique indisponible"
              : "Démo · ventes inactives"}
        </span>
      </div>
      <header className="site-header">
        <div className="section-shell nav-shell">
          <button
            className="nav-icon mobile-toggle"
            aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
          <Link className="brand" href="/">
            AVANA<span>Madagascar → Québec</span>
          </Link>
          <nav className="nav-links" aria-label="Navigation principale">
            {links.map(([label, href]) => (
              <Link href={href} key={href}>
                {label}
              </Link>
            ))}
          </nav>
          <div className="nav-actions">
            <button className="nav-icon" aria-label="Rechercher (Ctrl K)" onClick={() => setSearchOpen(true)}>
              <Search size={20} />
            </button>
            <Link className="nav-icon" aria-label={`${favorites.length} favoris`} href="/compte">
              <Heart size={20} />
            </Link>
            <Link className="nav-icon" aria-label="Compte" href="/compte">
              <UserRound size={20} />
            </Link>
            <button
              className="nav-icon"
              aria-label={`Panier, ${cartCount} article(s)`}
              onClick={() => setCartOpen(true)}
            >
              <ShoppingBag size={20} />
              {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
            </button>
          </div>
          {mobileOpen && (
            <nav className="mobile-menu" aria-label="Navigation mobile">
              <button className="mobile-search" onClick={() => setSearchOpen(true)}>
                <Search size={18} /> Rechercher
              </button>
              {links.map(([label, href]) => (
                <Link href={href} key={href} onClick={() => setMobileOpen(false)}>
                  {label}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </header>
    </>
  );
}
