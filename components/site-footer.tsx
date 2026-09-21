import Link from "next/link";
import { PrivacySettingsButton } from "@/components/privacy-settings-button";
import { useApp } from "@/components/app-providers";

export function SiteFooter() {
  const { catalogMode } = useApp();
  const live = catalogMode === "live";
  return (
    <footer className="site-footer">
      <div className="section-shell footer-grid">
        <div className="footer-brand">
          <Link className="brand" href="/">
            AVANA<span>Madagascar → Québec</span>
          </Link>
          <p>Une marque québécoise autour de la vanille de Madagascar, de la qualité et de la traçabilité.</p>
          <p className="footer-contact">
            Québec, Canada · {live ? "Boutique en ligne" : "Projet précommercial"}
            <br />
            <Link href="/contact">Contacter l’équipe AVANA</Link>
          </p>
        </div>
        <div className="footer-links">
          <div className="footer-column">
            <strong>Découvrir</strong>
            <Link href="/boutique">Boutique</Link>
            <Link href="/tracabilite">Traçabilité</Link>
            <Link href="/madagascar">Madagascar</Link>
            <Link href="/journal">Journal</Link>
          </div>
          <div className="footer-column">
            <strong>AVANA</strong>
            <Link href="/notre-histoire">Notre histoire</Link>
            <Link href="/notre-approche">Notre approche</Link>
            <Link href="/professionnels">Professionnels</Link>
            <Link href="/contact">Contact</Link>
          </div>
          <div className="footer-column">
            <strong>Informations</strong>
            <Link href="/faq">FAQ</Link>
            <Link href="/politiques/confidentialite">Confidentialité</Link>
            <Link href="/politiques/livraison">Livraison</Link>
            <Link href="/politiques/retours">Retours</Link>
            <Link href="/politiques/conditions">Conditions</Link>
            <Link href="/politiques/cookies">Témoins</Link>
            <PrivacySettingsButton />
          </div>
        </div>
      </div>
      <div className="section-shell footer-bottom">
        <span>
          © {new Date().getFullYear()} AVANA.{" "}
          {live ? "Tous droits réservés." : "Projet en phase de précommercialisation."}
        </span>
        <span>Français · CAD · Québec, Canada</span>
      </div>
    </footer>
  );
}
