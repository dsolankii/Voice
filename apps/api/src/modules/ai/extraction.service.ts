import { getAgentById } from "../agents/agent.service.js";
import type { CallOutcome, ExtractOutcomeInput } from "./extraction.schemas.js";
import { callOutcomeSchema } from "./extraction.schemas.js";

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

export async function extractCallOutcome(
  userId: string,
  input: ExtractOutcomeInput
): Promise<CallOutcome> {
  const agent = await getAgentById(userId, input.agentId);
  const transcript = input.transcript;
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
