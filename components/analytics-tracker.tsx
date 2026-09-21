"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics-client";

export function AnalyticsTracker() {
  const pathname = usePathname();
  useEffect(() => {
    trackEvent("page_view");
    const consentChanged = () => trackEvent("page_view", { consentUpdated: true });
    window.addEventListener("avana:consent-changed", consentChanged);
    return () => window.removeEventListener("avana:consent-changed", consentChanged);
  }, [pathname]);
  return null;
}
