import { z } from "zod";

export const generateAgentReplySchema = z.object({
  agentId: z.string().min(1),
  transcript: z.string().trim().min(10).max(30000),
  contactName: z.string().trim().optional(),
  campaignObjective: z.string().trim().optional(),
});

export type GenerateAgentReplyInput = z.infer<typeof generateAgentReplySchema>;
