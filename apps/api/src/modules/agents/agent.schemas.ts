import { z } from "zod";

export const createAgentSchema = z.object({
  name: z.string().min(2).max(100),
  persona: z.string().min(10).max(6000),
  companyContext: z.string().max(6000).default(""),
  callObjective: z.string().min(10).max(4000),
  openingMessage: z.string().min(5).max(2500),
  closingMessage: z
    .string()
    .max(1200)
    .default("Thanks for your time. Have a great day. Goodbye."),
  conversationGuidelines: z.string().max(8000).default(""),
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
