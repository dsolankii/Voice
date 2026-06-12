import type { Response } from "express";
import { z } from "zod";
import type { AuthRequest } from "../../middleware/auth.middleware.js";
import { extractCallOutcome } from "./extraction.service.js";
import { generateAgentReplySchema } from "./conversation.schemas.js";
import { generateAgentReply } from "./conversation.service.js";

const extractionRequestSchema = z.object({
  agentId: z.string().min(1),
  transcript: z.string().trim().min(20).max(30000),
});

function getRequiredUserId(req: AuthRequest): string {
  if (!req.userId) {
    const error = new Error("Unauthorized");
    error.name = "UnauthorizedError";
    throw error;
  }

  return req.userId;
}

export async function extractOutcomeController(req: AuthRequest, res: Response) {
  const userId = getRequiredUserId(req);
  const input = extractionRequestSchema.parse(req.body);
  const outcome = await extractCallOutcome(userId, input);

  return res.json({
    outcome,
  });
}

export async function generateAgentReplyController(
  req: AuthRequest,
  res: Response
) {
  const userId = getRequiredUserId(req);
  const input = generateAgentReplySchema.parse(req.body);
  const result = await generateAgentReply(userId, input);

  return res.json(result);
}
