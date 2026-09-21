import { isActiveAdminSession } from "@/lib/server/admin-session";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin-login-form";
import { ADMIN_SESSION_COOKIE, safeAdminReturnTo } from "@/lib/admin-auth";

export const metadata: Metadata = { title: "Connexion AVANA OS", robots: { index: false, follow: false } };

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ retour?: string; configuration?: string }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  if (await isActiveAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) redirect("/admin");
  return (
    <main className="admin-login-page" id="contenu">
      <Link className="brand" href="/">
        AVANA<span>Madagascar → Québec</span>
      </Link>
      <AdminLoginForm
        returnTo={safeAdminReturnTo(params.retour)}
        unavailable={params.configuration === "requise"}
      />
      <Link className="text-link small" href="/">
        Retour au site public
      </Link>
    </main>
  );
}
