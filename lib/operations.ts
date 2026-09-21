export type OperationModule =
  | "fournisseurs"
  | "importations"
  | "documents"
  | "conformite"
  | "roadmap"
  | "rappels";
export type OperationFieldType =
  | "text"
  | "email"
  | "url"
  | "date"
  | "number"
  | "textarea"
  | "boolean"
  | "file";
export type OperationValue = string | number | boolean | null;

export interface OperationField {
  key: string;
  label: string;
  type: OperationFieldType;
  required?: boolean;
  suffix?: string;
  placeholder?: string;
}

export interface OperationalRecord {
  id: string;
  module: OperationModule;
  title: string;
  status: string;
  data: Record<string, OperationValue>;
  createdAt: string;
  updatedAt: string;
}

export interface RecallCustomerImpact {
  email: string;
  name: string;
  orderNumbers: string[];
  units: number;
}

export interface RecallImpact {
  lotCode: string;
  affectedUnits: number;
  affectedOrders: number;
  affectedCustomers: number;
  customers: RecallCustomerImpact[];
}

export const operationModules: Record<
  OperationModule,
  {
    title: string;
    eyebrow: string;
    description: string;
    titleLabel: string;
    statuses: string[];
    fields: OperationField[];
  }
> = {
  fournisseurs: {
    title: "Fournisseurs",
    eyebrow: "Chaîne d’approvisionnement",
    description: "Centralisez les contacts, conditions, preuves documentaires et évaluations internes.",
    titleLabel: "Société",
    statuses: ["Prospect", "Évaluation", "Approuvé", "Inactif"],
    fields: [
      { key: "contactName", label: "Personne-ressource", type: "text" },
      { key: "email", label: "Courriel", type: "email" },
      { key: "phone", label: "Téléphone", type: "text" },
      { key: "country", label: "Pays", type: "text", required: true },
      { key: "region", label: "Région", type: "text" },
      { key: "products", label: "Produits", type: "text", required: true },
      { key: "priceCadKg", label: "Prix indicatif", type: "number", suffix: "CAD/kg" },
      { key: "moqKg", label: "Commande minimale", type: "number", suffix: "kg" },
      { key: "capacityKg", label: "Capacité annoncée", type: "number", suffix: "kg" },
      { key: "certifications", label: "Certifications vérifiées", type: "textarea" },
      { key: "history", label: "Historique", type: "textarea" },
      { key: "rating", label: "Note interne", type: "number", suffix: "/ 5" },
      { key: "notes", label: "Notes confidentielles", type: "textarea" },
    ],
  },
  importations: {
    title: "Importations",
    eyebrow: "Logistique entrante",
    description: "Suivez les mouvements, intervenants, formalités et le coût rendu au Québec.",
    titleLabel: "Numéro de dossier",
    statuses: ["Planification", "En transit", "Douanes", "Reçu", "Annulé"],
    fields: [
      { key: "supplier", label: "Fournisseur", type: "text", required: true },
      { key: "lotCode", label: "Code lot", type: "text", required: true },
      { key: "quantityKg", label: "Quantité", type: "number", suffix: "kg", required: true },
      { key: "departureDate", label: "Départ", type: "date" },
      { key: "arrivalDate", label: "Arrivée prévue/réelle", type: "date" },
      { key: "importer", label: "Importateur", type: "text" },
      { key: "broker", label: "Courtier", type: "text" },
      { key: "carrier", label: "Transporteur", type: "text" },
      { key: "customsStatus", label: "Statut douanier", type: "text" },
      { key: "goodsCostCad", label: "Marchandise", type: "number", suffix: "CAD" },
      { key: "transportCostCad", label: "Transport", type: "number", suffix: "CAD" },
      { key: "insuranceCostCad", label: "Assurance", type: "number", suffix: "CAD" },
      { key: "dutiesCostCad", label: "Droits et courtage", type: "number", suffix: "CAD" },
      { key: "taxCostCad", label: "Taxes non récupérables", type: "number", suffix: "CAD" },
      { key: "otherCostCad", label: "Autres coûts", type: "number", suffix: "CAD" },
      { key: "sellableUnits", label: "Unités vendables", type: "number" },
      { key: "documentUrl", label: "Dossier documentaire", type: "url" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  documents: {
    title: "Documents",
    eyebrow: "Centre documentaire",
    description: "Conservez les certificats, analyses, factures et dossiers internes dans un stockage privé.",
    titleLabel: "Nom du document",
    statuses: ["À obtenir", "Brouillon", "À vérifier", "Validé", "Expiré", "Archivé"],
    fields: [
      { key: "type", label: "Type", type: "text", required: true },
      { key: "documentDate", label: "Date du document", type: "date" },
      { key: "expiryDate", label: "Échéance", type: "date" },
      { key: "lotCode", label: "Lot associé", type: "text" },
      {
        key: "confidentiality",
        label: "Confidentialité",
        type: "text",
        required: true,
        placeholder: "Interne, confidentiel…",
      },
      { key: "fileUrl", label: "Fichier privé", type: "file" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  conformite: {
    title: "Conformité",
    eyebrow: "Fiches réglementaires",
    description:
      "Documentez les renseignements d’étiquetage à faire valider avant impression et commercialisation.",
    titleLabel: "Produit / format",
    statuses: ["Brouillon", "À vérifier", "Validé par spécialiste", "À réviser"],
    fields: [
      { key: "commonNameFr", label: "Nom usuel FR", type: "text", required: true },
      { key: "commonNameEn", label: "Nom usuel EN", type: "text", required: true },
      { key: "netQuantity", label: "Quantité nette", type: "text", required: true },
      { key: "ingredientsFr", label: "Ingrédients FR", type: "textarea", required: true },
      { key: "ingredientsEn", label: "Ingrédients EN", type: "textarea", required: true },
      { key: "allergensFr", label: "Allergènes FR", type: "text" },
      { key: "allergensEn", label: "Allergènes EN", type: "text" },
      { key: "responsibleParty", label: "Responsable", type: "text", required: true },
      { key: "responsibleAddress", label: "Adresse", type: "textarea", required: true },
      { key: "countryOfOrigin", label: "Pays d’origine", type: "text", required: true },
      { key: "lotDeclaration", label: "Déclaration du lot", type: "text" },
      { key: "dateMarking", label: "Datation / durée de conservation", type: "text" },
      { key: "originDeclaration", label: "Déclaration d’origine", type: "textarea" },
      { key: "reviewedAt", label: "Dernière validation", type: "date" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  roadmap: {
    title: "Roadmap",
    eyebrow: "Progression",
    description: "Pilotez les jalons, responsabilités, échéances et preuves attendues.",
    titleLabel: "Objectif",
    statuses: ["À venir", "Planifié", "En cours", "Bloqué", "Terminé", "Annulé"],
    fields: [
      { key: "sequence", label: "Ordre", type: "number" },
      { key: "owner", label: "Responsable", type: "text" },
      { key: "dueDate", label: "Échéance", type: "date" },
      { key: "evidence", label: "Preuve attendue", type: "textarea" },
      { key: "nextAction", label: "Prochaine action", type: "textarea" },
      { key: "notes", label: "Notes", type: "textarea" },
    ],
  },
  rappels: {
    title: "Rappels",
    eyebrow: "Sécurité alimentaire",
    description: "Préparez et documentez un dossier de rappel sans envoyer automatiquement de communication.",
    titleLabel: "Référence du dossier",
    statuses: ["Brouillon", "Évaluation", "Actif", "Clos"],
    fields: [
      { key: "lotCode", label: "Lot concerné", type: "text", required: true },
      { key: "reason", label: "Motif", type: "textarea", required: true },
      { key: "scope", label: "Portée", type: "textarea" },
      { key: "openedAt", label: "Ouvert le", type: "date" },
      { key: "closedAt", label: "Clos le", type: "date" },
      { key: "authorityReference", label: "Référence autorité/conseil", type: "text" },
      { key: "customerAction", label: "Mesure envisagée pour les clients", type: "textarea" },
      { key: "notificationsApproved", label: "Communications approuvées manuellement", type: "boolean" },
      { key: "notes", label: "Notes confidentielles", type: "textarea" },
    ],
  },
};

export function isOperationModule(value: string): value is OperationModule {
  return Object.hasOwn(operationModules, value);
}
