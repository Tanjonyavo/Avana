"use client";

import { Mail, MessageSquareText, PackageSearch, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  submissionStatuses,
  type AdminGeneralSubmission,
  type SubmissionStatus,
} from "@/lib/submission-status";
import { formatDate } from "@/lib/utils";

const statusLabels: Record<SubmissionStatus, string> = {
  new: "Nouveau",
  processing: "En traitement",
  resolved: "Résolu",
  spam: "Indésirable",
};

function value(payload: Record<string, unknown>, key: string) {
  return typeof payload[key] === "string" ? payload[key] : "";
}

export function AdminMessagesManager({ submissions }: { submissions: AdminGeneralSubmission[] }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(
      submissions.map((submission) => [
        submission.id,
        { status: submission.status, notes: submission.notes },
      ]),
    ),
  );
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const save = async (submission: AdminGeneralSubmission) => {
    setPending(submission.id);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/submissions/${submission.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(drafts[submission.id]),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Enregistrement impossible.");
      setMessage("Demande mise à jour.");
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
          <span className="small muted">Boîte de réception</span>
          <h1>Messages</h1>
        </div>
        <div className="admin-actions">
          <span className="presentation-badge">Données serveur</span>
        </div>
      </div>
      <div className="stat-grid">
        <div className="stat-card">
          <span>Nouveaux</span>
          <strong>{submissions.filter((item) => item.status === "new").length}</strong>
          <small>À traiter</small>
        </div>
        <div className="stat-card">
          <span>En traitement</span>
          <strong>{submissions.filter((item) => item.status === "processing").length}</strong>
          <small>Suivi actif</small>
        </div>
        <div className="stat-card">
          <span>Contacts</span>
          <strong>{submissions.filter((item) => item.kind === "contact").length}</strong>
          <small>Messages reçus</small>
        </div>
        <div className="stat-card">
          <span>Attentes</span>
          <strong>{submissions.filter((item) => item.kind === "waitlist").length}</strong>
          <small>Intérêts produits</small>
        </div>
      </div>
      {message && (
        <p className="form-feedback admin-global-feedback" role="status">
          {message}
        </p>
      )}
      <section className="admin-section">
        {!submissions.length ? (
          <div className="empty-state admin-empty">
            <div>
              <MessageSquareText size={34} />
              <h2>Aucun message.</h2>
              <p>Les contacts et demandes d’attente apparaîtront ici.</p>
            </div>
          </div>
        ) : (
          <div className="admin-lead-grid">
            {submissions.map((submission) => {
              const draft = drafts[submission.id] || { status: submission.status, notes: submission.notes };
              const email = value(submission.payload, "email");
              return (
                <article className="admin-lead-card" key={submission.id}>
                  <header>
                    <div className="form-card-icon">
                      {submission.kind === "contact" ? <Mail size={18} /> : <PackageSearch size={18} />}
                    </div>
                    <div>
                      <span className="small muted">
                        {formatDate(submission.receivedAt)} ·{" "}
                        {submission.kind === "contact" ? "Contact" : "Liste d’attente"}
                      </span>
                      <h2>
                        {submission.kind === "contact"
                          ? value(submission.payload, "subject") || "Message"
                          : value(submission.payload, "productId") || "Produit"}
                      </h2>
                      <p>{value(submission.payload, "name") || email}</p>
                    </div>
                  </header>
                  {email && (
                    <a href={`mailto:${email}`}>
                      <Mail size={14} /> {email}
                    </a>
                  )}
                  <blockquote>
                    {submission.kind === "contact"
                      ? value(submission.payload, "message")
                      : `Format : ${value(submission.payload, "variantId") || "à préciser"}`}
                  </blockquote>
                  <label>
                    État
                    <select
                      value={draft.status}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [submission.id]: { ...draft, status: event.target.value as SubmissionStatus },
                        }))
                      }
                    >
                      {submissionStatuses.map((status) => (
                        <option value={status} key={status}>
                          {statusLabels[status]}
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
                          [submission.id]: { ...draft, notes: event.target.value },
                        }))
                      }
                    />
                  </label>
                  <button
                    className="button button-dark button-sm"
                    disabled={pending !== null}
                    onClick={() => void save(submission)}
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
