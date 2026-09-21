import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Scale } from "lucide-react";
import { notFound } from "next/navigation";
import { commerceSettings } from "@/lib/server/config";
import { formatCurrency } from "@/lib/utils";

interface Policy {
  title: string;
  intro: string;
  sections: Array<{ title: string; paragraphs: string[] }>;
  sources?: Array<{ label: string; url: string }>;
}

function merchantIdentity() {
  const business = commerceSettings.business;
  const address = [
    business.addressLine1,
    business.addressLine2,
    business.city,
    business.province,
    business.postalCode,
    business.country,
  ]
    .filter(Boolean)
    .join(", ");
  return `${business.name}. ${address || "Adresse commerciale à compléter avant le lancement"}. ${business.phone || "Téléphone à compléter"}. ${business.supportEmail || "Courriel de soutien à compléter"}.`;
}

function policies(): Record<string, Policy> {
  const support = commerceSettings.business.supportEmail || "le formulaire de contact";
  return {
    confidentialite: {
      title: "Politique de confidentialité",
      intro:
        "La présente politique explique les renseignements traités par AVANA et les choix offerts aux visiteurs.",
      sections: [
        {
          title: "Responsable",
          paragraphs: [
            `${merchantIdentity()} Le responsable de la protection des renseignements personnels peut être joint à ${support}.`,
          ],
        },
        {
          title: "Renseignements recueillis",
          paragraphs: [
            "Lors d’une commande, AVANA traite le nom, le courriel, le téléphone, l’adresse de livraison, les produits commandés et les statuts de paiement et d’expédition. Les numéros de carte sont saisis et traités directement par Stripe; AVANA ne les reçoit pas.",
            "Les formulaires peuvent recueillir les renseignements que vous transmettez volontairement. Un compte client sans mot de passe peut être créé à partir d’une adresse courriel vérifiée.",
          ],
        },
        {
          title: "Finalités",
          paragraphs: [
            "Ces renseignements servent à fournir le service demandé, confirmer et livrer les commandes, prévenir la fraude, répondre aux demandes, assurer la traçabilité, tenir les registres nécessaires et respecter les obligations applicables.",
            "L’infolettre et la mesure d’audience interne reposent sur un choix distinct. Le refus de l’analytique n’empêche pas l’achat.",
          ],
        },
        {
          title: "Fournisseurs technologiques",
          paragraphs: [
            "Selon la configuration du service, des renseignements peuvent être traités par Vercel pour l’hébergement, Supabase pour la base de données et l’authentification, Stripe pour le paiement et la fiscalité, Resend pour les courriels et le transporteur choisi pour la livraison. Certains traitements peuvent avoir lieu hors du Québec.",
          ],
        },
        {
          title: "Conservation et sécurité",
          paragraphs: [
            "Les événements analytiques consentis sont supprimés après 13 mois; les notifications envoyées après 90 jours; les inscriptions non confirmées après leur période d’attente. Les commandes et pièces comptables sont conservées pendant la durée nécessaire aux obligations commerciales, fiscales, de rappel et de défense de droits, puis détruites ou anonymisées.",
            "AVANA applique notamment le chiffrement en transit, le contrôle d’accès, des sessions protégées, la validation serveur, des limites de requêtes et des journaux d’audit. Aucun système ne garantit toutefois une sécurité absolue.",
          ],
        },
        {
          title: "Vos droits",
          paragraphs: [
            `Vous pouvez demander l’accès, la rectification ou le retrait du consentement, selon les conditions prévues par la loi, en écrivant à ${support}. Vous pouvez aussi modifier les préférences de confidentialité depuis le pied de page. Une plainte peut être adressée au responsable, puis à l’autorité compétente.`,
          ],
        },
      ],
      sources: [
        {
          label: "Commission d’accès à l’information — changements de la Loi 25",
          url: "https://www.cai.gouv.qc.ca/protection-renseignements-personnels/sujets-et-domaines-dinteret/principaux-changements-loi-25",
        },
      ],
    },
    conditions: {
      title: "Conditions de vente et d’utilisation",
      intro: "Ces conditions encadrent l’utilisation du site et les commandes livrées au Canada.",
      sections: [
        { title: "Identité du marchand", paragraphs: [merchantIdentity()] },
        {
          title: "Produits et disponibilité",
          paragraphs: [
            "Les descriptions, formats, quantités nettes, prix et disponibilités affichés au moment de la commande font partie de l’offre. Le stock est revérifié côté serveur avant le paiement. Les données marquées « Démo » ou « Hypothèse » ne constituent pas une offre commerciale réelle.",
            "AVANA ne présente aucune certification, caractéristique analytique ou relation fournisseur comme acquise sans preuve correspondante.",
          ],
        },
        {
          title: "Prix, taxes et paiement",
          paragraphs: [
            "Tous les prix sont en dollars canadiens. Les frais de livraison, rabais et taxes applicables sont présentés avant l’autorisation finale. Le paiement est traité par Stripe. AVANA ne peut augmenter le prix accepté après la conclusion de la commande.",
          ],
        },
        {
          title: "Formation de la commande",
          paragraphs: [
            "La commande est formée lorsque Stripe confirme le paiement et qu’AVANA transmet le numéro de commande et sa confirmation par courriel. En cas d’indisponibilité avant paiement, le stock est libéré et aucun débit réussi n’est enregistré. Les droits prévus par les lois de protection du consommateur demeurent applicables.",
          ],
        },
        {
          title: "Utilisation du site",
          paragraphs: [
            "Il est interdit de contourner les contrôles d’accès, perturber le service, automatiser des requêtes abusives ou utiliser les contenus d’AVANA d’une manière illicite. Les marques, textes, photographies et interfaces restent protégés par les droits applicables.",
          ],
        },
        {
          title: "Droit applicable",
          paragraphs: [
            "Ces conditions sont régies par les lois applicables au Québec et au Canada, sans limiter les protections impératives accordées au consommateur. Pour toute question, contactez AVANA avant de commander.",
          ],
        },
      ],
      sources: [
        {
          label: "Office de la protection du consommateur — contrats à distance",
          url: "https://www.opc.gouv.qc.ca/commercant/pratique-commerce/contrats-distance",
        },
      ],
    },
    livraison: {
      title: "Politique de livraison",
      intro: "Les options, coûts et délais sont affichés avant le paiement et confirmés dans la commande.",
      sections: [
        {
          title: "Zone desservie",
          paragraphs: [
            "La boutique accepte les adresses de livraison au Canada. Une commande destinée à une zone non desservie peut être refusée avant paiement. Aucune livraison internationale n’est offerte dans cette version.",
          ],
        },
        {
          title: "Options et frais",
          paragraphs: [
            `La livraison standard est configurée à ${formatCurrency(commerceSettings.standardShippingCents / 100)} et devient gratuite à partir de ${formatCurrency(commerceSettings.freeShippingThresholdCents / 100)} avant taxes. La livraison express est configurée à ${formatCurrency(commerceSettings.expressShippingCents / 100)}. Le montant exact affiché au paiement prévaut.`,
          ],
        },
        {
          title: "Délais",
          paragraphs: [
            "Après l’expédition, le délai indicatif est de 3 à 6 jours ouvrables en standard et de 1 à 3 jours ouvrables en express. Il ne constitue pas une garantie et peut varier selon l’adresse, la météo, les périodes de pointe ou le transporteur. Le suivi est envoyé par courriel dès qu’il est disponible.",
          ],
        },
        {
          title: "Adresse et réception",
          paragraphs: [
            "Le client doit vérifier l’adresse avant de payer. Contactez rapidement AVANA si une correction est nécessaire; une modification n’est pas garantie après l’expédition. Les frais attribuables à une adresse erronée peuvent être facturés lorsqu’ils sont permis et communiqués.",
          ],
        },
        {
          title: "Retard ou colis manquant",
          paragraphs: [
            `Écrivez à ${support} avec le numéro de commande. AVANA ouvrira une enquête auprès du transporteur. Les recours d’annulation ou de remboursement prévus par la loi en cas de défaut de livraison ne sont pas limités par cette politique.`,
          ],
        },
      ],
      sources: [
        {
          label: "Office de la protection du consommateur — obligations liées à la livraison",
          url: "https://www.opc.gouv.qc.ca/commercant/pratique-commerce/contrats-distance",
        },
      ],
    },
    retours: {
      title: "Annulations, retours et remboursements",
      intro:
        "Une politique claire pour les produits alimentaires, sans réduire les droits prévus par la loi.",
      sections: [
        {
          title: "Avant l’expédition",
          paragraphs: [
            `Une demande d’annulation peut être envoyée à ${support}. Si la préparation n’a pas commencé, AVANA tentera d’annuler et de rembourser la commande. L’annulation n’est pas garantie après la remise au transporteur.`,
          ],
        },
        {
          title: "Changement d’idée",
          paragraphs: [
            "Pour des raisons de sécurité et d’intégrité alimentaires, les produits ne sont pas repris pour un simple changement d’idée, sauf accord écrit d’AVANA ou obligation légale. N’expédiez aucun retour sans autorisation préalable.",
          ],
        },
        {
          title: "Produit endommagé, incorrect ou non conforme",
          paragraphs: [
            `Communiquez avec ${support} dans les 7 jours suivant la réception, avec le numéro de commande, le code de lot, une description et, si possible, des photographies. Conservez le produit et l’emballage jusqu’aux instructions. Après vérification, AVANA proposera la solution appropriée, notamment un remplacement ou un remboursement.`,
          ],
        },
        {
          title: "Remboursement",
          paragraphs: [
            "Un remboursement approuvé est retourné au mode de paiement d’origine. Son affichage dépend ensuite du délai de l’institution financière. Lorsqu’une annulation découle d’un droit prévu par la loi, les délais et frais de retour légaux applicables prévalent.",
          ],
        },
        {
          title: "Droits légaux",
          paragraphs: [
            "Certaines situations liées aux contrats conclus à distance permettent une annulation sans frais. La présente politique ne remplace ni ne limite ces protections obligatoires.",
          ],
        },
      ],
      sources: [
        {
          label: "Office de la protection du consommateur — annulation d’un contrat à distance",
          url: "https://www.opc.gouv.qc.ca/commercant/pratique-commerce/contrats-distance/annulation/",
        },
      ],
    },
    cookies: {
      title: "Préférences de témoins et stockage local",
      intro: "Les fonctionnalités facultatives restent désactivées jusqu’à votre choix.",
      sections: [
        {
          title: "Nécessaires",
          paragraphs: [
            "Le site utilise un stockage local pour le panier, les favoris et les préférences, ainsi que des témoins sécurisés pour les sessions de compte et d’administration. Ces éléments sont nécessaires au service demandé et ne servent pas à la publicité intersite.",
          ],
        },
        {
          title: "Analytique",
          paragraphs: [
            "Avec votre accord, AVANA enregistre un identifiant aléatoire, la route visitée et des événements de parcours comme la vue d’un produit, l’ajout au panier et l’achat. L’adresse IP n’est pas enregistrée dans la table analytique. Les données servent à améliorer l’expérience et sont supprimées après 13 mois.",
          ],
        },
        {
          title: "Marketing",
          paragraphs: [
            "La catégorie marketing est prévue pour de futures campagnes autorisées. Aucun pixel publicitaire tiers n’est chargé par cette version. L’infolettre exige une confirmation par courriel et peut être quittée par un lien de désabonnement.",
          ],
        },
        {
          title: "Modifier votre choix",
          paragraphs: [
            "Le bouton « Préférences de confidentialité » du pied de page permet d’accepter, refuser ou modifier les catégories facultatives. Le retrait désactive les nouvelles mesures et supprime l’identifiant analytique du navigateur.",
          ],
        },
      ],
      sources: [
        {
          label: "Commission d’accès à l’information — paramètres protecteurs par défaut",
          url: "https://www.cai.gouv.qc.ca/protection-renseignements-personnels/sujets-et-domaines-dinteret/principaux-changements-loi-25",
        },
      ],
    },
  };
}

export function generateStaticParams() {
  return Object.keys(policies()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const policy = policies()[slug];
  return policy ? { title: policy.title, description: policy.intro } : {};
}

export default async function PolicyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const policy = policies()[slug];
  if (!policy) notFound();
  return (
    <>
      <section className="page-hero">
        <div className="section-shell" style={{ maxWidth: 900 }}>
          <span className="eyebrow">Informations légales</span>
          <h1>{policy.title}</h1>
          <p className="lead">{policy.intro}</p>
          <p className="small muted">Dernière mise à jour : 9 septembre 2026</p>
        </div>
      </section>
      <section className="page-section">
        <div className="section-shell policy-layout">
          <aside className="policy-notice">
            <Scale size={20} />
            <p>
              Modèle opérationnel à faire valider par un professionnel du droit et à compléter avec l’identité
              juridique réelle d’AVANA avant l’ouverture des ventes.
            </p>
          </aside>
          <div className="policy-content">
            {policy.sections.map((section) => (
              <section key={section.title}>
                <h2>{section.title}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </section>
            ))}
            {policy.sources?.length ? (
              <section className="policy-sources">
                <h2>Références officielles</h2>
                {policy.sources.map((source) => (
                  <a
                    className="text-link"
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    key={source.url}
                  >
                    {source.label} <ExternalLink size={14} />
                  </a>
                ))}
              </section>
            ) : null}
            <Link className="button button-outline" href="/contact">
              Poser une question
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
