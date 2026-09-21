import { NextRequest, NextResponse } from "next/server";
import { deliverSubmission } from "@/lib/server/submissions";
import { hasValidOrigin } from "@/lib/server/request";
import { readJsonBody, RequestBodyTooLargeError } from "@/lib/server/request-body";
import { submissionSchema } from "@/lib/validation";
import { rateLimit, requestFingerprint, sensitiveRateLimitIdentifier } from "@/lib/server/rate-limit";

export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request)) {
    return NextResponse.json({ error: "Origine non autorisée." }, { status: 403 });
  }

  if (!(await rateLimit("submission", requestFingerprint(request), 8, 10 * 60))) {
    return NextResponse.json(
      { error: "Trop de demandes. Réessayez dans quelques minutes." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await readJsonBody(request, 16_000);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: "La demande est trop volumineuse." }, { status: 413 });
    }
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const parsed = submissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Vérifiez les champs du formulaire.", fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  if (
    !(await rateLimit("submission-recipient", sensitiveRateLimitIdentifier(parsed.data.email), 5, 30 * 60))
  ) {
    return NextResponse.json(
      { error: "Trop de demandes pour cette adresse. Réessayez plus tard." },
      { status: 429 },
    );
  }

  if (parsed.data._gotcha) return NextResponse.json({ ok: true, mode: "demo" });

  try {
    const delivery = await deliverSubmission(parsed.data);
    return NextResponse.json({ ok: true, ...delivery }, { status: delivery.mode === "live" ? 202 : 200 });
  } catch {
    return NextResponse.json(
      { error: "La demande n’a pas pu être transmise. Réessayez ou contactez-nous directement." },
      { status: 502 },
    );
  }
}
