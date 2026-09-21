export function canonicalSiteOrigin(value: string, requireHttps = process.env.NODE_ENV === "production") {
  try {
    const url = new URL(value);
    if (!url.hostname || url.username || url.password || url.pathname !== "/" || url.search || url.hash)
      return null;
    if (requireHttps ? url.protocol !== "https:" : !["http:", "https:"].includes(url.protocol)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export const SITE_URL =
  canonicalSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL || "", false) || "https://avana.ca";

export const COMMERCE_ENABLED = process.env.NEXT_PUBLIC_COMMERCE_ENABLED === "true";
export const DEMO_MODE = !COMMERCE_ENABLED;

export function absoluteUrl(path = "/") {
  const localPath = /^\/(?!\/)[^\u0000-\u001f\u007f\\]*$/.test(path) && !path.includes("..") ? path : "/";
  return `${SITE_URL}${localPath}`;
}
