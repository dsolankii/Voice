import { GoogleGenAI } from "@google/genai";
import { env } from "../../config/env.js";
import { getAgentById } from "../agents/agent.service.js";
import type { CallOutcome, ExtractOutcomeInput } from "./extraction.schemas.js";
import { callOutcomeSchema } from "./extraction.schemas.js";

type SafeAgent = Awaited<ReturnType<typeof getAgentById>>;

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function extractCallbackTime(transcript: string): string | null {
  const lower = transcript.toLowerCase();

  if (lower.includes("tomorrow")) return "tomorrow";
  if (lower.includes("evening")) return "evening";
  if (lower.includes("morning")) return "morning";
  if (lower.includes("next week")) return "next week";
  if (lower.includes("later")) return "later";

  return null;
}

function mockExtractCallOutcome(agent: SafeAgent, transcript: string): CallOutcome {
  const lower = transcript.toLowerCase();
  const callbackTime = extractCallbackTime(transcript);

  let sentiment: CallOutcome["sentiment"] = "neutral";
  let leadStatus: CallOutcome["leadStatus"] = "unknown";
  let intent = "unknown";
  let nextAction = "Review the call manually.";
  const objections: string[] = [];

  if (
    includesAny(lower, [
      "interested",
      "yes",
      "send me",
      "looking for",
      "budget",
      "want to buy",
    ])
  ) {
    sentiment = "positive";
    leadStatus = "interested";
    intent = "purchase_interest";
    nextAction = "Follow up with relevant options and confirm requirements.";
  }

  if (
    includesAny(lower, [
      "call me tomorrow",
      "call later",
      "call back",
      "callback",
      "not now",
      "busy",
    ])
  ) {
    leadStatus = "callback_requested";
    nextAction = "Schedule a callback with the lead.";
  }

  if (
    includesAny(lower, [
      "not interested",
      "don't call",
      "do not call",
      "no need",
      "stop calling",
    ])
  ) {
    sentiment = "negative";
    leadStatus = "not_interested";
    intent = "not_interested";
    nextAction = "Mark the lead as not interested and avoid follow-up.";
  }

  if (
    includesAny(lower, [
      "wrong number",
      "who is this",
      "you have the wrong",
    ])
  ) {
    sentiment = "negative";
    leadStatus = "wrong_number";
    intent = "wrong_number";
    nextAction = "Mark the contact as wrong number.";
  }

  if (includesAny(lower, ["too expensive", "high price", "costly", "budget issue"])) {
    objections.push("Pricing or budget concern");
  }

  if (includesAny(lower, ["need time", "think about", "discuss with family"])) {
    objections.push("Needs more time to decide");
  }

  if (includesAny(lower, ["location", "area", "near"])) {
    intent = intent === "unknown" ? "location_inquiry" : intent;
  }

  const outcome: CallOutcome = {
    summary: `Mock extraction for agent "${agent.name}": the call was analyzed and classified as ${leadStatus}.`,
    sentiment,
    intent,
    leadStatus,
    callbackTime,
    objections,
    nextAction,
    confidence: 0.72,
  };

  return callOutcomeSchema.parse(outcome);
}

function buildGeminiPrompt(agent: SafeAgent, transcript: string) {
  return `
You are an AI call outcome extraction engine.

Analyze the call transcript using the agent configuration and return ONLY valid JSON.
Do not wrap JSON in markdown.
Do not include explanations outside JSON.

Return this exact JSON shape:
{
  "summary": "short summary",
  "sentiment": "positive | neutral | negative | mixed",
  "intent": "main customer intent",
  "leadStatus": "interested | not_interested | callback_requested | wrong_number | no_answer | needs_more_info | unknown",
  "callbackTime": "callback time or null",
  "objections": ["objection 1"],
  "nextAction": "recommended next action",
  "confidence": 0.0
}

Rules:
- Do not invent facts.
- callbackTime must be null if no callback time was mentioned.
- confidence must be between 0 and 1.
- objections must be an empty array if no objection was mentioned.
- Choose the most accurate leadStatus.

Agent configuration:
Name: ${agent.name}
Persona: ${agent.persona}
Company context: ${agent.companyContext}
Call objective: ${agent.callObjective}
Opening message: ${agent.openingMessage}
Language: ${agent.language}
Voice style: ${agent.voiceStyle}

Transcript:
${transcript}
`;
}

function extractJson(text: string) {
  const cleaned = text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  return JSON.parse(cleaned);
}

async function geminiExtractCallOutcome(
  agent: SafeAgent,
  transcript: string
): Promise<CallOutcome> {
  if (!env.aiApiKey) {
    const error = new Error("AI_API_KEY is required when AI_PROVIDER=gemini");
    error.name = "BadRequestError";
    throw error;
  }

  const ai = new GoogleGenAI({
    apiKey: env.aiApiKey,
  });

  const response = await ai.models.generateContent({
    model: env.aiModel,
    contents: buildGeminiPrompt(agent, transcript),
  });

  if (!response.text) {
    const error = new Error("Gemini returned an empty response");
    error.name = "BadRequestError";
    throw error;
  }

  const parsed = extractJson(response.text);

  return callOutcomeSchema.parse(parsed);
}

export async function extractCallOutcome(
  userId: string,
  input: ExtractOutcomeInput
): Promise<CallOutcome> {
  const agent = await getAgentById(userId, input.agentId);

  if (env.aiProvider === "gemini") {
    return geminiExtractCallOutcome(agent, input.transcript);
  }

  return mockExtractCallOutcome(agent, input.transcript);
}
