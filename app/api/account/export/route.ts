import { NextResponse } from "next/server";
import { isSupabaseAdminConfigured, isSupabaseAuthConfigured } from "@/lib/server/config";
import { getCustomerAccount } from "@/lib/server/customer-account";
import { listCustomerOrders } from "@/lib/server/orders";
import { getCurrentUser } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/server/rate-limit";

export async function GET() {
  if (!isSupabaseAdminConfigured() || !isSupabaseAuthConfigured()) {
    return NextResponse.json({ error: "Le compte n’est pas configuré." }, { status: 503 });
  }
  const user = await getCurrentUser();
  if (!user?.email) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  if (!(await rateLimit("account-export", user.id, 3, 60 * 60))) {
    return NextResponse.json(
      { error: "Trop de demandes d’export. Réessayez plus tard." },
      { status: 429, headers: { "Cache-Control": "private, no-store", "Retry-After": "3600" } },
    );
  }
  const [account, orders] = await Promise.all([
    getCustomerAccount(user.id, user.email),
    listCustomerOrders(user.id, user.email),
  ]);
  const body = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      email: user.email,
      profile: account.profile,
      addresses: account.addresses,
      orders,
    },
    null,
    2,
  );
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="avana-mes-donnees-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
