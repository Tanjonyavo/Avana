export type DataStatus = "Réel" | "Hypothèse" | "Démo";

export type ProductCategory = "Gousses" | "Poudre" | "Coffret";

export interface ProductVariant {
  id: string;
  label: string;
  sku: string;
  price: number;
  compareAtPrice?: number;
  stock: number;
  weight: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  eyebrow: string;
  category: ProductCategory;
  shortDescription: string;
  description: string;
  image: string;
  gallery: string[];
  origin: string;
  region: string;
  species: string;
  lotCode: string;
  status: "available" | "waitlist" | "development";
  featured: boolean;
  audience: ("B2C" | "Professionnels")[];
  variants: ProductVariant[];
  uses: string[];
  storage: string;
  composition: string;
  dataStatus: DataStatus;
}

export interface TraceabilityEvent {
  label: string;
  location: string;
  date: string;
  status: "complete" | "current" | "upcoming";
  description: string;
}

export interface Lot {
  id: string;
  code: string;
  country: string;
  region: string;
  species: string;
  grade: string;
  harvestYear: string;
  quantityKg: number;
  availableKg: number;
  status: "Contrôle" | "Disponible" | "Archivé";
  publicTraceabilityEnabled: boolean;
  dataStatus: DataStatus;
  events: TraceabilityEvent[];
  supplierName?: string;
  importDate?: string;
  receptionDate?: string;
  humidityPercent?: number | null;
  averageLengthMm?: number | null;
  publicSummary?: string;
  publicDocuments?: Array<{ label: string; url: string; date?: string }>;
  notes?: string;
}

export interface CartItem {
  productId: string;
  variantId: string;
  quantity: number;
}

export interface BusinessLead {
  id: string;
  company: string;
  contact: string;
  segment: string;
  product: string;
  volume: string;
  stage:
    | "Nouveau lead"
    | "Contacté"
    | "Échantillon"
    | "Discussion"
    | "Proposition"
    | "Négociation"
    | "Client"
    | "Perdu";
  value: number;
  nextAction: string;
}

export type UserRole = "admin" | "founder" | "staff" | "customer";

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
  lastLoginAt?: string;
}

export interface InventoryRecord {
  id: string;
  lotId: string;
  productVariantId?: string;
  location: string;
  quantity: number;
  unit: "kg" | "g" | "unit";
  status: "available" | "reserved" | "quarantine" | "consumed";
  updatedAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  country: string;
  region?: string;
  status: "prospect" | "evaluation" | "approved" | "inactive";
  documentIds: string[];
}

export interface Shipment {
  id: string;
  lotIds: string[];
  direction: "inbound" | "outbound";
  carrier?: string;
  trackingNumber?: string;
  status: "planned" | "in_transit" | "received" | "cancelled";
  expectedAt?: string;
  receivedAt?: string;
}

export interface QualityCheck {
  id: string;
  lotId: string;
  performedAt: string;
  performedBy: string;
  status: "pending" | "passed" | "failed";
  results: Record<string, string | number | boolean>;
  documentIds: string[];
}

export interface DocumentRecord {
  id: string;
  name: string;
  category: "import" | "quality" | "supplier" | "product" | "legal";
  storageKey: string;
  visibility: "private" | "public";
  createdAt: string;
}

export interface OrderItem {
  productId: string;
  variantId: string;
  lotId?: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  number: string;
  customerId?: string;
  items: OrderItem[];
  currency: "CAD";
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  status: "draft" | "pending_payment" | "paid" | "fulfilled" | "cancelled" | "refunded";
  createdAt: string;
}
