"use client";

import { Building2, Download, Mail, Save, UsersRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { b2bStages, type B2BSubmission } from "@/lib/b2b";
import { formatDate } from "@/lib/utils";

export function AdminB2BLive({ leads }: { leads: B2BSubmission[] }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(leads.map((lead) => [lead.id, { status: lead.status, notes: lead.notes }])),
  );
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const save = async (lead: B2BSubmission) => {
    setPending(lead.id);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/b2b/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(drafts[lead.id]),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Enregistrement impossible.");
      setMessage("Prospect mis à jour.");
      router.refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Enregistrement impossible.");
    } finally {
      setPending(null);
    }
  };

  return (
    <>
      <div className="admin-topbar">
        <div>
          <span className="small muted">CRM professionnel</span>
          <h1>Pipeline B2B</h1>
        </div>
        <div className="admin-actions">
          <span className="presentation-badge">Données serveur</span>
          <Link className="button button-outline button-sm" href="/api/admin/b2b/export" prefetch={false}>
            <Download size={15} /> Exporter CSV
          </Link>
        </div>
      </div>
      <div className="stat-grid">
        <div className="stat-card">
          <span>Leads actifs</span>
          <strong>{leads.filter((lead) => !["Client", "Perdu"].includes(lead.status)).length}</strong>
          <small>À traiter</small>
        </div>
        <div className="stat-card">
          <span>Nouveaux</span>
          <strong>{leads.filter((lead) => lead.status === "Nouveau lead").length}</strong>
          <small>Premier contact requis</small>
        </div>
        <div className="stat-card">
          <span>Échantillons</span>
          <strong>{leads.filter((lead) => lead.status === "Échantillon").length}</strong>
          <small>En suivi</small>
        </div>
        <div className="stat-card">
          <span>Clients</span>
          <strong>{leads.filter((lead) => lead.status === "Client").length}</strong>
          <small>Convertis</small>
        </div>
      </div>
      {message && (
        <p className="form-feedback admin-global-feedback" role="status">
          {message}
        </p>
      )}
      <section className="admin-section">
        {!leads.length ? (
          <div className="empty-state admin-empty">
            <div>
              <UsersRound size={36} />
              <h2>Aucune demande B2B.</h2>
              <p>Les demandes professionnelles arriveront automatiquement ici.</p>
            </div>
          </div>
        ) : (
          <div className="admin-lead-grid">
            {leads.map((lead) => {
              const draft = drafts[lead.id];
              return (
                <article className="admin-lead-card" key={lead.id}>
                  <header>
                    <div className="form-card-icon">
                      <Building2 size={18} />
                    </div>
                    <div>
                      <span className="small muted">
                        {formatDate(lead.receivedAt)} · {lead.segment}
                      </span>
                      <h2>{lead.company}</h2>
                      <p>
                        {lead.firstName} {lead.lastName}
                      </p>
                    </div>
                  </header>
                  <a href={`mailto:${lead.email}`}>
                    <Mail size={14} /> {lead.email}
                  </a>
                  {lead.phone && <a href={`tel:${lead.phone}`}>{lead.phone}</a>}
                  <dl>
                    <div>
                      <dt>Produit</dt>
                      <dd>{lead.product || "À préciser"}</dd>
                    </div>
                    <div>
                      <dt>Volume</dt>
                      <dd>{lead.volume || "À préciser"}</dd>
                    </div>
                    <div>
                      <dt>Fréquence</dt>
                      <dd>{lead.frequency || "À préciser"}</dd>
                    </div>
                    <div>
                      <dt>Province</dt>
                      <dd>{lead.province || "—"}</dd>
                    </div>
                  </dl>
                  {lead.comment && <blockquote>{lead.comment}</blockquote>}
                  <label>
                    Étape
                    <select
                      value={draft.status}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [lead.id]: { ...draft, status: event.target.value as B2BSubmission["status"] },
                        }))
                      }
                    >
                      {b2bStages.map((stage) => (
                        <option value={stage} key={stage}>
                          {stage}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Notes internes
                    <textarea
                      rows={3}
                      value={draft.notes}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [lead.id]: { ...draft, notes: event.target.value },
                        }))
                      }
                    />
                  </label>
                  <button
                    className="button button-dark button-sm"
                    disabled={pending !== null}
                    onClick={() => void save(lead)}
                  >
                    <Save size={15} /> Enregistrer
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
