import { z } from "zod";

function emptyStringToUndefined(value: unknown) {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  return value;
}

export const uploadContactListSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().max(1000).optional()
  ),
});

export type UploadContactListInput = z.infer<typeof uploadContactListSchema>;
