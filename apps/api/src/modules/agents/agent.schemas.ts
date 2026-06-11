import { z } from "zod";

export const createAgentSchema = z.object({
  name: z.string().min(2).max(100),
  persona: z.string().min(10).max(2000),
  companyContext: z.string().min(10).max(3000),
  callObjective: z.string().min(10).max(2000),
  openingMessage: z.string().min(5).max(1000),
  language: z.string().min(2).max(20).default("en"),
  voiceStyle: z
    .enum(["professional", "friendly", "casual", "empathetic", "energetic"])
    .default("professional"),
});

export const updateAgentSchema = createAgentSchema.partial().extend({
  status: z.enum(["active", "archived"]).optional(),
});

export type CreateAgentInput = z.infer<typeof createAgentSchema>;
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;
