import "server-only";
import {
  isOperationModule,
  operationModules,
  type OperationalRecord,
  type OperationModule,
  type OperationValue,
  type RecallImpact,
} from "@/lib/operations";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { isSafeSitePathOrHttpsUrl } from "@/lib/security";
import { isPrivateDocumentUrl } from "@/lib/upload-security";

interface OperationalRecordRow {
  id: string;
  module: OperationModule;
  title: string;
  status: string;
  data: Record<string, OperationValue>;
  created_at: string;
  updated_at: string;
}

interface RecallImpactRow {
  lot_code: string;
  email: string;
  customer_name: string;
  order_numbers: string[];
  affected_units: number;
}

function mapRecord(row: OperationalRecordRow): OperationalRecord {
  return {
    id: row.id,
    module: row.module,
    title: row.title,
    status: row.status,
    data: row.data || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizedInput(
  module: OperationModule,
  input: { title: string; status: string; data: Record<string, OperationValue> },
) {
  const config = operationModules[module];
  if (!config.statuses.includes(input.status)) throw new Error("INVALID_OPERATION_STATUS");
  const data: Record<string, OperationValue> = {};
  for (const field of config.fields) {
    const candidate = input.data[field.key];
    if (field.type === "boolean") {
      data[field.key] = candidate === true;
    } else if (field.type === "number") {
      const number =
        candidate === "" || candidate === null || candidate === undefined ? null : Number(candidate);
      if (number !== null && (!Number.isFinite(number) || number < 0))
        throw new Error("INVALID_OPERATION_NUMBER");
      data[field.key] = number;
    } else {
      const value = typeof candidate === "string" ? candidate.trim().slice(0, 5_000) : "";
      if (field.required && !value) throw new Error("MISSING_OPERATION_FIELD");
      if (field.type === "url" && value && !isSafeSitePathOrHttpsUrl(value)) {
        throw new Error("INVALID_OPERATION_URL");
      }
      if (field.type === "file" && value && !isPrivateDocumentUrl(value)) {
        throw new Error("INVALID_OPERATION_FILE");
      }
      data[field.key] = value;
    }
  }
  return { title: input.title.trim(), status: input.status, data };
}

export async function listOperationalRecords(module: OperationModule) {
  const { data, error } = await getSupabaseAdmin()
    .from("operational_records")
    .select("id, module, title, status, data, created_at, updated_at")
    .eq("module", module)
    .eq("archived", false)
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(`Operational records could not be listed: ${error.code}`);
  return (data as OperationalRecordRow[]).map(mapRecord);
}

export async function createOperationalRecord(
  module: OperationModule,
  input: { title: string; status: string; data: Record<string, OperationValue> },
) {
  const normalized = normalizedInput(module, input);
  const { data, error } = await getSupabaseAdmin()
    .from("operational_records")
    .insert({ module, ...normalized })
    .select("id")
    .single();
  if (error) throw new Error(`Operational record could not be created: ${error.code}`);
  return data.id as string;
}

export async function updateOperationalRecord(
  module: OperationModule,
  id: string,
  input: { title: string; status: string; data: Record<string, OperationValue> },
) {
  const normalized = normalizedInput(module, input);
  const { data, error } = await getSupabaseAdmin()
    .from("operational_records")
    .update(normalized)
    .eq("id", id)
    .eq("module", module)
    .eq("archived", false)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`Operational record could not be updated: ${error.code}`);
  return Boolean(data);
}

export async function archiveOperationalRecord(module: OperationModule, id: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("operational_records")
    .update({ archived: true })
    .eq("id", id)
    .eq("module", module)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`Operational record could not be archived: ${error.code}`);
  return Boolean(data);
}

export async function getRecallImpacts(records: OperationalRecord[]) {
  const recordsWithLots = records.flatMap((record) => {
    const lotCode = typeof record.data.lotCode === "string" ? record.data.lotCode.trim() : "";
    return lotCode ? [{ id: record.id, lotCode }] : [];
  });
  if (!recordsWithLots.length) return {};

  const lotCodes = [...new Set(recordsWithLots.map((record) => record.lotCode))];
  const { data, error } = await getSupabaseAdmin().rpc("admin_recall_impact", {
    lot_codes_value: lotCodes,
  });
  if (error) throw new Error(`Recall impact could not be calculated: ${error.code}`);

  const byLot = new Map<string, RecallImpact>();
  for (const lotCode of lotCodes) {
    byLot.set(lotCode, {
      lotCode,
      affectedUnits: 0,
      affectedOrders: 0,
      affectedCustomers: 0,
      customers: [],
    });
  }

  for (const row of (data || []) as RecallImpactRow[]) {
    const impact = byLot.get(row.lot_code);
    if (!impact) continue;
    const orderNumbers = Array.isArray(row.order_numbers) ? row.order_numbers : [];
    impact.affectedUnits += Number(row.affected_units) || 0;
    impact.customers.push({
      email: row.email,
      name: row.customer_name || row.email,
      orderNumbers,
      units: Number(row.affected_units) || 0,
    });
  }

  for (const impact of byLot.values()) {
    impact.affectedCustomers = impact.customers.length;
    impact.affectedOrders = new Set(impact.customers.flatMap((customer) => customer.orderNumbers)).size;
    impact.customers.sort((left, right) => left.name.localeCompare(right.name, "fr"));
  }

  return Object.fromEntries(
    recordsWithLots.map((record) => [record.id, byLot.get(record.lotCode) as RecallImpact]),
  );
}

export function assertOperationModule(value: string): OperationModule {
  if (!isOperationModule(value)) throw new Error("INVALID_OPERATION_MODULE");
  return value;
}
