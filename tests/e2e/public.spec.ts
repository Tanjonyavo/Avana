import { expect, test } from "@playwright/test";

const testOrigin = new URL(process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000").origin;
const testFingerprint = `playwright-${crypto.randomUUID()}`;

async function acceptNecessaryCookies(page: import("@playwright/test").Page) {
  const button = page.getByRole("button", { name: "Nécessaires seulement" });
  if (await button.isVisible().catch(() => false)) await button.click();
}

test("the mobile homepage has no horizontal overflow and keeps search accessible", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await acceptNecessaryCookies(page);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
  await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  await expect(
    page
      .getByRole("navigation", { name: "Navigation mobile" })
      .getByRole("button", { name: "Rechercher", exact: true }),
  ).toBeVisible();
});

test("the traceability search uses the entered lot code", async ({ page }) => {
  await page.goto("/tracabilite");
  await acceptNecessaryCookies(page);
  await page.getByLabel("Numéro inscrit près du QR code").fill("demo-mg-sava-001");
  await page.getByRole("button", { name: "Rechercher", exact: true }).click();
  await expect(page).toHaveURL(/\/tracabilite\/DEMO-MG-SAVA-001$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("DEMO-MG-SAVA-001");
});

test("checkout validates contact details and never asks for card data", async ({ page }) => {
  await page.goto("/boutique/gousses-vanille-madagascar");
  await acceptNecessaryCookies(page);
  await page.getByRole("button", { name: /Ajouter —/ }).click();
  await page.getByRole("link", { name: "Passer à la caisse" }).click();
  await expect(page.locator('input[name="card"], input[autocomplete="cc-number"]')).toHaveCount(0);
  await page.getByLabel("Courriel *").fill("invalide");
  await page.getByLabel("Prénom *").fill("Ava");
  await page.getByLabel("Nom *", { exact: true }).fill("Test");
  await page.getByRole("button", { name: "Continuer", exact: true }).click();
  await expect(page.getByText("Entrez une adresse courriel valide.")).toBeVisible();
});

test("search dialog restores focus when closed", async ({ page }) => {
  await page.goto("/");
  await acceptNecessaryCookies(page);
  const desktopSearch = page.getByRole("button", { name: /Rechercher \(Ctrl K\)/ });
  let searchButton = desktopSearch;
  if (!(await desktopSearch.isVisible())) {
    await page.getByRole("button", { name: "Ouvrir le menu" }).click();
    searchButton = page
      .getByRole("navigation", { name: "Navigation mobile" })
      .getByRole("button", { name: "Rechercher", exact: true });
  }
  await searchButton.focus();
  await searchButton.click();
  await expect(page.getByRole("dialog", { name: "Recherche AVANA" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(searchButton).toBeFocused();
});

test("submission API validates payloads and stays explicit in demo mode", async ({ request }) => {
  const invalid = await request.post("/api/submissions", {
    data: { kind: "newsletter", email: "invalid", source: "test", _gotcha: "" },
    headers: { Origin: testOrigin, "X-Forwarded-For": testFingerprint },
  });
  expect(invalid.status()).toBe(400);

  const valid = await request.post("/api/submissions", {
    data: { kind: "newsletter", email: "validation@example.ca", source: "test", _gotcha: "" },
    headers: { Origin: testOrigin, "X-Forwarded-For": testFingerprint },
  });
  expect(valid.status()).toBe(200);
  await expect(valid.json()).resolves.toMatchObject({ ok: true, mode: "demo" });
});

test("security-sensitive APIs reject forged or oversized requests", async ({ request }) => {
  const webhook = await request.post("/api/webhooks/stripe", {
    data: { type: "checkout.session.completed" },
  });
  expect(webhook.status()).toBe(400);

  const upload = await request.post("/api/admin/uploads", {
    headers: { Origin: testOrigin },
    multipart: {
      folder: "public-documents",
      file: {
        name: "preuve.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4\n%%EOF\n"),
      },
    },
  });
  expect(upload.status()).toBe(401);

  const uploadRead = await request.get("/api/admin/uploads");
  expect(uploadRead.status()).toBe(405);

  const refund = await request.post("/api/admin/orders/550e8400-e29b-41d4-a716-446655440000/refund", {
    headers: { Origin: testOrigin },
    data: { amountCents: 1, restock: false },
  });
  expect(refund.status()).toBe(401);

  const oversized = await request.post("/api/submissions", {
    data: {
      kind: "contact",
      name: "Ava",
      email: "ava@example.ca",
      requestType: "Autre",
      subject: "Test",
      message: "x".repeat(20_000),
      consent: true,
      _gotcha: "",
    },
    headers: { Origin: testOrigin, "X-Forwarded-For": testFingerprint },
  });
  expect(oversized.status()).toBe(413);
});

test("pages emit a nonce CSP and private pages are not cached", async ({ request }) => {
  const home = await request.get("/");
  expect(home.status()).toBe(200);
  const csp = home.headers()["content-security-policy"] || "";
  const scriptPolicy = csp.split(";").find((directive) => directive.trim().startsWith("script-src "));
  expect(scriptPolicy).toContain("'nonce-");
  expect(scriptPolicy).toContain("'strict-dynamic'");
  expect(scriptPolicy).not.toContain("'unsafe-inline'");
  if (process.env.PLAYWRIGHT_PRODUCTION === "true") {
    expect(scriptPolicy).not.toContain("'unsafe-eval'");
  }
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");

  const login = await request.get("/admin/connexion");
  const cacheControl = login.headers()["cache-control"] || "";
  expect(cacheControl).toMatch(/no-store|no-cache/);
  expect(cacheControl).not.toContain("public");
  const order = await request.get("/commande/AVA-2026-000001?token=synthetic-test-value");
  expect(order.headers()["referrer-policy"]).toBe("no-referrer");
  expect(order.headers()["cache-control"]).toMatch(/no-store/);
});

test("pages hydrate under the deployed CSP without blocked scripts", async ({ page }) => {
  await page.addInitScript(() => {
    const blocked: string[] = [];
    Object.assign(window, { avanaBlockedScripts: blocked });
    document.addEventListener("securitypolicyviolation", (event) => {
      if (event.effectiveDirective.startsWith("script-src")) blocked.push(event.effectiveDirective);
    });
  });
  await page.goto("/");
  await acceptNecessaryCookies(page);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const scriptNonces = await page
    .locator("script[src]")
    .evaluateAll((scripts) => scripts.map((script) => (script as HTMLScriptElement).nonce));
  expect(scriptNonces.length).toBeGreaterThan(0);
  expect(scriptNonces.every(Boolean)).toBe(true);
  const violations = await page.evaluate(() => Reflect.get(window, "avanaBlockedScripts") as string[]);
  expect(violations).toEqual([]);
});
