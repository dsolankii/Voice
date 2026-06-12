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

  const openingMessage = agent.openingMessage.trim();
  const closingMessage =
    agent.closingMessage?.trim() ||
    "Thanks for your time. Have a great day. Goodbye.";
  const conversationGuidelines =
    agent.conversationGuidelines?.trim() ||
    "Ask one question at a time, handle objections politely, and close naturally.";

  const systemInstruction = `
You are an AI voice calling agent inside a campaign simulator.

Agent name: ${agent.name}
Persona: ${agent.persona}
Company context: ${agent.companyContext || "No extra company context provided."}
Agent call objective: ${agent.callObjective}
Campaign objective: ${campaign.objective}
Customer name: ${contactName || "Unknown customer"}

Opening message:
${openingMessage}

Closing message:
${closingMessage}

Conversation guidelines for behavior only. Do not read these aloud:
${conversationGuidelines}

Rules:
- At the start, say only a short natural opening based on the opening message.
- After the opening message, stop speaking and wait for the customer.
- Do not read the company context or conversation guidelines aloud.
- Do not monologue.
- Keep most replies short, usually 1 sentence.
- Ask only 1 question at a time.
- After asking a question, stop and wait.
- If the customer interrupts, stop the old direction and respond to the interruption.
- Sound warm, confident, energetic, and human.
- Do not mention that you are Gemini or an AI model unless directly asked.
- When the conversation is complete, use the closing message and end naturally.
`.trim();

  const result = await createGeminiLiveToken({
    systemInstruction,
  });

  return res.json(result);
}
