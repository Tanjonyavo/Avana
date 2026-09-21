"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/components/app-providers";
import { provinces } from "@/data/config";
import { postSubmission } from "@/lib/submissions-client";
import { trackEvent } from "@/lib/analytics-client";

const initial = {
  firstName: "",
  lastName: "",
  company: "",
  email: "",
  segment: "",
  phone: "",
  province: "QC",
  product: "Gousses",
  volume: "",
  frequency: "",
  comment: "",
  consent: false,
};

export function B2BForm() {
  const [form, setForm] = useState(initial);
  const [step, setStep] = useState(0);
  const [sentMode, setSentMode] = useState<"demo" | "live" | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const { notify } = useApp();

  const update = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value =
      event.target instanceof HTMLInputElement && event.target.type === "checkbox"
        ? event.target.checked
        : event.target.value;
    setForm((current) => ({ ...current, [event.target.name]: value }));
    setError("");
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step === 0) {
      setStep(1);
      return;
    }

    setPending(true);
    try {
      const result = await postSubmission({ kind: "b2b", ...form, _gotcha: "" });
      const mode = result.mode || "demo";
      setSentMode(mode);
      trackEvent("lead_submit", { segment: form.segment || "non_precise", product: form.product });
      notify(mode === "live" ? "Demande transmise à AVANA" : "Formulaire validé en mode démo");
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
        <h2>Merci, parlons vanille.</h2>
        <p className="muted">
          {sentMode === "live"
            ? "Votre demande a été transmise à l’équipe AVANA."
            : "Le site est en mode démonstration : aucune donnée personnelle n’a été stockée ni envoyée."}
        </p>
        <button
          className="button button-outline"
          onClick={() => {
            setSentMode(null);
            setForm(initial);
            setStep(0);
          }}
        >
          Envoyer une autre demande
        </button>
      </div>
    );
  }

  return (
    <form className="form-card b2b-form" id="demande" onSubmit={submit}>
      <div className="form-step-header">
        <span className="demo-badge">Étape {step + 1} sur 2</span>
        <span>{step === 0 ? "L’essentiel" : "Votre besoin"}</span>
      </div>
      <h2>{step === 0 ? "Faisons connaissance." : "Précisons votre usage."}</h2>
      <p className="muted">
        {step === 0
          ? "Cinq informations suffisent pour commencer."
          : "Ces précisions sont facultatives, mais nous aident à préparer l’échange."}
      </p>
      {step === 0 ? (
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="firstName">Prénom *</label>
            <input
              required
              id="firstName"
              name="firstName"
              value={form.firstName}
              onChange={update}
              autoComplete="given-name"
            />
          </div>
          <div className="form-field">
            <label htmlFor="lastName">Nom *</label>
            <input
              required
              id="lastName"
              name="lastName"
              value={form.lastName}
              onChange={update}
              autoComplete="family-name"
            />
          </div>
          <div className="form-field full">
            <label htmlFor="company">Entreprise *</label>
            <input
              required
              id="company"
              name="company"
              value={form.company}
              onChange={update}
              autoComplete="organization"
            />
          </div>
          <div className="form-field">
            <label htmlFor="email">Courriel professionnel *</label>
            <input
              required
              type="email"
              id="email"
              name="email"
              value={form.email}
              onChange={update}
              autoComplete="email"
            />
          </div>
          <div className="form-field">
            <label htmlFor="segment">Type d’entreprise *</label>
            <select required id="segment" name="segment" value={form.segment} onChange={update}>
              <option value="">Sélectionner</option>
              {[
                "Pâtisserie",
                "Boulangerie",
                "Chocolaterie",
                "Restaurant",
                "Glacier",
                "Café",
                "Traiteur",
                "Fabricant alimentaire",
                "Distributeur",
              ].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="phone">Téléphone</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={form.phone}
              onChange={update}
              autoComplete="tel"
            />
          </div>
          <div className="form-field">
            <label htmlFor="province">Province</label>
            <select id="province" name="province" value={form.province} onChange={update}>
              {provinces.map((province) => (
                <option value={province.code} key={province.code}>
                  {province.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="product">Produit recherché</label>
            <select id="product" name="product" value={form.product} onChange={update}>
              <option>Gousses</option>
              <option>Poudre</option>
              <option>Les deux</option>
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="volume">Consommation estimée</label>
            <input
              id="volume"
              name="volume"
              value={form.volume}
              onChange={update}
              placeholder="Ex. 250 g / mois"
            />
          </div>
          <div className="form-field full">
            <label htmlFor="frequency">Fréquence d’achat</label>
            <select id="frequency" name="frequency" value={form.frequency} onChange={update}>
              <option value="">Sélectionner</option>
              <option>Hebdomadaire</option>
              <option>Mensuelle</option>
              <option>Trimestrielle</option>
              <option>Ponctuelle</option>
            </select>
          </div>
          <div className="form-field full">
            <label htmlFor="comment">Contexte ou commentaire</label>
            <textarea id="comment" name="comment" value={form.comment} onChange={update} />
          </div>
          <label className="form-check full">
            <input checked={form.consent} name="consent" onChange={update} required type="checkbox" />{" "}
            J’accepte que ces informations soient utilisées pour répondre à ma demande.
          </label>
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-navigation">
        {step === 1 && (
          <button className="button button-outline" onClick={() => setStep(0)} type="button">
            <ArrowLeft size={16} /> Retour
          </button>
        )}
        <button className="button button-dark" disabled={pending} type="submit">
          {step === 0 ? (
            <>
              Continuer <ArrowRight size={16} />
            </>
          ) : pending ? (
            "Envoi…"
          ) : (
            "Parler avec AVANA"
          )}
        </button>
      </div>
    </form>
  );
}
