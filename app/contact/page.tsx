import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-form";
import { COMMERCE_ENABLED } from "@/lib/site";

export const metadata: Metadata = { title: "Contact" };
export default function ContactPage() {
  return (
    <>
      <section className="page-hero">
        <div className="section-shell">
          <span className="eyebrow">Contact</span>
          <h1>Une question, un projet, une piste à explorer ?</h1>
          <p className="lead">
            Parlez-nous de votre demande. Les professionnels peuvent aussi utiliser le formulaire B2B
            détaillé.
          </p>
        </div>
      </section>
      <section className="page-section">
        <div className="section-shell professional-layout">
          <div className="professional-copy">
            <h2>Construisons la suite avec précision.</h2>
            <p className="muted">
              {COMMERCE_ENABLED
                ? "Votre message est transmis de façon sécurisée à l’équipe AVANA. Une réponse suivra par courriel."
                : "Cette interface reste en démonstration tant qu’un service courriel n’est pas connecté."}
            </p>
            <div className="content-list">
              {["Commande", "Professionnel", "Partenariat", "Fournisseur", "Presse", "Autre"].map(
                (item, index) => (
                  <div className="content-list-row" key={item}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <strong>{item}</strong>
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>
          <ContactForm />
        </div>
      </section>
    </>
  );
}
