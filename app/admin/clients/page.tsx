import { requireAdminPageSession } from "@/lib/server/admin-page";
import { UsersRound } from "lucide-react";
import { isSupabaseAdminConfigured } from "@/lib/server/config";
import { listAdminCustomers } from "@/lib/server/orders";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminClientsPage() {
  await requireAdminPageSession();
  const configured = isSupabaseAdminConfigured();
  const customers = configured ? await listAdminCustomers().catch(() => []) : [];
  return (
    <>
      <div className="admin-topbar">
        <div>
          <span className="small muted">Relations B2C</span>
          <h1>Clients</h1>
        </div>
        <div className="admin-actions">
          <span className="presentation-badge">
            {configured ? "Données en direct" : "Configuration requise"}
          </span>
        </div>
      </div>
      {!configured ? (
        <section className="chart-card admin-config-card">
          <UsersRound size={28} />
          <h2>Connectez Supabase.</h2>
          <p>Les clients apparaîtront après leur première commande.</p>
        </section>
      ) : (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <span>Clients</span>
              <strong>{customers.length}</strong>
              <small>Courriels uniques</small>
            </div>
            <div className="stat-card">
              <span>Récurrents</span>
              <strong>{customers.filter((customer) => customer.orderCount > 1).length}</strong>
              <small>Plus d’une commande</small>
            </div>
            <div className="stat-card">
              <span>Valeur totale</span>
              <strong>
                {formatCurrency(customers.reduce((sum, customer) => sum + customer.paidCents, 0) / 100)}
              </strong>
              <small>Paiements non remboursés</small>
            </div>
            <div className="stat-card">
              <span>Consentement</span>
              <strong>{customers.filter((customer) => customer.marketingConsent).length}</strong>
              <small>Marketing au checkout</small>
            </div>
          </div>
          <section className="admin-section">
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Courriel</th>
                    <th>Commandes</th>
                    <th>Dépenses</th>
                    <th>Dernière commande</th>
                    <th>Marketing</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr key={customer.email}>
                      <td>
                        <strong>{customer.name || "Client"}</strong>
                      </td>
                      <td>
                        <a href={`mailto:${customer.email}`}>{customer.email}</a>
                      </td>
                      <td>{customer.orderCount}</td>
                      <td>{formatCurrency(customer.paidCents / 100)}</td>
                      <td>{formatDate(customer.lastOrderAt)}</td>
                      <td>{customer.marketingConsent ? "Oui" : "Non"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!customers.length && (
              <div className="empty-state admin-empty">
                <div>
                  <UsersRound size={34} />
                  <h2>Aucun client.</h2>
                  <p>La première commande apparaîtra ici.</p>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
