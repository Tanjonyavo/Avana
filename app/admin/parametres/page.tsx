import { requireAdminPageSession } from "@/lib/server/admin-page";
import { AlertTriangle, CheckCircle2, CircleX, Settings2 } from "lucide-react";
import { commerceSettings } from "@/lib/server/config";
import { getLaunchReadiness } from "@/lib/server/readiness";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireAdminPageSession();
  const readiness = await getLaunchReadiness();
  const readyCount = readiness.checks.filter((item) => item.status === "ready").length;
  const progress = Math.round((readyCount / readiness.checks.length) * 100);
  return (
    <>
      <div className="admin-topbar">
        <div>
          <span className="small muted">Configuration et lancement</span>
          <h1>Paramètres</h1>
        </div>
        <div className="admin-actions">
          <span className={`presentation-badge ${readiness.blockingCount ? "warning" : ""}`}>
            {readiness.blockingCount ? `${readiness.blockingCount} blocage(s)` : "Prêt à publier"}
          </span>
        </div>
      </div>

      <section className="chart-card readiness-hero">
        <div>
          <span className="small">PRÉPARATION PRODUCTION</span>
          <h2>{progress} % configuré</h2>
          <p>
            {readiness.checkoutReady
              ? "Le checkout peut accepter des paiements réels."
              : "Terminez les éléments bloquants avant d’activer les ventes."}
          </p>
        </div>
        <div className="readiness-progress" aria-label={`${progress} % configuré`}>
          <span style={{ width: `${progress}%` }} />
        </div>
      </section>

      <div className="readiness-grid">
        {readiness.checks.map((item) => {
          const Icon =
            item.status === "ready" ? CheckCircle2 : item.status === "warning" ? AlertTriangle : CircleX;
          return (
            <article className={`readiness-check ${item.status}`} key={item.id}>
              <Icon size={20} />
              <div>
                <strong>{item.label}</strong>
                <p>{item.status === "ready" ? "Configuré et détecté." : item.detail}</p>
              </div>
            </article>
          );
        })}
      </div>

      <section className="admin-section chart-grid">
        <div className="chart-card">
          <div className="admin-section-header">
            <h2>Commerce</h2>
            <Settings2 size={19} />
          </div>
          <div className="summary-line">
            <span>Livraison standard</span>
            <strong>{formatCurrency(commerceSettings.standardShippingCents / 100)}</strong>
          </div>
          <div className="summary-line">
            <span>Livraison express</span>
            <strong>{formatCurrency(commerceSettings.expressShippingCents / 100)}</strong>
          </div>
          <div className="summary-line">
            <span>Gratuité dès</span>
            <strong>{formatCurrency(commerceSettings.freeShippingThresholdCents / 100)}</strong>
          </div>
          <div className="summary-line">
            <span>Réservation de stock</span>
            <strong>
              {commerceSettings.reservationMinutes} min + {commerceSettings.reservationGraceMinutes} min
            </strong>
          </div>
          <div className="summary-line">
            <span>Alerte stock faible</span>
            <strong>≤ {commerceSettings.lowStockThreshold} unités</strong>
          </div>
          <div className="summary-line">
            <span>Taxes automatiques Stripe</span>
            <strong>{commerceSettings.automaticTax ? "Actives" : "Désactivées"}</strong>
          </div>
        </div>
        <div className="chart-card">
          <h2>État des données</h2>
          <div className="summary-line">
            <span>Produits actifs</span>
            <strong>{readiness.metrics.activeProducts}</strong>
          </div>
          <div className="summary-line">
            <span>Formats vendables</span>
            <strong>{readiness.metrics.activeVariants}</strong>
          </div>
          <div className="summary-line">
            <span>Lots publics</span>
            <strong>{readiness.metrics.publicLots}</strong>
          </div>
          <div className="summary-line">
            <span>Courriels en échec</span>
            <strong>{readiness.metrics.failedNotifications}</strong>
          </div>
          <div className="summary-line">
            <span>Dernier webhook</span>
            <strong>
              {readiness.metrics.lastWebhookAt ? formatDate(readiness.metrics.lastWebhookAt) : "Non testé"}
            </strong>
          </div>
        </div>
      </section>

      <section className="chart-card launch-steps">
        <h2>Derniers gestes hors code</h2>
        <ol>
          <li>Créer les projets Stripe, Supabase et Resend, puis renseigner leurs clés dans l’hébergeur.</li>
          <li>
            Appliquer <code>supabase/commerce.sql</code>, publier les vrais produits et effectuer un paiement
            test.
          </li>
          <li>Configurer le webhook Stripe et le domaine d’envoi Resend sur le domaine final.</li>
          <li>
            Faire valider les prix, l’étiquetage, les taxes et les politiques par les spécialistes appropriés.
          </li>
          <li>
            Déployer, relier le DNS Squarespace et vérifier <code>/api/health</code>.
          </li>
        </ol>
        <p className="small muted">
          Le détail exact des commandes et variables se trouve dans <code>README.md</code>.
        </p>
      </section>
    </>
  );
}
