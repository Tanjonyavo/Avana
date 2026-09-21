interface SubmissionResponse {
  ok?: boolean;
  mode?: "demo" | "live";
  error?: string;
  fields?: Record<string, string[]>;
}

export async function postSubmission(payload: unknown) {
  const response = await fetch("/api/submissions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = (await response.json()) as SubmissionResponse;
  if (!response.ok || !result.ok) throw new Error(result.error || "La demande n’a pas pu être transmise.");
  return result;
}
