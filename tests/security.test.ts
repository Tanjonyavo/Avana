import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { serializeJsonForHtml } from "../lib/security";
import { absoluteUrl, canonicalSiteOrigin, SITE_URL } from "../lib/site";
import {
  readBinaryBody,
  readJsonBody,
  readTextBody,
  RequestBodyTooLargeError,
} from "../lib/server/request-body";
import { requestFingerprint, sensitiveRateLimitIdentifier } from "../lib/server/rate-limit";

describe("security boundaries", () => {
  it("escapes script-closing sequences in JSON-LD", () => {
    const serialized = serializeJsonForHtml({ name: "</script><script>alert(1)</script>" });
    expect(serialized).not.toContain("<");
    expect(serialized).toContain("\\u003c/script\\u003e");
  });

  it("accepts only canonical site origins and local absolute URL paths", () => {
    expect(canonicalSiteOrigin("https://avana.ca", true)).toBe("https://avana.ca");
    expect(canonicalSiteOrigin("https://user:pass@evil.example", true)).toBeNull();
    expect(canonicalSiteOrigin("https://avana.ca/path", true)).toBeNull();
    expect(absoluteUrl("//evil.example/path")).toBe(`${SITE_URL}/`);
  });

  it("rejects oversized streamed bodies without a content-length header", async () => {
    const request = new Request("https://avana.ca/api/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value: "x".repeat(200) }),
    });
    await expect(readTextBody(request, 64)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
  });

  it("rejects an actual binary body larger than its declared length", async () => {
    const request = new Request("https://avana.ca/api/upload", {
      method: "POST",
      headers: { "content-length": "8" },
      body: new Uint8Array(128),
    });
    await expect(readBinaryBody(request, 64)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
  });

  it("requires JSON content type and parses bounded JSON", async () => {
    const valid = new Request("https://avana.ca/api/test", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ ok: true }),
    });
    await expect(readJsonBody(valid, 1_024)).resolves.toEqual({ ok: true });

    const invalid = new Request("https://avana.ca/api/test", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "{}",
    });
    await expect(readJsonBody(invalid, 1_024)).rejects.toThrow("INVALID_CONTENT_TYPE");
  });

  it("does not let User-Agent rotation bypass an IP rate-limit bucket", () => {
    const first = new Request("https://avana.ca", {
      headers: { "x-vercel-forwarded-for": "203.0.113.7", "user-agent": "agent-a" },
    });
    const rotated = new Request("https://avana.ca", {
      headers: { "x-vercel-forwarded-for": "203.0.113.7", "user-agent": "agent-b" },
    });
    const otherIp = new Request("https://avana.ca", {
      headers: { "x-vercel-forwarded-for": "203.0.113.8", "user-agent": "agent-a" },
    });
    expect(requestFingerprint(first as never)).toBe(requestFingerprint(rotated as never));
    expect(requestFingerprint(first as never)).not.toBe(requestFingerprint(otherIp as never));
  });

  it("keeps recipient rate-limit keys deterministic and non-reversible", () => {
    const previous = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = "test-secret-that-is-longer-than-thirty-two-characters";
    const first = sensitiveRateLimitIdentifier(" Client@Example.ca ");
    const repeated = sensitiveRateLimitIdentifier("client@example.ca");
    expect(first).toBe(repeated);
    expect(first).not.toContain("client");
    if (previous === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previous;
  });

  it("refreshes private Supabase sessions through the proxy", () => {
    const proxy = readFileSync("proxy.ts", "utf8");
    expect(proxy).toContain("await supabase.auth.getClaims()");
    expect(proxy).toContain('requestHeaders.set("cookie", request.cookies.toString())');
    expect(proxy).toContain("Object.entries(headers)");
  });

  it("keeps signed order links short-lived and delegates PDF validation", () => {
    const orderAccess = readFileSync("lib/server/order-access.ts", "utf8");
    const uploads = readFileSync("app/api/admin/uploads/route.ts", "utf8");
    const uploadSecurity = readFileSync("lib/upload-security.ts", "utf8");
    expect(orderAccess).toContain("60 * 60 * 24 * 30");
    expect(orderAccess).not.toContain("60 * 60 * 24 * 365");
    expect(uploads).toContain("validateUploadedFile");
    expect(uploadSecurity).toContain("JavaScript|JS|OpenAction|AA|Launch|EmbeddedFiles?|RichMedia");
  });
});
