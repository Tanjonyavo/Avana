import "server-only";

import { lots as demoLots } from "@/data/demo";
import { isSupabaseAdminConfigured } from "@/lib/server/config";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { COMMERCE_ENABLED } from "@/lib/site";
import { isSafeSitePathOrHttpsUrl } from "@/lib/security";
import type { LotSnapshot } from "@/types/commerce";
import type { DataStatus, Lot, TraceabilityEvent } from "@/types";

interface LotRow {
  id: string;
  code: string;
  country: string;
  region: string;
  species: string;
  grade: string;
  harvest_year: string;
  quantity_kg: number | string;
  available_kg: number | string;
  status: Lot["status"];
  public_traceability_enabled: boolean;
  data_status: DataStatus;
  events: unknown;
  supplier_name: string;
  import_date: string | null;
  reception_date: string | null;
  humidity_percent: number | string | null;
  average_length_mm: number | string | null;
  public_summary: string;
  public_documents: unknown;
  notes: string;
}

interface LotInput {
  country: string;
  region: string;
  species: string;
  grade: string;
  harvestYear: string;
  quantityKg: number;
  availableKg: number;
  status: Lot["status"];
  publicTraceabilityEnabled: boolean;
  dataStatus: DataStatus;
  supplierName: string;
  importDate: string;
  receptionDate: string;
  humidityPercent: number | null;
  averageLengthMm: number | null;
  publicSummary: string;
  publicDocuments: Array<{ label: string; url: string; date?: string }>;
  notes: string;
  events: TraceabilityEvent[];
}

function isTraceabilityEvent(value: unknown): value is TraceabilityEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<TraceabilityEvent>;
  return (
    typeof event.label === "string" &&
    typeof event.location === "string" &&
    typeof event.date === "string" &&
    ["complete", "current", "upcoming"].includes(event.status || "") &&
    typeof event.description === "string"
  );
}

function publicDocuments(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const document = item as Record<string, unknown>;
    if (
      typeof document.label !== "string" ||
      typeof document.url !== "string" ||
      !isSafeSitePathOrHttpsUrl(document.url)
    )
      return [];
    return [
      {
        label: document.label,
        url: document.url,
        date: typeof document.date === "string" ? document.date : "",
      },
    ];
  });
}

function nullableNumber(value: number | string | null) {
  if (value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function mapLot(row: LotRow): Lot {
  return {
    id: row.id,
    code: row.code,
    country: row.country,
    region: row.region,
    species: row.species,
    grade: row.grade,
    harvestYear: row.harvest_year,
    quantityKg: Number(row.quantity_kg),
    availableKg: Number(row.available_kg),
    status: row.status,
    publicTraceabilityEnabled: row.public_traceability_enabled,
    dataStatus: row.data_status,
    events: Array.isArray(row.events) ? row.events.filter(isTraceabilityEvent) : [],
    supplierName: row.supplier_name,
    importDate: row.import_date || "",
    receptionDate: row.reception_date || "",
    humidityPercent: nullableNumber(row.humidity_percent),
    averageLengthMm: nullableNumber(row.average_length_mm),
    publicSummary: row.public_summary,
    publicDocuments: publicDocuments(row.public_documents),
    notes: row.notes,
  };
}

function databasePayload(input: LotInput) {
  return {
    country: input.country,
    region: input.region,
    species: input.species,
    grade: input.grade,
    harvest_year: input.harvestYear,
    quantity_kg: input.quantityKg,
    available_kg: input.availableKg,
    status: input.status,
    public_traceability_enabled: input.publicTraceabilityEnabled,
    data_status: input.dataStatus,
    supplier_name: input.supplierName,
    import_date: input.importDate || null,
    reception_date: input.receptionDate || null,
    humidity_percent: input.humidityPercent,
    average_length_mm: input.averageLengthMm,
    public_summary: input.publicSummary,
    public_documents: input.publicDocuments,
    notes: input.notes,
    events: input.events,
  };
}

export async function getLotSnapshot(): Promise<LotSnapshot> {
  if (!COMMERCE_ENABLED) return { lots: demoLots, mode: "demo" };
  if (!isSupabaseAdminConfigured()) {
    return { lots: [], mode: "unconfigured", message: "La base de traçabilité doit être configurée." };
  }
  const { data, error } = await getSupabaseAdmin()
    .from("lots")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("AVANA lots unavailable", { code: error.code });
    return { lots: [], mode: "unconfigured", message: "La traçabilité est momentanément indisponible." };
  }
  return { lots: (data as LotRow[]).map(mapLot), mode: "live" };
}

export async function getPublicLotByCode(code: string) {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,80}$/.test(normalized)) return null;
  if (!COMMERCE_ENABLED) {
    return (
      demoLots.find((lot) => lot.code.toUpperCase() === normalized && lot.publicTraceabilityEnabled) || null
    );
  }
  if (!isSupabaseAdminConfigured()) return null;
  const { data, error } = await getSupabaseAdmin()
    .from("lots")
    .select("*")
    .eq("code", normalized)
    .eq("public_traceability_enabled", true)
    .neq("status", "Archivé")
    .maybeSingle();
  if (error) throw new Error(`Public lot could not be loaded: ${error.code}`);
  return data ? mapLot(data as LotRow) : null;
}

export async function listAdminLots() {
  const { data, error } = await getSupabaseAdmin()
    .from("lots")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Lots could not be listed: ${error.code}`);
  return (data as LotRow[]).map(mapLot);
}

export async function createAdminLot(input: LotInput & { code: string }) {
  const id = `lot-${crypto.randomUUID()}`;
  const { error } = await getSupabaseAdmin()
    .from("lots")
    .insert({
      id,
      code: input.code.toUpperCase(),
      ...databasePayload(input),
    });
  if (error) throw new Error(`Lot could not be created: ${error.message}`);
  return id;
}

export async function updateAdminLot(id: string, input: LotInput) {
  const { data, error } = await getSupabaseAdmin()
    .from("lots")
    .update(databasePayload(input))
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`Lot could not be updated: ${error.message}`);
  return Boolean(data);
}

export async function archiveAdminLot(id: string) {
  const { data: lot, error: lotError } = await getSupabaseAdmin()
    .from("lots")
    .select("code")
    .eq("id", id)
    .maybeSingle();
  if (lotError) throw new Error(`Lot could not be loaded: ${lotError.code}`);
  if (!lot) return false;
  const { data: linkedProducts, error: linkedError } = await getSupabaseAdmin()
    .from("products")
    .select("id", { count: "exact" })
    .eq("lot_code", lot.code)
    .eq("active", true)
    .limit(1);
  if (linkedError) throw new Error(`Lot links could not be checked: ${linkedError.code}`);
  if (linkedProducts?.length) throw new Error("Désactivez les produits reliés avant d’archiver ce lot.");
  const { data, error } = await getSupabaseAdmin()
    .from("lots")
    .update({ status: "Archivé", public_traceability_enabled: false })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`Lot could not be archived: ${error.message}`);
  return Boolean(data);
}
