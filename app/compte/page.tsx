import type { Metadata } from "next";
import { AccountAccess } from "@/components/account-access";
import { AccountDashboard } from "@/components/account-dashboard";
import { AccountPortal } from "@/components/account-portal";
import { COMMERCE_ENABLED } from "@/lib/site";
import { isSupabaseAuthConfigured } from "@/lib/server/config";
import { getCustomerAccount } from "@/lib/server/customer-account";
import { listCustomerOrders } from "@/lib/server/orders";
import { getCurrentUser } from "@/lib/supabase/server";
export const metadata: Metadata = { title: "Mon compte", robots: { index: false, follow: false } };
export default async function AccountPage({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const { erreur } = await searchParams;
  if (!COMMERCE_ENABLED) return <AccountDashboard />;
  if (!isSupabaseAuthConfigured()) return <AccountAccess authError={Boolean(erreur)} />;
  const user = await getCurrentUser();
  if (!user?.email) return <AccountAccess authError={Boolean(erreur)} />;
  const [orders, account] = await Promise.all([
    listCustomerOrders(user.id, user.email),
    getCustomerAccount(user.id, user.email),
  ]);
  return (
    <AccountPortal
      email={user.email}
      orders={orders}
      profile={account.profile}
      addresses={account.addresses}
    />
  );
}
