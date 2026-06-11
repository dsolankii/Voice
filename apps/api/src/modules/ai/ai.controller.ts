import type { Response } from "express";
import type { AuthRequest } from "../../middleware/auth.middleware.js";
import { extractOutcomeSchema } from "./extraction.schemas.js";
import { extractCallOutcome } from "./extraction.service.js";

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
  const input = extractOutcomeSchema.parse(req.body);
  const outcome = await extractCallOutcome(userId, input);

  return res.json({
    outcome,
  });
}
