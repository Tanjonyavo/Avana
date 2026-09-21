export const submissionStatuses = ["new", "processing", "resolved", "spam"] as const;
export type SubmissionStatus = (typeof submissionStatuses)[number];

export interface AdminGeneralSubmission {
  id: string;
  kind: "contact" | "waitlist";
  status: SubmissionStatus;
  notes: string;
  receivedAt: string;
  payload: Record<string, unknown>;
}
