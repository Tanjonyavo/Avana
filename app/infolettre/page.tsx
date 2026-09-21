import Link from "next/link";
import { CheckCircle2, MailCheck, ShieldAlert } from "lucide-react";

const states = {
  confirmee: {
    icon: CheckCircle2,
    title: "Inscription confirmée.",
    message:
      "Vous recevrez désormais les nouvelles AVANA. Vous pourrez vous désabonner depuis chaque courriel.",
  },
  desabonnement: {
    icon: MailCheck,
    title: "Désabonnement confirmé.",
    message: "Votre adresse ne recevra plus les communications marketing AVANA.",
  },
  invalide: {
    icon: ShieldAlert,
    title: "Ce lien n’est plus valide.",
    message: "Il a peut-être expiré ou déjà été utilisé. Vous pouvez refaire une demande depuis le site.",
  },
};

export default async function NewsletterStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ etat?: string }>;
}) {
  const { etat } = await searchParams;
  const state = states[etat as keyof typeof states] || states.invalide;
  const Icon = state.icon;
  return (
    <section className="page-section">
      <div className="section-shell">
        <div className="confirmation-card">
          <div className="confirmation-icon">
            <Icon size={30} />
          </div>
          <span className="eyebrow">Infolettre AVANA</span>
          <h1>{state.title}</h1>
          <p className="lead">{state.message}</p>
          <Link className="button button-dark" href="/">
            Retour à l’accueil
          </Link>
        </div>
      </div>
    </section>
  );
}
