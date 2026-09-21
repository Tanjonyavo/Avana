"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Play, X } from "lucide-react";
import { useState } from "react";
import { useDialogFocus } from "@/hooks/use-dialog-focus";

const steps = [
  {
    title: "Une marque entre deux territoires",
    copy: "AVANA relie l’origine malgache à une expérience de marque, de données et de commercialisation construite au Québec.",
    href: "/notre-histoire",
    cta: "Voir l’histoire",
  },
  {
    title: "Deux produits pour valider le marché",
    copy: "Un MVP volontairement concentré sur les gousses et la poudre, avec prix, formats et stocks configurables.",
    href: "/boutique",
    cta: "Voir la boutique",
  },
  {
    title: "Chaque lot a une histoire",
    copy: "L’identifiant unique relie origine, étapes logistiques, produits et commandes, sans exposer les données confidentielles.",
    href: "/tracabilite/DEMO-MG-SAVA-001",
    cta: "Explorer un lot",
  },
  {
    title: "Un canal professionnel crédible",
    copy: "Qualification détaillée, échantillons et pipeline permettent de structurer la validation B2B.",
    href: "/professionnels",
    cta: "Voir l’espace B2B",
  },
  {
    title: "AVANA OS centralise l’opération",
    copy: "Produits, lots, stock, commandes, prospects, coûts et données convergent dans un même outil interne.",
    href: "/admin",
    cta: "Ouvrir AVANA OS",
  },
  {
    title: "Une progression maîtrisée",
    copy: "La plateforme rend visible une stratégie simple : prouver la demande, apprendre, puis renforcer progressivement la chaîne de valeur.",
    href: "/notre-approche",
    cta: "Voir l’approche",
  },
];

export function PresentationMode() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const current = steps[step];
  const dialogRef = useDialogFocus<HTMLDivElement>(open, () => setOpen(false));
  return (
    <>
      <button className="button button-outline button-sm" onClick={() => setOpen(true)}>
        <Play size={14} fill="currentColor" /> Mode présentation
      </button>
      {open && (
        <div
          className="walkthrough"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            className="walkthrough-card"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="walkthrough-title"
            tabIndex={-1}
          >
            <button
              className="walkthrough-close"
              onClick={() => setOpen(false)}
              aria-label="Fermer la présentation"
            >
              <X size={18} />
            </button>
            <div className="walkthrough-visual">
              <div className="walkthrough-step">
                Parcours {step + 1} / {steps.length}
              </div>
              <h2 id="walkthrough-title">{current.title}</h2>
            </div>
            <div className="walkthrough-copy">
              <p>{current.copy}</p>
              <Link className="text-link" href={current.href} onClick={() => setOpen(false)}>
                {current.cta} <ArrowRight size={16} />
              </Link>
              <div className="walkthrough-actions">
                <button
                  className="button button-ghost button-sm"
                  disabled={step === 0}
                  onClick={() => setStep(step - 1)}
                >
                  <ArrowLeft size={16} /> Précédent
                </button>
                <div className="walkthrough-dots" aria-hidden="true">
                  {steps.map((_, index) => (
                    <span className={index === step ? "active" : ""} key={index} />
                  ))}
                </div>
                {step < steps.length - 1 ? (
                  <button className="button button-dark button-sm" onClick={() => setStep(step + 1)}>
                    Suivant <ArrowRight size={16} />
                  </button>
                ) : (
                  <button className="button button-dark button-sm" onClick={() => setOpen(false)}>
                    <X size={16} /> Terminer
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
