import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { detectSecrets, scanRepository } from "../../scripts/scan-secrets.mjs";

function temporaryRepository() {
  return mkdtempSync(path.join(os.tmpdir(), "avana-secret-scan-"));
}

describe("secret scanner regression protection", () => {
  it("detects private Supabase keys without returning the credential", () => {
    const credential = ["sb", "secret", "x".repeat(32)].join("_");
    const result = detectSecrets(`const key = '${credential}';`);
    expect(result).toEqual(["clé secrète Supabase"]);
    expect(JSON.stringify(result)).not.toContain(credential);
  });

  it("distinguishes Supabase service-role JWTs from public anon keys", () => {
    const token = (role) =>
      [
        Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url"),
        Buffer.from(JSON.stringify({ role })).toString("base64url"),
        "syntheticSignature",
      ].join(".");
    expect(detectSecrets(token("service_role"))).toEqual(["JWT Supabase service_role"]);
    expect(detectSecrets(token("anon"))).toEqual([]);
  });

  it("rejects a tracked env even when gitignore excludes it", () => {
    const root = temporaryRepository();
    const options = { cwd: root, stdio: "ignore", windowsHide: true };
    execFileSync("git", ["init", "--quiet"], options);
    writeFileSync(path.join(root, ".gitignore"), ".env.*\n");
    writeFileSync(path.join(root, ".env.production"), "SESSION_SECRET=\n");
    execFileSync("git", ["add", "--force", ".env.production"], options);
    expect(scanRepository(root).findings).toContainEqual({
      file: ".env.production",
      type: "fichier environnement suivi par Git",
    });
  });

  it("scans new untracked source files and explicitly included local env", () => {
    const root = temporaryRepository();
    execFileSync("git", ["init", "--quiet"], { cwd: root, stdio: "ignore", windowsHide: true });
    const secret = ["whsec", "x".repeat(32)].join("_");
    writeFileSync(path.join(root, "new-source.ts"), `export const key = '${secret}'`);
    writeFileSync(path.join(root, ".gitignore"), ".env.*\n");
    writeFileSync(path.join(root, ".env.local"), `STRIPE_WEBHOOK_SECRET=${secret}`);
    expect(scanRepository(root).findings.map((f) => f.file)).toEqual(["new-source.ts"]);
    expect(
      scanRepository(root, { includeLocal: true })
        .findings.map((f) => f.file)
        .sort(),
    ).toEqual([".env.local", "new-source.ts"]);
  });

  it("does not report npm integrity hashes or ordinary application values", () => {
    expect(detectSecrets(JSON.stringify({ integrity: `sha512-${"a".repeat(86)}==`, price: 4500 }))).toEqual(
      [],
    );
  });

  it("excludes generated scanner evidence in a filesystem-only checkout", () => {
    const root = temporaryRepository();
    mkdirSync(path.join(root, "docs", "security"), { recursive: true });
    writeFileSync(
      path.join(root, "docs", "security", "report.raw.json"),
      ["whsec", "x".repeat(32)].join("_"),
    );
    writeFileSync(path.join(root, "app.ts"), "export const ready = true;");
    expect(scanRepository(root).findings).toEqual([]);
  });

  it("detects unprefixed server passwords in local environment files", () => {
    expect(detectSecrets(["ADMIN_PASSWORD", "synthetic-password-for-unit-test"].join("="))).toEqual([
      "identifiant serveur dans un fichier environnement",
    ]);
    expect(detectSecrets('ADMIN_PASSWORD=\nSESSION_SECRET=""\n')).toEqual([]);
  });
});
