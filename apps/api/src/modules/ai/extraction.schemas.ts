import { z } from "zod";

export const extractOutcomeSchema = z.object({
  agentId: z.string().min(1),
  transcript: z.string().min(20).max(20000),
});

export const callOutcomeSchema = z.object({
  summary: z.string(),
  sentiment: z.enum(["positive", "neutral", "negative", "mixed"]),
  intent: z.string(),
  leadStatus: z.enum([
    "interested",
    "not_interested",
    "callback_requested",
    "wrong_number",
    "no_answer",
    "needs_more_info",
    "unknown",
  ]),
  callbackTime: z.string().nullable(),
  objections: z.array(z.string()),
  nextAction: z.string(),
  confidence: z.number().min(0).max(1),
});

export type ExtractOutcomeInput = z.infer<typeof extractOutcomeSchema>;
export type CallOutcome = z.infer<typeof callOutcomeSchema>;
