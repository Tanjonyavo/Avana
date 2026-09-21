"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/components/app-providers";
import { trackEvent } from "@/lib/analytics-client";

const questions = [
  {
    text: "Comment utilisez-vous surtout la vanille ?",
    answers: [
      ["Pâtisserie fine", "beans"],
      ["Boissons et mélanges", "powder"],
      ["Un peu de tout", "both"],
    ],
  },
  {
    text: "Quel geste préférez-vous ?",
    answers: [
      ["Fendre et infuser", "beans"],
      ["Doser et mélanger", "powder"],
      ["Explorer les deux", "both"],
    ],
  },
  {
    text: "Pour quelle occasion ?",
    answers: [
      ["Une recette précise", "beans"],
      ["Le quotidien", "powder"],
      ["Un cadeau", "both"],
    ],
  },
  {
    text: "Quel niveau de simplicité recherchez-vous ?",
    answers: [
      ["Le geste artisanal", "beans"],
      ["Très pratique", "powder"],
      ["Les deux me conviennent", "both"],
    ],
  },
];

export function ProductQuiz() {
  const { catalog } = useApp();
  const [step, setStep] = useState(0);
  const [scores, setScores] = useState({ beans: 0, powder: 0, both: 0 });
  const [done, setDone] = useState(false);
  const answer = (value: string) => {
    const next = { ...scores, [value]: scores[value as keyof typeof scores] + 1 };
    setScores(next);
    if (step === questions.length - 1) {
      setDone(true);
      trackEvent("quiz_complete", { recommendation: value });
    } else setStep(step + 1);
  };
  const reset = () => {
    setStep(0);
    setScores({ beans: 0, powder: 0, both: 0 });
    setDone(false);
  };
  const beans = catalog.find((product) => product.category === "Gousses");
  const powder = catalog.find((product) => product.category === "Poudre");
  const bundle = catalog.find((product) => product.category === "Coffret");
  const result =
    scores.both >= Math.max(scores.beans, scores.powder)
      ? bundle || beans || powder
      : scores.beans >= scores.powder
        ? beans || powder || bundle
        : powder || beans || bundle;
  return (
    <section className="page-section">
      <div className="section-shell" style={{ maxWidth: 780 }}>
        <div className="form-card">
          {!done ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                <span className="demo-badge">
                  Question {step + 1} / {questions.length}
                </span>
                {step > 0 && (
                  <button className="button button-ghost button-sm" onClick={() => setStep(step - 1)}>
                    <ArrowLeft size={15} /> Retour
                  </button>
                )}
              </div>
              <h1 style={{ fontSize: "clamp(2.4rem, 5vw, 4rem)", margin: "2rem 0" }}>
                {questions[step].text}
              </h1>
              <div style={{ display: "grid", gap: ".7rem" }}>
                {questions[step].answers.map(([label, value]) => (
                  <button
                    className="button button-outline"
                    style={{ justifyContent: "space-between", borderRadius: 12 }}
                    key={label}
                    onClick={() => answer(value)}
                  >
                    {label}
                    <ArrowRight size={16} />
                  </button>
                ))}
              </div>
            </>
          ) : result ? (
            <div style={{ textAlign: "center" }}>
              <span className="demo-badge">Votre recommandation</span>
              <h1 style={{ fontSize: "clamp(2.5rem, 5vw, 4rem)", margin: "1.5rem 0" }}>{result.name}</h1>
              <p className="lead">{result.shortDescription}</p>
              <div className="button-row" style={{ justifyContent: "center" }}>
                <Link className="button button-dark" href={`/boutique/${result.slug}`}>
                  Découvrir ce produit <ArrowRight size={16} />
                </Link>
                <button className="button button-outline" onClick={reset}>
                  <RotateCcw size={16} /> Recommencer
                </button>
              </div>
              <p className="small muted" style={{ marginTop: "1.5rem" }}>
                Votre réponse reste uniquement dans cette page et n’est pas enregistrée.
              </p>
            </div>
          ) : (
            <div className="empty-state">
              <div>
                <h2>Catalogue en préparation.</h2>
                <p>Revenez lorsque les premiers formats seront publiés.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
