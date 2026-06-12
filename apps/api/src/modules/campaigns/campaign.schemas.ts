import { z } from "zod";

function emptyStringToUndefined(value: unknown) {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  return value;
}

const baseCampaignSchema = {
  name: z.string().trim().min(2).max(120),
  description: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().max(1000).optional()
  ),
  objective: z.string().trim().min(10).max(2000),
  agentId: z.string().min(1),
};

export const createCampaignSchema = z
  .object({
    ...baseCampaignSchema,
    contactListId: z.preprocess(
      emptyStringToUndefined,
      z.string().min(1).optional()
    ),
    contactIds: z.array(z.string().min(1)).max(1000).optional(),
  })
  .refine(
    (data) =>
      Boolean(data.contactListId) ||
      (Array.isArray(data.contactIds) && data.contactIds.length > 0),
    {
      message: "Either contactListId or at least one contactId is required",
      path: ["contactListId"],
    }
  );

export const updateCampaignSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().max(1000).optional()
  ),
  objective: z.string().trim().min(10).max(2000).optional(),
  agentId: z.string().min(1).optional(),
  contactListId: z.preprocess(
    emptyStringToUndefined,
    z.string().min(1).optional()
  ),
  contactIds: z.array(z.string().min(1)).max(1000).optional(),
  status: z.enum(["draft", "running", "completed", "archived"]).optional(),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
