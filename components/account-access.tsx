"use client";

import { KeyRound, Mail, PackageSearch } from "lucide-react";
import { useState } from "react";

export function AccountAccess({ authError = false }: { authError?: boolean }) {
  const [loginEmail, setLoginEmail] = useState("");
  const [orderEmail, setOrderEmail] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [loginMessage, setLoginMessage] = useState(
    authError ? "Ce lien a expiré ou n’est plus valide. Demandez-en un nouveau." : "",
  );
  const [orderMessage, setOrderMessage] = useState("");
  const [pending, setPending] = useState<"login" | "order" | null>(null);

  const requestLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending("login");
    setLoginMessage("");
    try {
      const response = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Envoi impossible.");
      setLoginMessage("Vérifiez votre boîte courriel : votre lien de connexion vient d’être envoyé.");
    } catch (caught) {
      setLoginMessage(caught instanceof Error ? caught.message : "Envoi impossible.");
    } finally {
      setPending(null);
    }
  };

  const requestOrder = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending("order");
    setOrderMessage("");
    try {
      const response = await fetch("/api/orders/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: orderEmail, orderNumber: orderNumber.trim().toUpperCase() }),
      });
      const result = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) throw new Error(result.error || "Demande impossible.");
      setOrderMessage(result.message || "Vérifiez votre boîte courriel.");
    } catch (caught) {
      setOrderMessage(caught instanceof Error ? caught.message : "Demande impossible.");
    } finally {
      setPending(null);
    }
  };

  return (
    <section className="page-section account-access-page">
      <div className="section-shell">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Espace client</span>
            <h1 className="section-title">Vos commandes, simplement.</h1>
          </div>
          <p>Recevez un lien sécurisé par courriel. Aucun mot de passe à retenir.</p>
        </div>
        <div className="account-access-grid">
          <form className="form-card" onSubmit={requestLogin}>
            <div className="form-card-icon">
              <KeyRound size={20} />
            </div>
            <h2>Ouvrir mon compte</h2>
            <p className="muted">
              Retrouvez automatiquement toutes les commandes associées à votre courriel.
            </p>
            <label htmlFor="account-email">Courriel</label>
            <input
              id="account-email"
              type="email"
              required
              autoComplete="email"
              value={loginEmail}
              onChange={(event) => setLoginEmail(event.target.value)}
            />
            <button className="button button-dark" disabled={pending !== null} type="submit">
              <Mail size={16} /> {pending === "login" ? "Envoi…" : "Recevoir mon lien"}
            </button>
            {loginMessage && (
              <p className="form-feedback" role="status">
                {loginMessage}
              </p>
            )}
          </form>

          <form className="form-card" onSubmit={requestOrder}>
            <div className="form-card-icon">
              <PackageSearch size={20} />
            </div>
            <h2>Suivre une commande</h2>
            <p className="muted">Demandez un lien privé pour une commande précise.</p>
            <label htmlFor="order-number">Numéro de commande</label>
            <input
              id="order-number"
              required
              value={orderNumber}
              onChange={(event) => setOrderNumber(event.target.value)}
              placeholder="AVA-2026-000001"
              autoComplete="off"
            />
            <label htmlFor="order-email">Courriel utilisé lors du paiement</label>
            <input
              id="order-email"
              type="email"
              required
              autoComplete="email"
              value={orderEmail}
              onChange={(event) => setOrderEmail(event.target.value)}
            />
            <button className="button button-outline" disabled={pending !== null} type="submit">
              <PackageSearch size={16} /> {pending === "order" ? "Recherche…" : "Envoyer le lien de suivi"}
            </button>
            {orderMessage && (
              <p className="form-feedback" role="status">
                {orderMessage}
              </p>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}
