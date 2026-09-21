"use client";

import Link from "next/link";
import { CheckCircle2, MailX } from "lucide-react";
import { useState } from "react";

export function NewsletterUnsubscribe({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "pending" | "success" | "error">("idle");

  const unsubscribe = async () => {
    setState("pending");
    try {
      const response = await fetch(`/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`, {
        method: "POST",
      });
      setState(response.ok ? "success" : "error");
    } catch {
      setState("error");
    }
  };

  if (state === "success") {
    return (
      <div className="confirmation-card">
        <div className="confirmation-icon">
          <CheckCircle2 size={31} />
        </div>
        <h1>Désabonnement confirmé.</h1>
        <p className="lead">Cette adresse ne recevra plus les campagnes AVANA.</p>
        <Link className="button button-outline" href="/">
          Retour à AVANA
        </Link>
      </div>
    );
  }

  return (
    <div className="confirmation-card">
      <div className="confirmation-icon">
        <MailX size={31} />
      </div>
      <h1>Se désabonner.</h1>
      <p className="lead">Confirmez pour ne plus recevoir les campagnes du journal AVANA.</p>
      {state === "error" && (
        <p className="form-error" role="alert">
          Le désabonnement n’a pas pu être confirmé.
        </p>
      )}
      <button
        className="button button-dark"
        disabled={state === "pending" || token.length < 32}
        onClick={() => void unsubscribe()}
      >
        {state === "pending" ? "Traitement…" : "Confirmer le désabonnement"}
      </button>
    </div>
  );
}
