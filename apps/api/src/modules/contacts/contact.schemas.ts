import { z } from "zod";

function emptyStringToUndefined(value: unknown) {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  return value;
}

export const createContactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(5).max(40),
  email: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().email().max(160).optional()
  ),
  company: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().max(160).optional()
  ),
  notes: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().max(2000).optional()
  ),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;
