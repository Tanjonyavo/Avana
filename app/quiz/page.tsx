import type { Metadata } from "next";
import { ProductQuiz } from "@/components/quiz";
export const metadata: Metadata = { title: "Quel produit AVANA vous convient ?" };
export default function QuizPage() {
  return (
    <>
      <section className="page-hero">
        <div className="section-shell">
          <span className="eyebrow">Quiz vanille</span>
          <h1>Quel produit AVANA vous convient ?</h1>
          <p className="lead">Quatre questions pour trouver le format le plus adapté à vos habitudes.</p>
        </div>
      </section>
      <ProductQuiz />
    </>
  );
}
