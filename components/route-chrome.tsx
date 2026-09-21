"use client";

import { usePathname } from "next/navigation";
import { CookieConsent } from "@/components/cookie-consent";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export function RouteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");
  const isFocusedFlow = pathname.startsWith("/checkout") || pathname.startsWith("/commande/");

  if (isAdmin) return <div data-page-shell>{children}</div>;
  if (isFocusedFlow)
    return (
      <div data-page-shell>
        <main id="contenu">{children}</main>
      </div>
    );

  return (
    <div data-page-shell>
      <a className="skip-link" href="#contenu">
        Aller au contenu
      </a>
      <SiteHeader />
      <main id="contenu">{children}</main>
      <SiteFooter />
      <CookieConsent />
    </div>
  );
}
