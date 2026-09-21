import { execFileSync } from "node:child_process";
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ignoredDirectories = new Set([
  ".git",
  ".next",
  "node_modules",
  "coverage",
  "out",
  "playwright-report",
  "test-results",
]);
const patterns = [
  ["clé privée", /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/],
  ["clé Stripe", /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/],
  ["secret webhook Stripe", /\bwhsec_[A-Za-z0-9]{16,}\b/],
  ["clé secrète Supabase", /\bsb_secret_[A-Za-z0-9_-]{20,}\b/],
  ["jeton GitHub", /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b|\bgithub_pat_[A-Za-z0-9_]{20,}\b/],
  ["clé AWS", /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ["clé Google", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["clé Resend", /\bre_[A-Za-z0-9_]{20,}\b/],
  ["jeton Slack", /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
  ["clé OpenAI", /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{40,}\b/],
];

// Return only categories: matched credentials must never enter logs or reports.
export function detectSecrets(content) {
  const labels = patterns.filter(([, pattern]) => pattern.test(content)).map(([label]) => label);
  const credentials =
    /^(?:export[ \t]+)?(?:ADMIN_PASSWORD|ADMIN_TOTP_SECRET|SESSION_SECRET|SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|RESEND_API_KEY|CANADA_POST_PASSWORD|CRON_SECRET)[ \t]*=[ \t]*([^\r\n]+)$/gm;
  for (const match of content.matchAll(credentials)) {
    const value = match[1]
      .trim()
      .replace(/^(["'])(.*)\1$/, "$2")
      .trim();
    if (
      !labels.length &&
      value &&
      !/^(?:#|\$\{|<|(?:your|replace|example|placeholder|change)[-_ ])/i.test(value)
    ) {
      labels.push("identifiant serveur dans un fichier environnement");
    }
  }
  for (const match of content.matchAll(/\beyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+\b/g)) {
    try {
      const payload = JSON.parse(Buffer.from(match[1], "base64url").toString("utf8"));
      if (payload.role === "service_role") labels.push("JWT Supabase service_role");
    } catch {
      // A malformed token is not proof of a service-role credential.
    }
  }
  return [...new Set(labels)];
}

function isLocalEnvironment(file) {
  const name = path.basename(file);
  return name !== ".env.example" && (name === ".env" || name.startsWith(".env."));
}

function fallbackFiles(directory, includeLocal, root = directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (ignoredDirectories.has(entry.name)) return [];
    const file = path.join(directory, entry.name);
    const relative = path.relative(root, file).split(path.sep).join("/");
    if (relative.startsWith("docs/security/") && entry.name.endsWith(".raw.json")) return [];
    // Do not follow symlinks/junctions into secrets outside the workspace.
    if (entry.isSymbolicLink()) return [];
    if (entry.isDirectory()) return fallbackFiles(file, includeLocal, root);
    return includeLocal || !isLocalEnvironment(file) ? [file] : [];
  });
}

export function scanRepository(root, { includeLocal = false } = {}) {
  let files;
  let tracked = new Set();
  let source = "filesystem (Git unavailable)";
  const gitOptions = { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], windowsHide: true };
  try {
    tracked = new Set(execFileSync("git", ["ls-files", "-z"], gitOptions).split("\0").filter(Boolean));
    const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard", "-z"], gitOptions)
      .split("\0")
      .filter(Boolean);
    files = [...new Set([...tracked, ...untracked])].map((file) => path.resolve(root, file));
    source = "Git tracked + untracked non-ignored files";
  } catch {
    files = fallbackFiles(root, includeLocal);
  }
  if (includeLocal) files = [...new Set([...files, ...fallbackFiles(root, true)])];

  const findings = [];
  const errors = [];
  let scanned = 0;
  for (const file of files) {
    const relative = path.relative(root, file).split(path.sep).join("/");
    if (tracked.has(relative) && isLocalEnvironment(file)) {
      findings.push({ file: relative, type: "fichier environnement suivi par Git" });
    }
    try {
      const stat = lstatSync(file);
      if (stat.isSymbolicLink() || !stat.isFile()) continue;
      if (stat.size > 20_000_000) {
        errors.push({ file: relative, type: "fichier trop volumineux pour ce scanner (20 Mo)" });
        continue;
      }
      const bytes = readFileSync(file);
      if (bytes.subarray(0, 8192).includes(0)) continue;
      scanned += 1;
      for (const type of detectSecrets(bytes.toString("utf8"))) findings.push({ file: relative, type });
    } catch (error) {
      // A deleted tracked file contains no working-tree data to inspect.
      if (error.code !== "ENOENT") errors.push({ file: relative, type: "lecture impossible" });
    }
  }
  return { source, scanned, findings, errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = scanRepository(process.cwd(), { includeLocal: process.argv.includes("--include-local") });
  if (result.findings.length || result.errors.length) {
    console.error("Secrets potentiels ou scan incomplet (valeurs masquées) :");
    for (const item of [...result.findings, ...result.errors]) console.error(`- ${item.file} · ${item.type}`);
    process.exitCode = 1;
  } else {
    console.log(
      `Aucun motif de secret connu détecté dans ${result.scanned} fichier(s). Source : ${result.source}.`,
    );
  }
}
