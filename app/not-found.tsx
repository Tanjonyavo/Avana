import Link from "next/link";

export default function NotFound() {
  return (
    <section className="empty-page section-shell">
      <span className="eyebrow">Erreur 404</span>
      <h1>Cette page n’a pas encore d’histoire.</h1>
      <p>Revenez à l’accueil ou explorez les produits AVANA.</p>
      <div className="button-row">
        <Link className="button button-dark" href="/">
          Retour à l’accueil
        </Link>
        <Link className="button button-outline" href="/boutique">
          Voir la boutique
        </Link>
      </div>
    </section>
  );
}
