export class RequestBodyTooLargeError extends Error {
  constructor() {
    super("REQUEST_BODY_TOO_LARGE");
    this.name = "RequestBodyTooLargeError";
  }
}

function assertDeclaredLength(request: Request, maximumBytes: number) {
  const value = request.headers.get("content-length");
  if (value === null) return;
  if (!/^\d+$/.test(value) || Number(value) > maximumBytes) throw new RequestBodyTooLargeError();
}

export async function readBinaryBody(request: Request, maximumBytes: number) {
  assertDeclaredLength(request, maximumBytes);
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maximumBytes) {
        await reader.cancel();
        throw new RequestBodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function readTextBody(request: Request, maximumBytes: number) {
  return new TextDecoder("utf-8", { fatal: true }).decode(await readBinaryBody(request, maximumBytes));
}

export async function readMultipartFormData(request: Request, maximumBytes: number) {
  const contentType = request.headers.get("content-type") || "";
  if (!/^multipart\/form-data\s*;/i.test(contentType) || !/\bboundary=/i.test(contentType)) {
    throw new SyntaxError("INVALID_MULTIPART_CONTENT_TYPE");
  }
  const body = await readBinaryBody(request, maximumBytes);
  return new Response(body, { headers: { "Content-Type": contentType } }).formData();
}

export async function readJsonBody(request: Request, maximumBytes: number): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") throw new SyntaxError("INVALID_CONTENT_TYPE");
  return JSON.parse(await readTextBody(request, maximumBytes));
}
