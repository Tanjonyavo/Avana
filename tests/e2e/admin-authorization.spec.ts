import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

const adminRoot = path.resolve("app/api/admin");
const uuid = "550e8400-e29b-41d4-a716-446655440000";
const origin = new URL(process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000").origin;

// Discover every protected handler so a future endpoint joins this behavioral
// check. Responses come from the running Next server; no auth or DB mocks.
function endpoints(directory: string): Array<{ url: string; method: string }> {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) return endpoints(filename);
    if (entry.name !== "route.ts") return [];
    const relative = path.relative(adminRoot, directory).replaceAll(path.sep, "/");
    if (["login", "logout"].includes(relative)) return [];
    const url = `/api/admin/${relative}`
      .replace("[...path]", `internal-documents/2026/09/${uuid}.pdf`)
      .replaceAll("[id]", uuid)
      .replace("[module]", "suppliers");
    return [
      ...readFileSync(filename, "utf8").matchAll(
        /export\s+async\s+function\s+(GET|POST|PATCH|PUT|DELETE)\s*\(/g,
      ),
    ].map((match) => ({ url, method: match[1] }));
  });
}

test("every protected administrator API rejects absent and forged credentials", async ({ request }) => {
  const routes = endpoints(adminRoot);
  expect(routes.length).toBeGreaterThan(20);
  for (const cookie of ["", "avana_admin_session=admin.9999999999.AAAAAAAAAAAAAAAAAAAAAA.invalid"]) {
    for (const route of routes) {
      const response = await request.fetch(route.url, {
        method: route.method,
        headers: { Origin: origin, ...(cookie ? { Cookie: cookie } : {}) },
        ...(["POST", "PATCH", "PUT"].includes(route.method) ? { data: {} } : {}),
      });
      expect(response.status(), `${route.method} ${route.url}`).toBe(401);
    }
  }
});
