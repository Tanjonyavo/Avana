import { readFileSync } from "node:fs";

function read(file) {
  let data = JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
  // Accept psql's scalar JSON or the Supabase SQL editor's JSON export.
  if (Array.isArray(data) && data.length === 1) data = data[0].fingerprint;
  if (typeof data === "string") data = JSON.parse(data);
  if (!data || typeof data !== "object" || Array.isArray(data) || !Number.isInteger(data.schema_version))
    throw new Error("Invalid schema fingerprint");
  return data;
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}
try {
  const [localPath, remotePath] = process.argv.slice(2);
  if (!localPath || !remotePath) throw new Error("Provide local.json and staging.json");
  const local = read(localPath),
    remote = read(remotePath);
  const differences = [...new Set([...Object.keys(local), ...Object.keys(remote)])].sort().flatMap((key) => {
    if (!(key in remote)) return [{ key, change: "missing_on_staging" }];
    if (!(key in local)) return [{ key, change: "extra_on_staging" }];
    return JSON.stringify(canonical(local[key])) === JSON.stringify(canonical(remote[key]))
      ? []
      : [{ key, change: "different" }];
  });
  console.log(
    JSON.stringify(
      {
        equal: differences.length === 0,
        local_version: local.schema_version,
        staging_version: remote.schema_version,
        differences,
      },
      null,
      2,
    ),
  );
  if (differences.length) process.exitCode = 1;
} catch {
  console.error(
    "Schema comparison failed: supply two valid exported fingerprints. No credentials were printed.",
  );
  process.exitCode = 1;
}
