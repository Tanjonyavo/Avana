"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Boxes,
  BriefcaseBusiness,
  ClipboardCheck,
  FileText,
  FlaskConical,
  Gauge,
  Import,
  Landmark,
  LogOut,
  Megaphone,
  MessageSquareText,
  Package,
  Printer,
  ShieldAlert,
  Settings,
  ShoppingCart,
  Tags,
  UsersRound,
  Warehouse,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/admin", icon: Gauge },
  { label: "Produits", href: "/admin/produits", icon: Package },
  { label: "Lots", href: "/admin/lots", icon: Tags },
  { label: "Stocks", href: "/admin/stocks", icon: Warehouse },
  { label: "Commandes", href: "/admin/commandes", icon: ShoppingCart },
  { label: "Clients", href: "/admin/clients", icon: UsersRound },
  { label: "B2B", href: "/admin/b2b", icon: BriefcaseBusiness },
  { label: "Messages", href: "/admin/messages", icon: MessageSquareText },
  { label: "Fournisseurs", href: "/admin/fournisseurs", icon: Boxes },
  { label: "Importations", href: "/admin/importations", icon: Import },
  { label: "Documents", href: "/admin/documents", icon: FileText },
  { label: "Conformité", href: "/admin/conformite", icon: ClipboardCheck },
  { label: "Rappels", href: "/admin/rappels", icon: ShieldAlert },
  { label: "Marketing", href: "/admin/marketing", icon: Megaphone },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  { label: "Finances", href: "/admin/finances", icon: Landmark },
  { label: "R&D / Roadmap", href: "/admin/roadmap", icon: FlaskConical },
  { label: "Paramètres", href: "/admin/parametres", icon: Settings },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [logoutError, setLogoutError] = useState("");
  if (pathname === "/admin/connexion") return children;
  const logout = async () => {
    setLogoutError("");
    try {
      const response = await fetch("/api/admin/logout", { method: "POST" });
      if (!response.ok) throw new Error("Logout failed");
    } catch {
      setLogoutError("Déconnexion non confirmée. Réessayez.");
      return;
    }
    router.replace("/admin/connexion");
    router.refresh();
  };
  return (
    <div className="admin-layout">
      <aside className="admin-sidebar-wrap">
        <div className="admin-sidebar">
          <div className="admin-brand">
            <div>
              <strong>AVANA</strong>
              <span> OS</span>
            </div>
            <span>INTERNE</span>
          </div>
          <nav className="admin-nav" aria-label="Navigation AVANA OS">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  className={`admin-nav-item ${active ? "active" : ""}`}
                  href={item.href}
                  key={item.href}
                  title={item.label}
                >
                  <Icon size={17} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="admin-sidebar-footer">
            {logoutError && <p role="alert">{logoutError}</p>}
            <div className="admin-user">
              <div className="admin-avatar">A</div>
              <div>
                <strong>Équipe fondatrice</strong>
                <span>Session protégée</span>
              </div>
            </div>
            <button
              className="admin-logout"
              onClick={() => window.print()}
              title="Imprimer ou enregistrer en PDF"
            >
              <Printer size={16} />
              <span>Imprimer / PDF</span>
            </button>
            <button className="admin-logout" onClick={logout} title="Se déconnecter">
              <LogOut size={16} />
              <span>Se déconnecter</span>
            </button>
          </div>
        </div>
      </aside>
      <main className="admin-main" id="contenu">
        {children}
      </main>
    </div>
  );
}
