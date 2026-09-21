"use client";

import { MailCheck, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDate } from "@/lib/utils";
import type { AdminMarketingData } from "@/types/commerce";

const initial = {
  subject: "",
  preheader: "",
  heading: "",
  body: "",
  actionLabel: "",
  actionUrl: "",
  confirmed: false,
};

export function AdminMarketingManager({ data }: { data: AdminMarketingData }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!window.confirm(`Mettre ce courriel en file pour ${data.subscribed} abonné(s) confirmé(s) ?`)) return;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/newsletter/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = (await response.json()) as { error?: string; recipientCount?: number };
      if (!response.ok) throw new Error(result.error || "Envoi impossible.");
      setMessage(`Campagne mise en file pour ${result.recipientCount || 0} destinataire(s).`);
      setForm(initial);
      router.refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Envoi impossible.");
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <div className="stat-grid">
        <div className="stat-card">
          <span>Confirmés</span>
          <strong>{data.subscribed}</strong>
          <small>Destinataires autorisés</small>
        </div>
        <div className="stat-card">
          <span>En attente</span>
          <strong>{data.pending}</strong>
          <small>Double consentement</small>
        </div>
        <div className="stat-card">
          <span>Désabonnés</span>
          <strong>{data.unsubscribed}</strong>
          <small>Exclus automatiquement</small>
        </div>
        <div className="stat-card">
          <span>Campagnes</span>
          <strong>{data.campaigns.length}</strong>
          <small>Historique récent</small>
        </div>
      </div>
      {message && (
        <p className="form-feedback admin-global-feedback" role="status">
          {message}
        </p>
      )}
      <section className="admin-section chart-grid marketing-layout">
        <form className="chart-card admin-campaign-form" onSubmit={submit}>
          <div className="admin-section-header">
            <h2>Nouvelle campagne</h2>
            <Send size={18} />
          </div>
          <label>
            Objet
            <input
              required
              maxLength={160}
              value={form.subject}
              onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
            />
          </label>
          <label>
            Pré-en-tête
            <input
              maxLength={180}
              value={form.preheader}
              onChange={(event) => setForm((current) => ({ ...current, preheader: event.target.value }))}
            />
          </label>
          <label>
            Titre
            <input
              required
              maxLength={160}
              value={form.heading}
              onChange={(event) => setForm((current) => ({ ...current, heading: event.target.value }))}
            />
          </label>
          <label>
            Message
            <textarea
              required
              rows={8}
              maxLength={10000}
              value={form.body}
              onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
            />
          </label>
          <div className="form-grid">
            <label className="form-field">
              Libellé du bouton
              <input
                maxLength={80}
                value={form.actionLabel}
                onChange={(event) => setForm((current) => ({ ...current, actionLabel: event.target.value }))}
              />
            </label>
            <label className="form-field">
              URL du bouton
              <input
                type="url"
                value={form.actionUrl}
                onChange={(event) => setForm((current) => ({ ...current, actionUrl: event.target.value }))}
              />
            </label>
          </div>
          <label className="consent-check">
            <input
              type="checkbox"
              required
              checked={form.confirmed}
              onChange={(event) => setForm((current) => ({ ...current, confirmed: event.target.checked }))}
            />
            <span>
              <strong>Je confirme cet envoi</strong>
              <small>Uniquement aux abonnés ayant confirmé leur consentement.</small>
            </span>
          </label>
          <button className="button button-dark" disabled={pending || !data.subscribed} type="submit">
            <MailCheck size={16} /> {pending ? "Mise en file…" : `Envoyer à ${data.subscribed} abonné(s)`}
          </button>
        </form>
        <div className="chart-card">
          <h2>Historique</h2>
          <div className="campaign-history">
            {data.campaigns.map((campaign) => (
              <article key={campaign.id}>
                <div>
                  <strong>{campaign.subject}</strong>
                  <span>
                    {formatDate(campaign.createdAt)} · {campaign.status}
                  </span>
                </div>
                <div>
                  <strong>
                    {campaign.sentCount}/{campaign.recipientCount}
                  </strong>
                  <span>{campaign.failedCount} échec(s)</span>
                </div>
              </article>
            ))}
            {!data.campaigns.length && <p className="muted">Aucune campagne envoyée.</p>}
          </div>
          <p className="small muted">
            Chaque message inclut l’identité AVANA et un désabonnement direct. La file reprend automatiquement
            les échecs temporaires.
          </p>
        </div>
      </section>
    </>
  );
}
