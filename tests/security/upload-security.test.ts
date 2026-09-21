import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  isPrivateDocumentStoragePath,
  isPrivateDocumentUrl,
  isPublicDocumentStoragePath,
  MAX_UPLOAD_BYTES,
  validateUploadedFile,
} from "../../lib/upload-security";

function pdf(body = "<< /Type /Catalog >>") {
  return new TextEncoder().encode(`%PDF-1.4\n1 0 obj\n${body}\nendobj\nstartxref\n42\n%%EOF\n`);
}

function png(width: number, height: number) {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set(new TextEncoder().encode("IHDR"), 12);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
}

describe("secure file uploads", () => {
  it("accepts a simple passive PDF for private document storage", () => {
    expect(
      validateUploadedFile({
        folder: "public-documents",
        fileName: "certificat.pdf",
        mimeType: "application/pdf",
        bytes: pdf(),
      }),
    ).toEqual({ ok: true, extension: "pdf" });
  });

  it("rejects active, obfuscated, compressed and polyglot PDFs", () => {
    for (const bytes of [
      pdf("<< /OpenAction 2 0 R >>"),
      pdf("<< /J#61vaScript 2 0 R >>"),
      pdf("<< /Type /ObjStm >>"),
      new Uint8Array([...pdf(), ...new TextEncoder().encode("<script>alert(1)</script>")]),
    ]) {
      expect(
        validateUploadedFile({
          folder: "public-documents",
          fileName: "certificat.pdf",
          mimeType: "application/pdf",
          bytes,
        }).ok,
      ).toBe(false);
    }
  });

  it("rejects traversal names, MIME mismatches and non-PDF public documents", () => {
    expect(
      validateUploadedFile({
        folder: "public-documents",
        fileName: "../certificat.pdf",
        mimeType: "application/pdf",
        bytes: pdf(),
      }).ok,
    ).toBe(false);
    expect(
      validateUploadedFile({
        folder: "public-documents",
        fileName: "certificat.png",
        mimeType: "application/pdf",
        bytes: pdf(),
      }).ok,
    ).toBe(false);
    expect(
      validateUploadedFile({
        folder: "public-documents",
        fileName: "preuve.png",
        mimeType: "image/png",
        bytes: png(100, 100),
      }).ok,
    ).toBe(false);
  });

  it("rejects oversized payloads and image decompression bombs", () => {
    expect(
      validateUploadedFile({
        folder: "products",
        fileName: "produit.png",
        mimeType: "image/png",
        bytes: new Uint8Array(MAX_UPLOAD_BYTES + 1),
      }).ok,
    ).toBe(false);
    expect(
      validateUploadedFile({
        folder: "products",
        fileName: "produit.png",
        mimeType: "image/png",
        bytes: png(12_000, 12_000),
      }).ok,
    ).toBe(false);
  });

  it("accepts only server-generated document paths", () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    expect(isPrivateDocumentStoragePath(`internal-documents/2026/09/${id}.pdf`)).toBe(true);
    expect(isPrivateDocumentUrl(`/api/admin/files/internal-documents/2026/09/${id}.pdf`)).toBe(true);
    expect(isPublicDocumentStoragePath(`public-documents/2026/09/${id}.pdf`)).toBe(true);
    expect(isPrivateDocumentUrl("https://evil.example/document.pdf")).toBe(false);
    expect(isPrivateDocumentStoragePath("internal-documents/2026/09/../../secret.pdf")).toBe(false);
    expect(isPublicDocumentStoragePath(`public-documents/2026/09/${id}.png`)).toBe(false);
  });

  it("stores every document privately and forces safe download headers", () => {
    const uploadRoute = readFileSync("app/api/admin/uploads/route.ts", "utf8");
    const publicRoute = readFileSync("app/api/documents/[...path]/route.ts", "utf8");
    const delivery = readFileSync("lib/server/private-file-response.ts", "utf8");
    expect(uploadRoute).toContain('folder === "products" ? publicBucket : privateBucket');
    expect(publicRoute).toContain('.contains("public_documents", [{ url }])');
    expect(delivery).toContain('"Content-Disposition": `attachment;');
    expect(delivery).toContain('"X-Content-Type-Options": "nosniff"');
    expect(delivery).toContain('"Content-Security-Policy": "default-src \'none\'; sandbox"');
  });
});
