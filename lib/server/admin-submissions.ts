import "server-only";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { b2bStages, type B2BSubmission } from "@/lib/b2b";
import {
  submissionStatuses,
  type AdminGeneralSubmission,
  type SubmissionStatus,
} from "@/lib/submission-status";

interface SubmissionRow {
  id: string;
  status: string;
  notes: string;
  received_at: string;
  payload: Record<string, unknown>;
}

function text(payload: Record<string, unknown>, key: string) {
  return typeof payload[key] === "string" ? payload[key] : "";
}

export async function listB2BSubmissions(limit = 250) {
  const { data, error } = await getSupabaseAdmin()
    .from("submissions")
    .select("id, status, notes, received_at, payload")
    .eq("kind", "b2b")
    .order("received_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 1_000)));
  if (error) throw new Error(`B2B submissions could not be listed: ${error.code}`);
  return (data as SubmissionRow[]).map(
    (row): B2BSubmission => ({
      id: row.id,
      status: b2bStages.includes(row.status as B2BSubmission["status"])
        ? (row.status as B2BSubmission["status"])
        : "Nouveau lead",
      notes: row.notes,
      receivedAt: row.received_at,
      firstName: text(row.payload, "firstName"),
      lastName: text(row.payload, "lastName"),
      company: text(row.payload, "company"),
      email: text(row.payload, "email"),
      phone: text(row.payload, "phone"),
      segment: text(row.payload, "segment"),
      province: text(row.payload, "province"),
      product: text(row.payload, "product"),
      volume: text(row.payload, "volume"),
      frequency: text(row.payload, "frequency"),
      comment: text(row.payload, "comment"),
    }),
  );
}

export async function updateB2BSubmission(
  id: string,
  input: { status: B2BSubmission["status"]; notes: string },
) {
  const { data, error } = await getSupabaseAdmin()
    .from("submissions")
    .update(input)
    .eq("id", id)
    .eq("kind", "b2b")
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`B2B submission could not be updated: ${error.code}`);
  return Boolean(data);
}

export async function listGeneralSubmissions() {
  const { data, error } = await getSupabaseAdmin()
    .from("submissions")
    .select("id, kind, status, notes, received_at, payload")
    .in("kind", ["contact", "waitlist"])
    .order("received_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(`Submissions could not be listed: ${error.code}`);
  return (data || []).map(
    (row): AdminGeneralSubmission => ({
      id: row.id,
      kind: row.kind as AdminGeneralSubmission["kind"],
      status: submissionStatuses.includes(row.status as SubmissionStatus)
        ? (row.status as SubmissionStatus)
        : "new",
      notes: row.notes || "",
      receivedAt: row.received_at,
      payload: row.payload || {},
    }),
  );
}

export async function updateGeneralSubmission(
  id: string,
  input: { status: SubmissionStatus; notes: string },
) {
  const { data, error } = await getSupabaseAdmin()
    .from("submissions")
    .update(input)
    .eq("id", id)
    .in("kind", ["contact", "waitlist"])
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`Submission could not be updated: ${error.code}`);
  return Boolean(data);
}

export async function getSubmissionMetrics() {
  const { data, error } = await getSupabaseAdmin().from("submissions").select("kind, status");
  if (error) throw new Error(`Submission metrics could not be loaded: ${error.code}`);
  const rows = data as Array<{ kind: string; status: string }>;
  return {
    total: rows.length,
    b2b: rows.filter((row) => row.kind === "b2b").length,
    activeB2B: rows.filter((row) => row.kind === "b2b" && !["Client", "Perdu"].includes(row.status)).length,
    contact: rows.filter((row) => row.kind === "contact").length,
    waitlist: rows.filter((row) => row.kind === "waitlist").length,
  };
}

export async function getSubscriberCount() {
  const { count, error } = await getSupabaseAdmin()
    .from("newsletter_subscribers")
    .select("email", { count: "exact", head: true })
    .eq("status", "subscribed");
  if (error) throw new Error(`Subscriber count could not be loaded: ${error.code}`);
  return count || 0;
}
