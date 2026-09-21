import { z } from "zod";
import { isSafeHttpsUrl, isSafeSitePathOrHttpsUrl } from "@/lib/security";

const requiredText = (label: string, max = 120) =>
  z.string().trim().min(1, `${label} est requis.`).max(max, `${label} est trop long.`);

const optionalText = (max = 240) => z.string().trim().max(max).optional().default("");

const honeypot = z.string().max(200).optional().default("");

export const cartItemSchema = z.object({
  productId: z.string().min(1).max(120),
  variantId: z.string().min(1).max(120),
  quantity: z.number().int().min(1).max(10),
});

export const favoritesSchema = z.array(z.string().min(1)).max(100);

export const checkoutContactSchema = z.object({
  email: z.string().trim().email("Entrez une adresse courriel valide.").max(254),
  firstName: requiredText("Le prénom", 80),
  lastName: requiredText("Le nom", 80),
  phone: z
    .string()
    .trim()
    .max(30)
    .refine((value) => !value || /^[+\d\s().-]{7,30}$/.test(value), "Entrez un numéro de téléphone valide."),
});

const canadianPhone = z
  .string()
  .trim()
  .max(30)
  .refine((value) => !value || /^[+\d\s().-]{7,30}$/.test(value), "Entrez un numéro de téléphone valide.");

export const customerProfileSchema = z.object({
  displayName: z.string().trim().max(120),
  phone: canadianPhone,
  marketingConsent: z.boolean(),
});

export const customerAddressSchema = z.object({
  label: requiredText("Le nom de l’adresse", 60),
  firstName: requiredText("Le prénom", 80),
  lastName: requiredText("Le nom", 80),
  addressLine1: requiredText("L’adresse", 160),
  addressLine2: z.string().trim().max(80).default(""),
  city: requiredText("La ville", 80),
  province: z.string().trim().length(2, "Choisissez une province canadienne."),
  postalCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/, "Entrez un code postal canadien valide."),
  country: z.literal("CA").default("CA"),
  isDefault: z.boolean().default(false),
});

export const checkoutRequestSchema = z.object({
  attemptId: z.string().uuid("Tentative de paiement invalide."),
  contact: checkoutContactSchema.extend({ marketingConsent: z.boolean().default(false) }),
  cart: z
    .array(cartItemSchema)
    .min(1, "Votre panier est vide.")
    .max(30, "Votre panier contient trop de lignes.")
    .refine(
      (items) => new Set(items.map((item) => item.variantId)).size === items.length,
      "Un même format ne peut apparaître qu’une fois.",
    ),
  shippingMethod: z.enum(["standard", "express"]),
});

export const orderAccessRequestSchema = z.object({
  email: z.string().trim().email("Entrez une adresse courriel valide.").max(254),
  orderNumber: z
    .string()
    .trim()
    .regex(/^AVA-\d{4}-\d{6}$/, "Entrez un numéro de commande valide."),
});

export const adminShipmentSchema = z.object({
  carrier: requiredText("Le transporteur", 80),
  service: optionalText(80),
  trackingNumber: requiredText("Le numéro de suivi", 120),
  trackingUrl: z
    .string()
    .trim()
    .max(500)
    .refine((value) => !value || isSafeHttpsUrl(value), "Entrez un lien HTTPS valide.")
    .optional()
    .or(z.literal("")),
});

export const adminRefundSchema = z.object({
  restock: z.boolean().default(false),
  amountCents: z.number().int().positive().optional(),
});

const productImage = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine(isSafeSitePathOrHttpsUrl, "Entrez un chemin local sûr ou une URL HTTPS.");

const adminProductFieldsSchema = z.object({
  name: requiredText("Le nom", 140),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Utilisez un slug valide."),
  category: z.enum(["Gousses", "Poudre", "Coffret"]),
  shortDescription: requiredText("La description courte", 260),
  description: requiredText("La description", 3000),
  image: productImage,
  origin: requiredText("L’origine", 100),
  region: requiredText("La région", 100),
  species: requiredText("L’espèce", 120),
  lotCode: requiredText("Le lot", 100),
  status: z.enum(["available", "waitlist", "development"]),
  featured: z.boolean().default(false),
  active: z.boolean().default(false),
  audience: z
    .array(z.enum(["B2C", "Professionnels"]))
    .min(1)
    .max(2)
    .default(["B2C"]),
  uses: z.array(requiredText("L’usage", 120)).max(12).default([]),
  storage: requiredText("La conservation", 500),
  composition: requiredText("La composition", 500),
  dataStatus: z.enum(["Réel", "Hypothèse", "Démo"]).default("Réel"),
});

export const adminVariantCreateSchema = z
  .object({
    label: requiredText("Le format", 100),
    sku: z
      .string()
      .trim()
      .min(2)
      .max(100)
      .regex(/^[A-Za-z0-9_-]+$/, "Utilisez un SKU valide."),
    priceCents: z.number().int().min(0).max(10_000_000),
    compareAtPriceCents: z.number().int().min(0).max(10_000_000).nullable().default(null),
    stockOnHand: z.number().int().min(0).max(1_000_000),
    weightGrams: z.number().int().min(1).max(1_000_000),
    active: z.boolean().default(false),
  })
  .refine((value) => value.compareAtPriceCents === null || value.compareAtPriceCents >= value.priceCents, {
    message: "Le prix comparatif doit être supérieur ou égal au prix courant.",
    path: ["compareAtPriceCents"],
  });

export const adminProductCreateSchema = adminProductFieldsSchema.extend({
  variant: z
    .object({
      label: requiredText("Le format", 100),
      sku: z
        .string()
        .trim()
        .min(2)
        .max(100)
        .regex(/^[A-Za-z0-9_-]+$/, "Utilisez un SKU valide."),
      priceCents: z.number().int().min(0).max(10_000_000),
      compareAtPriceCents: z.number().int().min(0).max(10_000_000).nullable().default(null),
      stockOnHand: z.number().int().min(0).max(1_000_000),
      weightGrams: z.number().int().min(1).max(1_000_000),
      active: z.boolean().default(false),
    })
    .refine((value) => value.compareAtPriceCents === null || value.compareAtPriceCents >= value.priceCents, {
      message: "Le prix comparatif doit être supérieur ou égal au prix courant.",
      path: ["compareAtPriceCents"],
    }),
});

export const adminProductUpdateSchema = adminProductFieldsSchema;

export const adminVariantUpdateSchema = z
  .object({
    label: requiredText("Le format", 100),
    sku: z
      .string()
      .trim()
      .min(2)
      .max(100)
      .regex(/^[A-Za-z0-9_-]+$/, "Utilisez un SKU valide."),
    priceCents: z.number().int().min(0).max(10_000_000),
    compareAtPriceCents: z.number().int().min(0).max(10_000_000).nullable(),
    stockOnHand: z.number().int().min(0).max(1_000_000),
    weightGrams: z.number().int().min(1).max(1_000_000),
    active: z.boolean(),
  })
  .refine((value) => value.compareAtPriceCents === null || value.compareAtPriceCents >= value.priceCents, {
    message: "Le prix comparatif doit être supérieur ou égal au prix courant.",
    path: ["compareAtPriceCents"],
  });

export const adminInventoryAdjustmentSchema = z.object({
  variantId: requiredText("Le format", 160),
  reason: z.enum(["receipt", "loss", "correction_add", "correction_remove"]),
  quantity: z.number().int().min(1).max(1_000_000),
  note: z.string().trim().max(1_000).default(""),
});

const traceabilityEventSchema = z.object({
  label: requiredText("L’étape", 120),
  location: requiredText("Le lieu", 160),
  date: z
    .string()
    .trim()
    .max(30)
    .refine(
      (value) => value === "À venir" || /^\d{4}-\d{2}-\d{2}$/.test(value),
      "Entrez une date ISO ou « À venir ».",
    ),
  status: z.enum(["complete", "current", "upcoming"]),
  description: requiredText("La description", 500),
});

const publicDocumentSchema = z.object({
  label: requiredText("Le document", 120),
  url: z
    .string()
    .trim()
    .max(500)
    .refine(isSafeSitePathOrHttpsUrl, "Entrez un chemin local sûr ou une URL HTTPS."),
  date: z.string().trim().max(30).optional().default(""),
});

const adminLotFieldsSchema = z
  .object({
    country: requiredText("Le pays", 100),
    region: requiredText("La région", 100),
    species: requiredText("L’espèce", 120),
    grade: requiredText("Le grade", 120),
    harvestYear: requiredText("La récolte", 40),
    quantityKg: z.number().min(0).max(1_000_000),
    availableKg: z.number().min(0).max(1_000_000),
    status: z.enum(["Contrôle", "Disponible", "Archivé"]),
    publicTraceabilityEnabled: z.boolean(),
    dataStatus: z.enum(["Réel", "Hypothèse", "Démo"]),
    supplierName: z.string().trim().max(160).default(""),
    importDate: z
      .string()
      .trim()
      .regex(/^(|\d{4}-\d{2}-\d{2})$/, "Date d’import invalide."),
    receptionDate: z
      .string()
      .trim()
      .regex(/^(|\d{4}-\d{2}-\d{2})$/, "Date de réception invalide."),
    humidityPercent: z.number().min(0).max(100).nullable(),
    averageLengthMm: z.number().min(0).max(1_000).nullable(),
    publicSummary: z.string().trim().max(1_200).default(""),
    publicDocuments: z.array(publicDocumentSchema).max(20),
    notes: z.string().trim().max(5_000).default(""),
    events: z.array(traceabilityEventSchema).max(30),
  })
  .refine((value) => value.availableKg <= value.quantityKg, {
    message: "La quantité disponible ne peut pas dépasser la quantité initiale.",
    path: ["availableKg"],
  });

export const adminLotCreateSchema = adminLotFieldsSchema.and(
  z.object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(5)
      .max(50)
      .regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/, "Utilisez un code de lot valide."),
  }),
);

export const adminLotUpdateSchema = adminLotFieldsSchema;

export const adminCampaignSchema = z.object({
  subject: requiredText("L’objet", 160),
  preheader: z.string().trim().max(180).default(""),
  heading: requiredText("Le titre", 160),
  body: requiredText("Le message", 10_000),
  actionLabel: z.string().trim().max(80).default(""),
  actionUrl: z
    .string()
    .trim()
    .max(500)
    .refine((value) => !value || isSafeHttpsUrl(value), "Entrez une URL HTTPS valide.")
    .optional()
    .or(z.literal("")),
  confirmed: z.literal(true),
});

export const adminOperationalRecordSchema = z.object({
  title: requiredText("Le titre", 200),
  status: requiredText("Le statut", 80),
  data: z
    .record(
      z.string().trim().min(1).max(80),
      z.union([z.string().max(5_000), z.number().finite(), z.boolean(), z.null()]),
    )
    .refine((value) => Object.keys(value).length <= 40, "Trop de champs."),
});

export const analyticsEventSchema = z.object({
  eventName: z.enum([
    "page_view",
    "view_item",
    "view_cart",
    "add_to_cart",
    "begin_checkout",
    "purchase",
    "lead_submit",
    "newsletter_signup",
    "quiz_complete",
  ]),
  anonymousId: z.string().trim().min(16).max(80),
  path: z.string().trim().startsWith("/").max(300),
  properties: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
});

export const checkoutAddressSchema = z.object({
  address: requiredText("L’adresse", 160),
  apartment: optionalText(40),
  city: requiredText("La ville", 80),
  province: z.string().length(2, "Choisissez une province."),
  postal: z
    .string()
    .trim()
    .regex(/^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/, "Entrez un code postal canadien valide."),
});

export const storedOrderSchema = z.object({
  number: z.string().min(1),
  createdAt: z.string().datetime(),
  status: z.string().min(1),
  items: z.array(
    z.object({
      product: z.string(),
      variant: z.string(),
      quantity: z.number().int().positive(),
      lot: z.string(),
      price: z.number().nonnegative(),
    }),
  ),
  shipping: z.enum(["standard", "express"]),
  subtotal: z.number().nonnegative(),
  shippingPrice: z.number().nonnegative(),
  tax: z.number().nonnegative(),
  total: z.number().nonnegative(),
  demo: z.boolean(),
});

export const contactSubmissionSchema = z.object({
  kind: z.literal("contact"),
  name: requiredText("Le nom", 120),
  email: z.string().trim().email("Entrez une adresse courriel valide.").max(254),
  requestType: requiredText("Le type de demande", 60),
  subject: requiredText("Le sujet", 160),
  message: requiredText("Le message", 3000),
  consent: z.literal(true),
  _gotcha: honeypot,
});

export const b2bSubmissionSchema = z.object({
  kind: z.literal("b2b"),
  firstName: requiredText("Le prénom", 80),
  lastName: requiredText("Le nom", 80),
  company: requiredText("L’entreprise", 140),
  email: z.string().trim().email("Entrez une adresse courriel professionnelle valide.").max(254),
  segment: requiredText("Le type d’entreprise", 80),
  phone: optionalText(30),
  province: optionalText(2),
  product: optionalText(80),
  volume: optionalText(120),
  frequency: optionalText(80),
  comment: optionalText(2000),
  consent: z.literal(true),
  _gotcha: honeypot,
});

export const newsletterSubmissionSchema = z.object({
  kind: z.literal("newsletter"),
  email: z.string().trim().email("Entrez une adresse courriel valide.").max(254),
  source: optionalText(80),
  _gotcha: honeypot,
});

export const waitlistSubmissionSchema = z.object({
  kind: z.literal("waitlist"),
  email: z.string().trim().email("Entrez une adresse courriel valide.").max(254),
  productId: requiredText("Le produit", 100),
  variantId: requiredText("Le format", 100),
  _gotcha: honeypot,
});

export const submissionSchema = z.discriminatedUnion("kind", [
  contactSubmissionSchema,
  b2bSubmissionSchema,
  newsletterSubmissionSchema,
  waitlistSubmissionSchema,
]);

export type Submission = z.infer<typeof submissionSchema>;
export type StoredOrder = z.infer<typeof storedOrderSchema>;
export type CheckoutContact = z.infer<typeof checkoutContactSchema>;
export type CheckoutAddress = z.infer<typeof checkoutAddressSchema>;
export type CheckoutRequestInput = z.infer<typeof checkoutRequestSchema>;
