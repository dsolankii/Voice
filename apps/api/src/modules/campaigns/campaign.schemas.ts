import { z } from "zod";

function emptyStringToUndefined(value: unknown) {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  return value;
}

export const createCampaignSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.preprocess(
    emptyStringToUndefined,
    z.string().trim().max(1000).optional()
  ),
  objective: z.string().trim().min(10).max(2000),
  agentId: z.string().min(1),
  contactIds: z.array(z.string().min(1)).min(1).max(1000),
});

export const updateCampaignSchema = createCampaignSchema.partial().extend({
  status: z.enum(["draft", "running", "completed", "archived"]).optional(),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
