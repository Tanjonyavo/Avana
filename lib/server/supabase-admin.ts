import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseAdminConfigured } from "@/lib/server/config";

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin() {
  if (!isSupabaseAdminConfigured()) {
    throw new Error("Supabase server configuration is incomplete");
  }
  if (!adminClient) {
    adminClient = createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || "",
      {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { "X-Client-Info": "avana-web/1.0" } },
      },
    );
  }
  return adminClient;
}
