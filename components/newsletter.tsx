"use client";

import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/components/app-providers";
import { postSubmission } from "@/lib/submissions-client";
import { trackEvent } from "@/lib/analytics-client";

export function Newsletter() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const { notify } = useApp();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setMessage("");
    try {
      const result = await postSubmission({ kind: "newsletter", email, source: "site", _gotcha: "" });
      trackEvent("newsletter_signup", { mode: result.mode || "demo" });
      setEmail("");
      setMessage(
        result.mode === "live"
          ? "Un courriel de confirmation vient de vous être envoyé."
          : "Mode démo : aucune donnée n’a été conservée.",
      );
      notify(result.mode === "live" ? "Vérifiez votre courriel" : "Formulaire validé en mode démo");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Inscription impossible.");
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="newsletter">
      <div className="section-shell newsletter-box">
        <div>
          <span className="eyebrow">Le lancement AVANA</span>
          <h2>Suivre le projet, dès l’origine.</h2>
          <p className="muted">
            Recevez les avancées produits, les essais et la date d’ouverture lorsque celle-ci sera confirmée.
          </p>
        </div>
        <div>
          <form className="inline-form" onSubmit={submit}>
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Votre courriel"
              aria-label="Votre courriel"
            />
            <button className="button button-dark" disabled={pending} type="submit">
              {pending ? "Inscription…" : "Rejoindre le lancement"} <ArrowRight size={17} />
            </button>
          </form>
          {message && (
            <p className="inline-form-message" aria-live="polite">
              {message}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
