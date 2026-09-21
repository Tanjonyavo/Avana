import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { getPublicOrderByAccess, getPublicOrderForCustomer } from "@/lib/server/orders";
import { rateLimit, requestFingerprint } from "@/lib/server/rate-limit";

export async function GET(request: NextRequest, context: { params: Promise<{ number: string }> }) {
  if (!(await rateLimit("order-read", requestFingerprint(request), 30, 10 * 60))) {
    return NextResponse.json({ error: "Trop de demandes." }, { status: 429 });
  }
  const { number } = await context.params;
  const decodedNumber = number.trim().toUpperCase();
  if (!/^AVA-\d{4}-\d{6}$/.test(decodedNumber)) {
    return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
  }
  const token = request.nextUrl.searchParams.get("token") || "";
  const user = await getCurrentUser();
  const order = user
    ? await getPublicOrderForCustomer(decodedNumber, user.id)
    : token
      ? await getPublicOrderByAccess(decodedNumber, token)
      : null;
  if (!order) return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
  return NextResponse.json({ order }, { headers: { "Cache-Control": "private, no-store" } });
}
