import fs from "node:fs";
import path from "node:path";

function parseEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .split(/\r?\n/)
      .flatMap((line) => {
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!match) return [];
        let value = match[2];
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        return [[match[1], value]];
      }),
  );
}

const root = process.cwd();
const fileValues = [".env.production.local", ".env.local", ".env.production", ".env"]
  .map((file) => parseEnvFile(path.join(root, file)))
  .reduceRight((merged, values) => ({ ...merged, ...values }), {});
const env = { ...fileValues, ...process.env };
const allowTestStripe = process.argv.includes("--test");
const blocking = [];
const warnings = [];

function requireValue(name, label = name, minimum = 1) {
  if (!env[name] || env[name].length < minimum) blocking.push(`${label} est absent ou trop court.`);
}

function requireUrl(name, label, https = true) {
  try {
    const url = new URL(env[name] || "");
    if (https && url.protocol !== "https:") blocking.push(`${label} doit utiliser HTTPS.`);
    if (url.username || url.password) blocking.push(`${label} ne doit pas contenir d’identifiants.`);
    if (https && ["localhost", "127.0.0.1"].includes(url.hostname))
      blocking.push(`${label} doit viser le domaine public.`);
    if (url.pathname !== "/" || url.search || url.hash)
      blocking.push(`${label} doit contenir seulement l’origine du site.`);
  } catch {
    blocking.push(`${label} n’est pas une URL valide.`);
  }
}

function requireEmail(name, label = name) {
  const value = env[name] || "";
  if (!value) return;
  const displayMatch = value.match(/<([^<>]+)>\s*$/);
  const address = displayMatch ? displayMatch[1] : value;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) blocking.push(`${label} n’est pas un courriel valide.`);
}

if (env.NEXT_PUBLIC_COMMERCE_ENABLED !== "true")
  blocking.push("NEXT_PUBLIC_COMMERCE_ENABLED doit valoir true.");
requireUrl("NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_SITE_URL");
requireUrl("NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
requireUrl("SUPABASE_URL", "SUPABASE_URL");
if (env.SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_URL) {
  try {
    if (new URL(env.SUPABASE_URL).origin !== new URL(env.NEXT_PUBLIC_SUPABASE_URL).origin) {
      blocking.push("SUPABASE_URL et NEXT_PUBLIC_SUPABASE_URL doivent viser le même projet.");
    }
  } catch {}
}
requireValue("NEXT_PUBLIC_SUPABASE_ANON_KEY");
requireValue("SUPABASE_SERVICE_ROLE_KEY");
requireValue("STRIPE_SECRET_KEY");
requireValue("STRIPE_WEBHOOK_SECRET");
if (env.STRIPE_SECRET_KEY && !env.STRIPE_SECRET_KEY.startsWith(allowTestStripe ? "sk_test_" : "sk_live_")) {
  blocking.push(
    allowTestStripe
      ? "STRIPE_SECRET_KEY doit être une clé de test sk_test_."
      : "STRIPE_SECRET_KEY doit être une clé réelle sk_live_.",
  );
}
if (env.STRIPE_WEBHOOK_SECRET && !env.STRIPE_WEBHOOK_SECRET.startsWith("whsec_"))
  blocking.push("STRIPE_WEBHOOK_SECRET doit commencer par whsec_.");
if (env.STRIPE_AUTOMATIC_TAX === "false")
  warnings.push("Stripe Tax est désactivé; faites valider et configurer la taxation avant les ventes.");
requireValue("RESEND_API_KEY");
requireValue("RESEND_FROM_EMAIL");
requireValue("CONTACT_TO_EMAIL");
requireValue("ORDERS_TO_EMAIL");
requireEmail("RESEND_FROM_EMAIL");
requireEmail("CONTACT_TO_EMAIL");
requireEmail("ORDERS_TO_EMAIL");
requireValue("ADMIN_PASSWORD", "ADMIN_PASSWORD", 14);
requireValue("SESSION_SECRET", "SESSION_SECRET", 32);
requireValue("ADMIN_TOTP_SECRET", "ADMIN_TOTP_SECRET", 32);
requireValue("CRON_SECRET", "CRON_SECRET", 32);
if (env.ADMIN_TOTP_SECRET && !/^[A-Z2-7]{32,}$/i.test(env.ADMIN_TOTP_SECRET)) {
  blocking.push("ADMIN_TOTP_SECRET doit être un secret Base32 d’au moins 32 caractères.");
}
if (env.SESSION_SECRET && env.CRON_SECRET && env.SESSION_SECRET === env.CRON_SECRET) {
  blocking.push("SESSION_SECRET et CRON_SECRET doivent être différents.");
}
if (
  env.ADMIN_PASSWORD &&
  [env.SESSION_SECRET, env.CRON_SECRET, env.ADMIN_TOTP_SECRET].includes(env.ADMIN_PASSWORD)
) {
  blocking.push("ADMIN_PASSWORD ne doit pas réutiliser un secret technique.");
}
requireValue("BUSINESS_NAME");
requireValue("BUSINESS_SUPPORT_EMAIL");
requireValue("BUSINESS_ADDRESS_LINE1");
requireValue("BUSINESS_CITY");
requireValue("BUSINESS_PROVINCE", "BUSINESS_PROVINCE", 2);
requireValue("BUSINESS_POSTAL_CODE");
requireValue("BUSINESS_COUNTRY", "BUSINESS_COUNTRY", 2);
requireEmail("BUSINESS_SUPPORT_EMAIL");
if (env.BUSINESS_COUNTRY && env.BUSINESS_COUNTRY !== "CA") {
  blocking.push("BUSINESS_COUNTRY doit valoir CA pour cette version canadienne.");
}
if (
  env.BUSINESS_PROVINCE &&
  !["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"].includes(
    env.BUSINESS_PROVINCE,
  )
) {
  blocking.push("BUSINESS_PROVINCE doit être un code provincial canadien valide.");
}
if (env.BUSINESS_POSTAL_CODE && !/^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(env.BUSINESS_POSTAL_CODE)) {
  blocking.push("BUSINESS_POSTAL_CODE doit être un code postal canadien valide.");
}
if (!env.BUSINESS_PHONE) warnings.push("BUSINESS_PHONE est recommandé pour le soutien et les confirmations.");
if (Boolean(env.CANADA_POST_USERNAME) !== Boolean(env.CANADA_POST_PASSWORD)) {
  blocking.push("Les deux identifiants Postes Canada doivent être fournis ensemble.");
} else if (!env.CANADA_POST_USERNAME) {
  warnings.push("Postes Canada n’est pas connecté; le suivi restera manuel.");
}

for (const name of [
  "STANDARD_SHIPPING_CENTS",
  "EXPRESS_SHIPPING_CENTS",
  "FREE_SHIPPING_THRESHOLD_CENTS",
  "ORDER_RESERVATION_MINUTES",
  "LOW_STOCK_THRESHOLD",
]) {
  if (!/^\d+$/.test(env[name] || "")) blocking.push(`${name} doit être un entier positif ou nul.`);
}
if (/^\d+$/.test(env.ORDER_RESERVATION_MINUTES || "")) {
  const minutes = Number(env.ORDER_RESERVATION_MINUTES);
  if (minutes < 30 || minutes > 120)
    blocking.push("ORDER_RESERVATION_MINUTES doit être compris entre 30 et 120.");
}
if (/^\d+$/.test(env.LOW_STOCK_THRESHOLD || "") && Number(env.LOW_STOCK_THRESHOLD) > 1_000_000) {
  blocking.push("LOW_STOCK_THRESHOLD est trop élevé.");
}
if (env.CANADA_POST_USERNAME && env.CANADA_POST_PASSWORD && env.CANADA_POST_ENVIRONMENT !== "production") {
  warnings.push("Postes Canada utilise encore l’environnement de développement.");
}
if (env.CANADA_POST_ENVIRONMENT && !["development", "production"].includes(env.CANADA_POST_ENVIRONMENT)) {
  blocking.push("CANADA_POST_ENVIRONMENT doit valoir development ou production.");
}

console.log(`AVANA — contrôle ${allowTestStripe ? "préproduction Stripe" : "production"}`);
warnings.forEach((warning) => console.log(`AVERTISSEMENT · ${warning}`));
blocking.forEach((error) => console.error(`BLOCAGE · ${error}`));
if (blocking.length) {
  console.error(
    `\n${blocking.length} blocage(s), ${warnings.length} avertissement(s). Aucun secret n’a été affiché.`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `\nConfiguration statique valide · ${warnings.length} avertissement(s). Vérifiez ensuite /admin/parametres et /api/health.`,
  );
}
