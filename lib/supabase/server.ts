import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isSupabaseAuthConfigured } from "@/lib/server/config";
import { authCookieOptions } from "@/lib/supabase/cookie-options";

export async function getSupabaseServerClient() {
  if (!isSupabaseAuthConfigured()) throw new Error("Supabase Auth configuration is incomplete");
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    {
      cookieOptions: authCookieOptions(),
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            return;
          }
        },
      },
    },
  );
}

export async function getCurrentUser() {
  if (!isSupabaseAuthConfigured()) return null;
  const client = await getSupabaseServerClient();
  const { data, error } = await client.auth.getUser();
  // Guest orders and newsletter preferences are matched by email. A valid
  // session alone does not establish ownership when Auth confirmation is off.
  if (error || !data.user?.email || !data.user.email_confirmed_at || data.user.is_anonymous) return null;
  return data.user;
}
