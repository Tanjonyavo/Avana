"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight } from "lucide-react";

export function TraceSearchForm({ compact = false, demo = false }: { compact?: boolean; demo?: boolean }) {
  const [code, setCode] = useState(compact && demo ? "DEMO-MG-SAVA-001" : "");
  const [error, setError] = useState("");
  const router = useRouter();
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      setError("Entrez un numéro de lot.");
      return;
    }
    router.push(`/tracabilite/${encodeURIComponent(normalized)}`);
  };
  if (compact)
    return (
      <form className="trace-search" onSubmit={submit}>
        <input
          aria-label="Numéro de lot"
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            setError("");
          }}
          placeholder={demo ? "DEMO-MG-SAVA-001" : "MG-SAVA-2027-001"}
          autoComplete="off"
        />
        <button className="button button-dark" type="submit">
          Rechercher <ArrowRight size={17} />
        </button>
        {error && (
          <span className="sr-only" role="alert">
            {error}
          </span>
        )}
      </form>
    );
  return (
    <form className="trace-input-card" onSubmit={submit}>
      <span className="demo-badge">{demo ? "Recherche démo" : "Traçabilité publique"}</span>
      <h2 style={{ fontSize: "2.4rem", margin: "1rem 0" }}>Entrez votre numéro de lot</h2>
      <label htmlFor="lot-code">Numéro inscrit près du QR code</label>
      <input
        id="lot-code"
        value={code}
        onChange={(event) => {
          setCode(event.target.value);
          setError("");
        }}
        placeholder={demo ? "EX. DEMO-MG-SAVA-001" : "EX. MG-SAVA-2027-001"}
        autoComplete="off"
        aria-describedby={error ? "lot-error" : "lot-example"}
      />
      {error && (
        <p id="lot-error" className="field-error">
          {error}
        </p>
      )}
      <button className="button button-dark" type="submit">
        Rechercher <ArrowRight size={17} />
      </button>
      {demo ? (
        <div className="trace-example" id="lot-example">
          <span>Vous explorez la démonstration ?</span>
          <button
            type="button"
            className="text-link trace-example-button"
            onClick={() => setCode("DEMO-MG-SAVA-001")}
          >
            Utiliser le lot exemple
          </button>
        </div>
      ) : (
        <p className="trace-example" id="lot-example">
          Le code apparaît près du QR sur l’emballage.
        </p>
      )}
    </form>
  );
}
