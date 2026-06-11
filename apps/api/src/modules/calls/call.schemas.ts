import { z } from "zod";

function emptyStringToUndefined(value: unknown) {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  return value;
}

export const createCallSchema = z.object({
  campaignId: z.string().min(1),
  contactId: z.string().min(1),
  transcript: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().min(20).max(30000).optional()
  ),
});

export const updateCallSchema = z.object({
  transcript: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().min(20).max(30000).optional()
  ),
  status: z
    .enum(["pending", "transcript_ready", "processing", "completed", "failed"])
    .optional(),
});

export type CreateCallInput = z.infer<typeof createCallSchema>;
export type UpdateCallInput = z.infer<typeof updateCallSchema>;
