import { readStorage, writeStorage, type StorageParser } from "@/lib/storage";

export type AnalyticsEventName =
  | "page_view"
  | "view_item"
  | "view_cart"
  | "add_to_cart"
  | "begin_checkout"
  | "purchase"
  | "lead_submit"
  | "newsletter_signup"
  | "quiz_complete";

interface ConsentRecord {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
}

function isConsentRecord(value: unknown): value is ConsentRecord {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ConsentRecord>;
  return (
    candidate.necessary === true &&
    typeof candidate.analytics === "boolean" &&
    typeof candidate.marketing === "boolean" &&
    typeof candidate.updatedAt === "string"
  );
}

const consentStorageSchema: StorageParser<ConsentRecord> = {
  safeParse(value) {
    return isConsentRecord(value) ? { success: true, data: value } : { success: false };
  },
};

export function readConsent(): ConsentRecord | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem("avana-consent");
  if (!stored) return null;
  if (stored === "all") return { necessary: true, analytics: true, marketing: true, updatedAt: "" };
  if (stored === "necessary") return { necessary: true, analytics: false, marketing: false, updatedAt: "" };
  return readStorage(localStorage, "avana-consent", consentStorageSchema, null as ConsentRecord | null);
}

export function writeConsent(choices: Pick<ConsentRecord, "analytics" | "marketing">) {
  if (typeof window === "undefined") return;
  writeStorage(localStorage, "avana-consent", {
    necessary: true,
    ...choices,
    updatedAt: new Date().toISOString(),
  });
}

function anonymousId() {
  const existing = localStorage.getItem("avana-anonymous-id");
  if (existing && existing.length >= 16) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem("avana-anonymous-id", created);
  return created;
}

export function trackEvent(
  eventName: AnalyticsEventName,
  properties: Record<string, string | number | boolean | null> = {},
) {
  if (typeof window === "undefined" || !readConsent()?.analytics) return;
  void fetch("/api/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventName,
      anonymousId: anonymousId(),
      path: window.location.pathname,
      properties,
    }),
    keepalive: true,
  });
}
