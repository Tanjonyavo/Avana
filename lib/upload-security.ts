export const MAX_UPLOAD_BYTES = 8_000_000;
export const MAX_IMAGE_DIMENSION = 12_000;
export const MAX_IMAGE_PIXELS = 40_000_000;

export type UploadFolder = "products" | "public-documents" | "internal-documents";

interface FileDefinition {
  extension: "jpg" | "png" | "webp" | "avif" | "pdf";
  acceptedExtensions: readonly string[];
  signature: (bytes: Uint8Array) => boolean;
}

const fileDefinitions: Record<string, FileDefinition> = {
  "image/jpeg": {
    extension: "jpg",
    acceptedExtensions: ["jpg", "jpeg"],
    signature: (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  },
  "image/png": {
    extension: "png",
    acceptedExtensions: ["png"],
    signature: (bytes) =>
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a,
  },
  "image/webp": {
    extension: "webp",
    acceptedExtensions: ["webp"],
    signature: (bytes) => ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP",
  },
  "image/avif": {
    extension: "avif",
    acceptedExtensions: ["avif"],
    signature: (bytes) => ascii(bytes, 4, 8) === "ftyp" && ["avif", "avis"].includes(ascii(bytes, 8, 12)),
  },
  "application/pdf": {
    extension: "pdf",
    acceptedExtensions: ["pdf"],
    signature: (bytes) => ascii(bytes, 0, 5) === "%PDF-",
  },
};

const imageMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const allowedFolders = new Set<UploadFolder>(["products", "public-documents", "internal-documents"]);
const pdfForbiddenNames =
  /\/(?:JavaScript|JS|OpenAction|AA|Launch|EmbeddedFiles?|RichMedia|XFA|AcroForm|SubmitForm|ImportData|GoToR|Sound|Movie|ObjStm|Encrypt)\b/i;
const uploadUuid = "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const privateDocumentStoragePattern = new RegExp(
  `^internal-documents/\\d{4}/\\d{2}/${uploadUuid}\\.(?:jpg|png|webp|avif|pdf)$`,
);
const publicDocumentStoragePattern = new RegExp(`^public-documents/\\d{4}/\\d{2}/${uploadUuid}\\.pdf$`);

export function isPrivateDocumentStoragePath(value: string) {
  return privateDocumentStoragePattern.test(value);
}

export function isPublicDocumentStoragePath(value: string) {
  return publicDocumentStoragePattern.test(value);
}

export function isPrivateDocumentUrl(value: string) {
  const prefix = "/api/admin/files/";
  return value.startsWith(prefix) && isPrivateDocumentStoragePath(value.slice(prefix.length));
}

function ascii(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.slice(start, end));
}

function readUint16(bytes: Uint8Array, offset: number, littleEndian = false) {
  if (offset < 0 || offset + 2 > bytes.length) return 0;
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(offset, littleEndian);
}

function readUint24LittleEndian(bytes: Uint8Array, offset: number) {
  if (offset < 0 || offset + 3 > bytes.length) return 0;
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function readUint32(bytes: Uint8Array, offset: number) {
  if (offset < 0 || offset + 4 > bytes.length) return 0;
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset);
}

function jpegDimensions(bytes: Uint8Array) {
  let offset = 2;
  const startOfFrameMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
  ]);
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    if (startOfFrameMarkers.has(marker)) {
      return { width: readUint16(bytes, offset + 7), height: readUint16(bytes, offset + 5) };
    }
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01) {
      offset += 2;
      continue;
    }
    const length = readUint16(bytes, offset + 2);
    if (length < 2) return null;
    offset += length + 2;
  }
  return null;
}

function webpDimensions(bytes: Uint8Array) {
  const chunk = ascii(bytes, 12, 16);
  if (chunk === "VP8X" && bytes.length >= 30) {
    return {
      width: readUint24LittleEndian(bytes, 24) + 1,
      height: readUint24LittleEndian(bytes, 27) + 1,
    };
  }
  if (chunk === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
    return {
      width: 1 + bytes[21] + ((bytes[22] & 0x3f) << 8),
      height: 1 + ((bytes[22] & 0xc0) >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10),
    };
  }
  if (chunk === "VP8 " && bytes.length >= 30 && ascii(bytes, 23, 26) === "\u009d\u0001*") {
    return {
      width: readUint16(bytes, 26, true) & 0x3fff,
      height: readUint16(bytes, 28, true) & 0x3fff,
    };
  }
  return null;
}

function avifDimensions(bytes: Uint8Array) {
  for (let offset = 0; offset + 16 <= bytes.length; offset += 1) {
    if (
      bytes[offset] === 0x69 &&
      bytes[offset + 1] === 0x73 &&
      bytes[offset + 2] === 0x70 &&
      bytes[offset + 3] === 0x65
    ) {
      return { width: readUint32(bytes, offset + 8), height: readUint32(bytes, offset + 12) };
    }
  }
  return null;
}

function imageDimensions(mimeType: string, bytes: Uint8Array) {
  if (mimeType === "image/png" && bytes.length >= 24 && ascii(bytes, 12, 16) === "IHDR") {
    return { width: readUint32(bytes, 16), height: readUint32(bytes, 20) };
  }
  if (mimeType === "image/jpeg") return jpegDimensions(bytes);
  if (mimeType === "image/webp") return webpDimensions(bytes);
  if (mimeType === "image/avif") return avifDimensions(bytes);
  return null;
}

function validatePdf(bytes: Uint8Array) {
  const source = new TextDecoder("latin1").decode(bytes);
  if (!/^%PDF-1\.[0-7](?:\r\n|\r|\n)/.test(source)) return "En-tête PDF non conforme.";
  const eofMarkers = source.match(/%%EOF/g) || [];
  if (eofMarkers.length !== 1) return "Structure PDF ambiguë ou incrémentale refusée.";
  const eofOffset = source.lastIndexOf("%%EOF") + 5;
  if (!/^[\t\n\f\r ]*$/.test(source.slice(eofOffset))) return "Données ajoutées après la fin du PDF.";
  if (!/startxref\s+\d+\s+%%EOF[\t\n\f\r ]*$/.test(source)) return "Table de références PDF invalide.";
  const canonicalNames = source.replace(/#([0-9a-f]{2})/gi, (_, value: string) =>
    String.fromCharCode(Number.parseInt(value, 16)),
  );
  if (pdfForbiddenNames.test(canonicalNames)) return "Fonction active, chiffrée ou compressée non autorisée.";
  return null;
}

export type UploadValidationResult =
  | { ok: true; extension: FileDefinition["extension"] }
  | { ok: false; status: 400 | 413 | 415; error: string };

export function validateUploadedFile(input: {
  folder: string;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}): UploadValidationResult {
  if (!allowedFolders.has(input.folder as UploadFolder)) {
    return { ok: false, status: 400, error: "Destination invalide." };
  }
  if (input.bytes.length < 1 || input.bytes.length > MAX_UPLOAD_BYTES) {
    return { ok: false, status: 413, error: "Le fichier doit être inférieur ou égal à 8 Mo." };
  }
  if (!input.fileName || input.fileName.length > 180 || /[\/\\\u0000-\u001f\u007f]/.test(input.fileName)) {
    return { ok: false, status: 400, error: "Nom de fichier invalide." };
  }

  const definition = fileDefinitions[input.mimeType];
  if (!definition) return { ok: false, status: 415, error: "Type de fichier non autorisé." };
  const suppliedExtension = input.fileName.split(".").pop()?.toLowerCase() || "";
  if (!definition.acceptedExtensions.includes(suppliedExtension)) {
    return { ok: false, status: 415, error: "Extension et type déclaré incompatibles." };
  }
  if (input.folder === "products" && !imageMimeTypes.has(input.mimeType)) {
    return { ok: false, status: 415, error: "Les produits acceptent uniquement des images." };
  }
  if (input.folder === "public-documents" && input.mimeType !== "application/pdf") {
    return { ok: false, status: 415, error: "Les documents publics doivent être des PDF." };
  }
  if (!definition.signature(input.bytes)) {
    return { ok: false, status: 415, error: "La signature du fichier ne correspond pas à son type." };
  }

  if (input.mimeType === "application/pdf") {
    const pdfError = validatePdf(input.bytes);
    if (pdfError) return { ok: false, status: 415, error: pdfError };
  } else {
    const dimensions = imageDimensions(input.mimeType, input.bytes);
    if (!dimensions || dimensions.width < 1 || dimensions.height < 1) {
      return { ok: false, status: 415, error: "Dimensions d’image introuvables." };
    }
    if (
      dimensions.width > MAX_IMAGE_DIMENSION ||
      dimensions.height > MAX_IMAGE_DIMENSION ||
      dimensions.width * dimensions.height > MAX_IMAGE_PIXELS
    ) {
      return { ok: false, status: 415, error: "Dimensions d’image excessives." };
    }
  }

  return { ok: true, extension: definition.extension };
}
