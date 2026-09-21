import "server-only";

import { isAdminAuthConfigured } from "@/lib/admin-auth";
import {
  getCommerceReadiness,
  isEmailConfigured,
  isStripeConfigured,
  isSupabaseAdminConfigured,
  isSupabaseAuthConfigured,
} from "@/lib/server/config";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { canonicalSiteOrigin, COMMERCE_ENABLED } from "@/lib/site";

export interface LaunchCheck {
  id: string;
  label: string;
  status: "ready" | "warning" | "blocking";
  detail: string;
}

function check(
  id: string,
  label: string,
  ready: boolean,
  detail: string,
  severity: "warning" | "blocking" = "blocking",
): LaunchCheck {
  return { id, label, status: ready ? "ready" : severity, detail };
}

export async function getLaunchReadiness() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  const businessComplete = Boolean(
    process.env.BUSINESS_NAME &&
      process.env.BUSINESS_SUPPORT_EMAIL &&
      process.env.BUSINESS_ADDRESS_LINE1 &&
      process.env.BUSINESS_CITY &&
      process.env.BUSINESS_POSTAL_CODE,
  );
  const checks: LaunchCheck[] = [
    check(
      "commerce",
      "Commerce réel",
      COMMERCE_ENABLED,
      "NEXT_PUBLIC_COMMERCE_ENABLED doit être activé au lancement.",
    ),
    check(
      "domain",
      "URL canonique HTTPS",
      Boolean(canonicalSiteOrigin(configuredUrl, true)),
      "Définissez le domaine final avec HTTPS.",
    ),
    check(
      "database",
      "Base Supabase serveur",
      isSupabaseAdminConfigured(),
      "Catalogue, stocks et commandes exigent la clé serveur Supabase.",
    ),
    check(
      "accounts",
      "Comptes clients",
      isSupabaseAuthConfigured(),
      "Configurez l’URL et la clé anonyme Supabase Auth.",
    ),
    check(
      "payments",
      "Paiements Stripe",
      isStripeConfigured(),
      "Ajoutez la clé secrète et le secret de signature webhook.",
    ),
    check(
      "taxes",
      "Calcul automatique des taxes",
      process.env.STRIPE_AUTOMATIC_TAX !== "false",
      "Vérifiez vos obligations fiscales; Stripe Tax est désactivé.",
      "warning",
    ),
    check(
      "emails",
      "Courriels transactionnels",
      isEmailConfigured(),
      "Ajoutez Resend et une adresse d’expédition vérifiée.",
    ),
    check(
      "admin",
      "Administration protégée",
      isAdminAuthConfigured(),
      "Définissez un mot de passe fort et un secret de session de 32 caractères minimum.",
    ),
    check(
      "cron",
      "Automatisations planifiées",
      Boolean(process.env.CRON_SECRET && process.env.CRON_SECRET.length >= 32),
      "Un CRON_SECRET robuste protège le suivi et la file de notifications.",
    ),
    check(
      "operations",
      "Adresse et soutien",
      businessComplete,
      "Complétez l’identité, l’adresse postale et le courriel de soutien.",
    ),
    check(
      "alerts",
      "Alertes de commandes",
      Boolean(process.env.ORDERS_TO_EMAIL),
      "Définissez l’adresse interne qui reçoit commandes, litiges et stocks faibles.",
    ),
    check(
      "tracking",
      "Suivi Postes Canada",
      Boolean(process.env.CANADA_POST_USERNAME && process.env.CANADA_POST_PASSWORD),
      "Facultatif : sans identifiants, le suivi peut rester manuel.",
      "warning",
    ),
  ];

  let metrics = {
    activeProducts: 0,
    activeVariants: 0,
    publicLots: 0,
    failedNotifications: 0,
    lastWebhookAt: "",
  };
  if (isSupabaseAdminConfigured()) {
    const client = getSupabaseAdmin();
    const [
      products,
      variants,
      lots,
      notifications,
      webhook,
      inventory,
      operations,
      orders,
      addresses,
      campaigns,
      submissions,
      schemaVersion,
      publicBucket,
      privateBucket,
    ] = await Promise.all([
      client.from("products").select("id", { count: "exact", head: true }).eq("active", true),
      client
        .from("product_variants")
        .select("id", { count: "exact", head: true })
        .eq("active", true)
        .gt("stock_on_hand", 0),
      client
        .from("lots")
        .select("id", { count: "exact", head: true })
        .eq("public_traceability_enabled", true)
        .neq("status", "Archivé"),
      client.from("notifications").select("id", { count: "exact", head: true }).eq("status", "failed"),
      client
        .from("payment_events")
        .select("processed_at")
        .eq("status", "processed")
        .order("processed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      client.from("inventory_movements").select("id", { count: "exact", head: true }),
      client.from("operational_records").select("id", { count: "exact", head: true }),
      client.from("orders").select("id, refunded_cents", { count: "exact", head: true }),
      client.from("customer_addresses").select("id", { count: "exact", head: true }),
      client.from("marketing_campaigns").select("id", { count: "exact", head: true }),
      client.from("submissions").select("id", { count: "exact", head: true }),
      client.rpc("commerce_schema_version"),
      client.storage.getBucket("avana-public"),
      client.storage.getBucket("avana-private"),
    ]);
    const databaseError =
      products.error ||
      variants.error ||
      lots.error ||
      notifications.error ||
      webhook.error ||
      inventory.error ||
      operations.error ||
      orders.error ||
      addresses.error ||
      campaigns.error ||
      submissions.error ||
      schemaVersion.error ||
      schemaVersion.data !== 6;
    if (databaseError) {
      checks.push(
        check(
          "migration",
          "Migration commerce",
          false,
          "La base répond, mais le schéma commerce complet n’est pas disponible.",
        ),
      );
    } else {
      metrics = {
        activeProducts: products.count || 0,
        activeVariants: variants.count || 0,
        publicLots: lots.count || 0,
        failedNotifications: notifications.count || 0,
        lastWebhookAt: webhook.data?.processed_at || "",
      };
      checks.push(
        check(
          "catalog",
          "Catalogue publiable",
          metrics.activeProducts > 0 && metrics.activeVariants > 0,
          "Publiez au moins un produit et un format avec stock.",
        ),
      );
      checks.push(
        check(
          "traceability",
          "Lot public",
          metrics.publicLots > 0,
          "Publiez au moins une fiche lot reliée aux produits.",
          "warning",
        ),
      );
      checks.push(
        check(
          "webhook-test",
          "Webhook Stripe testé",
          Boolean(metrics.lastWebhookAt),
          "Effectuez un paiement test avant d’accepter des commandes.",
          "warning",
        ),
      );
      checks.push(
        check(
          "notification-queue",
          "File de courriels",
          metrics.failedNotifications === 0,
          `${metrics.failedNotifications} notification(s) ont échoué.`,
          "warning",
        ),
      );
    }
    checks.push(
      check(
        "storage-public",
        "Médias publics",
        !publicBucket.error && publicBucket.data?.public === true,
        "Le bucket public avana-public doit être créé par la migration.",
      ),
    );
    checks.push(
      check(
        "storage-private",
        "Documents confidentiels",
        !privateBucket.error && privateBucket.data?.public === false,
        "Le bucket privé avana-private doit être créé par la migration.",
      ),
    );
  }

  const checkout = getCommerceReadiness();
  return {
    checks,
    metrics,
    checkoutReady: COMMERCE_ENABLED && checkout.ready,
    blockingCount: checks.filter((item) => item.status === "blocking").length,
    warningCount: checks.filter((item) => item.status === "warning").length,
  };
}
