"use client";

import Link from "next/link";
import { CheckCircle2, MailCheck } from "lucide-react";
import { useState } from "react";

export function NewsletterConfirmation({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const confirm = async () => {
    setState("pending");
    setMessage("");
    try {
      const response = await fetch("/api/newsletter/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Confirmation impossible.");
      setState("success");
    } catch (caught) {
      setState("error");
      setMessage(caught instanceof Error ? caught.message : "Confirmation impossible.");
    }
  };

  if (state === "success") {
    return (
      <div className="confirmation-card">
        <div className="confirmation-icon">
          <CheckCircle2 size={31} />
        </div>
        <h1>Inscription confirmée.</h1>
        <p className="lead">
          Bienvenue dans le journal AVANA. Vous pouvez vous désabonner en un clic depuis chaque message.
        </p>
        <Link className="button button-dark" href="/">
          Découvrir AVANA
        </Link>
      </div>
    );
  }

  return (
    <div className="confirmation-card">
      <div className="confirmation-icon">
        <MailCheck size={31} />
      </div>
      <span className="status-badge">Consentement explicite</span>
      <h1>Confirmez votre inscription.</h1>
      <p className="lead">
        Cette dernière étape protège votre adresse contre les inscriptions non sollicitées.
      </p>
      {message && (
        <p className="form-error" role="alert">
          {message}
        </p>
      )}
      <button
        className="button button-dark"
        disabled={state === "pending" || token.length < 32}
        onClick={() => void confirm()}
      >
        {state === "pending" ? "Confirmation…" : "Confirmer mon inscription"}
      </button>
      <p className="small muted">Vous ne souhaitez pas vous inscrire? Fermez simplement cette page.</p>
    </div>
  );
}
