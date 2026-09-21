import { requireAdminPageSession } from "@/lib/server/admin-page";
import { DatabaseZap, FileText, Plus } from "lucide-react";
import { notFound } from "next/navigation";
import { AdminOperationsManager } from "@/components/admin-operations-manager";
import { isOperationModule, operationModules, type OperationModule } from "@/lib/operations";
import { isSupabaseAdminConfigured } from "@/lib/server/config";
import { getRecallImpacts, listOperationalRecords } from "@/lib/server/operations";
import { COMMERCE_ENABLED } from "@/lib/site";

const demoRows: Record<OperationModule, string[][]> = {
  fournisseurs: [
    ["Fournisseur démo A", "Évaluation", "Madagascar", "SAVA", "Gousses", "DÉMO"],
    ["Partenaire démo B", "Prospect", "Canada", "Québec", "Importation", "DÉMO"],
  ],
  importations: [
    ["IMP-DEMO-001", "Reçu", "DEMO-MG-SAVA-001", "5 kg", "126,40 $/kg", "DÉMO"],
    ["IMP-DEMO-002", "Planification", "DEMO-MG-SAVA-002", "2 kg", "À calculer", "HYPOTHÈSE"],
  ],
  documents: [
    ["Fiche lot 001", "Brouillon", "Fiche technique", "DEMO-MG-SAVA-001", "Interne", "DÉMO"],
    ["Analyse laboratoire", "À obtenir", "Analyse", "—", "Confidentiel", "DÉMO"],
  ],
  conformite: [
    ["Gousses · 5 unités", "Brouillon", "Nom usuel à valider", "FR / EN", "DEMO-MG-SAVA-001", "DÉMO"],
    ["Poudre · 20 g", "À vérifier", "Quantité nette 20 g", "FR / EN", "DEMO-MG-SAVA-001", "DÉMO"],
  ],
  roadmap: [
    ["Validation fournisseur", "En cours", "Fondation", "T3 2026", "Échantillons documentés", "HYPOTHÈSE"],
    ["Premier lot", "À venir", "Opérations", "2027", "Réception contrôlée", "HYPOTHÈSE"],
  ],
  rappels: [],
};

const demoColumns: Record<OperationModule, string[]> = {
  fournisseurs: ["Société", "Statut", "Pays", "Région", "Produits", "Donnée"],
  importations: ["Dossier", "Statut", "Lot", "Quantité", "Coût rendu", "Donnée"],
  documents: ["Document", "Statut", "Type", "Lot", "Confidentialité", "Donnée"],
  conformite: ["Produit", "Statut", "Résumé", "Langues", "Lot", "Donnée"],
  roadmap: ["Objectif", "Statut", "Responsable", "Échéance", "Preuve", "Donnée"],
  rappels: ["Dossier", "Statut", "Lot", "Portée", "Unités", "Donnée"],
};

function ConfigurationRequired({ module }: { module: OperationModule }) {
  const config = operationModules[module];
  return (
    <>
      <div className="admin-topbar">
        <div>
          <span className="small muted">{config.eyebrow}</span>
          <h1>{config.title}</h1>
        </div>
      </div>
      <section className="chart-card admin-config-card">
        <DatabaseZap size={28} />
        <h2>Registre indisponible.</h2>
        <p>
          Configurez Supabase et appliquez <code>supabase/commerce.sql</code> pour activer ce module.
        </p>
      </section>
    </>
  );
}

export default async function GenericAdminPage({ params }: { params: Promise<{ section: string }> }) {
  await requireAdminPageSession();
  const { section } = await params;
  if (!isOperationModule(section)) notFound();
  const config = operationModules[section];

  if (COMMERCE_ENABLED) {
    if (!isSupabaseAdminConfigured()) return <ConfigurationRequired module={section} />;
    const records = await listOperationalRecords(section).catch(() => null);
    if (!records) return <ConfigurationRequired module={section} />;
    const recallImpacts = section === "rappels" ? await getRecallImpacts(records).catch(() => ({})) : {};
    return <AdminOperationsManager module={section} records={records} recallImpacts={recallImpacts} />;
  }

  const rows = demoRows[section];
  return (
    <>
      <div className="admin-topbar">
        <div>
          <span className="small muted">{config.eyebrow}</span>
          <h1>{config.title}</h1>
        </div>
        <div className="admin-actions">
          <span className="presentation-badge">Données de démonstration</span>
          <button className="button button-dark button-sm" disabled>
            <Plus size={15} /> Ajouter
          </button>
        </div>
      </div>
      <section className="chart-card admin-module-intro">
        <FileText size={22} />
        <div>
          <h2>Mode démonstration</h2>
          <p>{config.description}</p>
        </div>
      </section>
      <section className="admin-section">
        {rows.length ? (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {demoColumns[section].map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row[0]}>
                    {row.map((cell, index) => (
                      <td key={`${row[0]}-${index}`}>{index === 0 ? <strong>{cell}</strong> : cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state admin-empty">
            <div>
              <FileText size={34} />
              <h2>Aucun rappel de démonstration.</h2>
              <p>Le module est prêt à documenter un dossier réel une fois Supabase connecté.</p>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
