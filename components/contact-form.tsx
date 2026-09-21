"use client";

import { useState } from "react";
import { useApp } from "@/components/app-providers";
import { postSubmission } from "@/lib/submissions-client";

export function ContactForm() {
  const { notify } = useApp();
  const [sentMode, setSentMode] = useState<"demo" | "live" | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError("");
    const formElement = event.currentTarget;
    const data = new FormData(formElement);
    const payload = {
      kind: "contact",
      name: String(data.get("name") || ""),
      email: String(data.get("email") || ""),
      requestType: String(data.get("requestType") || ""),
      subject: String(data.get("subject") || ""),
      message: String(data.get("message") || ""),
      consent: data.get("consent") === "on",
      _gotcha: String(data.get("_gotcha") || ""),
    };

    try {
      const result = await postSubmission(payload);
      const mode = result.mode || "demo";
      setSentMode(mode);
      formElement.reset();
      notify(mode === "live" ? "Message transmis à AVANA" : "Formulaire validé en mode démo");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "La demande n’a pas pu être transmise.");
    } finally {
      setPending(false);
    }
  };

  if (sentMode) {
    return (
      <div className="form-card form-success">
        <div className="confirmation-icon">✓</div>
        <h2>{sentMode === "live" ? "Demande transmise." : "Formulaire validé."}</h2>
        <p className="muted">
          {sentMode === "live"
            ? "Merci. L’équipe AVANA a reçu votre message."
            : "Le site est en mode démonstration : aucune donnée personnelle n’a été stockée ni envoyée."}
        </p>
        <button className="button button-outline" onClick={() => setSentMode(null)}>
          Nouveau message
        </button>
      </div>
    );
  }

  return (
    <form className="form-card" onSubmit={submit}>
      <div className="form-grid">
        <div className="form-field">
          <label htmlFor="contact-name">Nom *</label>
          <input required id="contact-name" name="name" autoComplete="name" />
        </div>
        <div className="form-field">
          <label htmlFor="contact-email">Courriel *</label>
          <input required type="email" id="contact-email" name="email" autoComplete="email" />
        </div>
        <div className="form-field full">
          <label htmlFor="contact-type">Type de demande</label>
          <select id="contact-type" name="requestType">
            {["Commande", "Professionnel", "Partenariat", "Fournisseur", "Presse", "Autre"].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
        <div className="form-field full">
          <label htmlFor="contact-subject">Sujet *</label>
          <input required id="contact-subject" name="subject" />
        </div>
        <div className="form-field full">
          <label htmlFor="contact-message">Message *</label>
          <textarea required id="contact-message" name="message" />
        </div>
        <div className="honeypot" aria-hidden="true">
          <label htmlFor="contact-website">Ne pas remplir</label>
          <input id="contact-website" name="_gotcha" tabIndex={-1} autoComplete="off" />
        </div>
        <label className="form-check full">
          <input name="consent" type="checkbox" required /> J’accepte que ces informations soient utilisées
          pour répondre à ma demande.
        </label>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button button-dark" disabled={pending} type="submit">
        {pending ? "Envoi…" : "Envoyer la demande"}
      </button>
    </form>
  );
}
