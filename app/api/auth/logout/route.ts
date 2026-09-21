import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { hasValidOrigin } from "@/lib/server/request";
import { isSupabaseAuthConfigured } from "@/lib/server/config";

export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request))
    return NextResponse.json({ error: "Origine non autorisée." }, { status: 403 });
  if (isSupabaseAuthConfigured()) await (await getSupabaseServerClient()).auth.signOut();
  return NextResponse.json({ ok: true });
}
