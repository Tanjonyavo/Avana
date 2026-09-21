"use client";

import { ArrowRight, LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminLoginForm({ returnTo, unavailable }: { returnTo: string; unavailable: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState(
    unavailable ? "Configurez ADMIN_PASSWORD et SESSION_SECRET sur l’hébergeur." : "",
  );
  const [pending, setPending] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, otp, returnTo }),
      });
      const result = (await response.json()) as { ok?: boolean; error?: string; returnTo?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || "Connexion impossible.");
      router.replace(result.returnTo || "/admin");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Connexion impossible.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form className="admin-login-card" onSubmit={submit}>
      <div className="admin-login-mark">
        <LockKeyhole size={22} />
      </div>
      <span className="eyebrow">Espace interne</span>
      <h1>Connexion à AVANA OS</h1>
      <p>Accès réservé à l’équipe. La session est signée, sécurisée et expire automatiquement.</p>
      <div className="form-field">
        <label htmlFor="admin-password">Mot de passe</label>
        <input
          autoComplete="current-password"
          autoFocus
          disabled={unavailable}
          id="admin-password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </div>
      <div className="form-field">
        <label htmlFor="admin-otp">Code de vérification</label>
        <input
          autoComplete="one-time-code"
          disabled={unavailable}
          id="admin-otp"
          inputMode="numeric"
          maxLength={6}
          minLength={6}
          onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
          pattern="[0-9]{6}"
          required
          type="text"
          value={otp}
        />
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button button-dark" disabled={pending || unavailable} type="submit">
        {pending ? "Vérification…" : "Accéder à AVANA OS"} <ArrowRight size={17} />
      </button>
    </form>
  );
}
