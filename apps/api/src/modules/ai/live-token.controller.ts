import type { Response } from "express";
import type { AuthRequest } from "../../middleware/auth.middleware.js";
import { getAgentById } from "../agents/agent.service.js";
import { getCampaignById } from "../campaigns/campaign.service.js";
import { createGeminiLiveToken } from "./live-token.service.js";

function getRequiredUserId(req: AuthRequest): string {
  if (!req.userId) {
    const error = new Error("Unauthorized");
    error.name = "UnauthorizedError";
    throw error;
  }

  return req.userId;
}

function getStringBodyValue(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) {
    const error = new Error(`Missing or invalid ${name}`);
    error.name = "BadRequestError";
    throw error;
  }

  return value.trim();
}

export async function createLiveTokenController(
  req: AuthRequest,
  res: Response
) {
  const userId = getRequiredUserId(req);
  const campaignId = getStringBodyValue(req.body?.campaignId, "campaignId");
  const contactName =
    typeof req.body?.contactName === "string" ? req.body.contactName : "";

  const campaign = await getCampaignById(userId, campaignId);
  const agent = await getAgentById(userId, campaign.agentId);

  const systemInstruction = `
You are an AI voice calling agent inside a campaign simulator.

Agent name: ${agent.name}
Persona: ${agent.persona}
Company context: ${agent.companyContext}
Agent call objective: ${agent.callObjective}
Campaign objective: ${campaign.objective}
Customer name: ${contactName || "Unknown customer"}

Rules:
- Speak naturally like a human caller.
- Keep replies short, usually 1-2 sentences.
- Ask one question at a time.
- If the customer interrupts, stop your previous direction and respond to the interruption.
- Do not sound robotic.
- Do not mention that you are Gemini or an AI model unless directly asked.
- Focus on qualifying the lead and collecting useful campaign information.
- When the conversation is naturally complete, say a clear short closing line such as: "Thanks for your time. Have a great day. Goodbye."
- If the customer says they are not interested, busy, or wants to end the call, acknowledge politely and close the call naturally.
`.trim();

  const result = await createGeminiLiveToken({
    systemInstruction,
  });

  return res.json(result);
}
