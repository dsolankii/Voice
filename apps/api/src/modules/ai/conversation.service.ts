import { GoogleGenAI } from "@google/genai";
import { env } from "../../config/env.js";
import { getAgentById } from "../agents/agent.service.js";
import type { GenerateAgentReplyInput } from "./conversation.schemas.js";

function getMockReply(input: GenerateAgentReplyInput) {
  const lowerTranscript = input.transcript.toLowerCase();

  if (lowerTranscript.includes("busy") || lowerTranscript.includes("tomorrow")) {
    return {
      reply:
        "No problem. I will note that and arrange a callback for tomorrow. Before I let you go, is there any specific location or budget range you prefer?",
    };
  }

  if (lowerTranscript.includes("budget")) {
    return {
      reply:
        "Thank you for sharing your budget. I will match your requirement with suitable options and arrange a follow-up with more details.",
    };
  }

  return {
    reply:
      "Thank you for sharing that. I will note your requirement and our team will follow up with suitable options.",
  };
}

function extractTextFromGeminiResponse(response: unknown) {
  const maybeResponse = response as {
    text?: string;
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
        }>;
      };
    }>;
  };

  if (typeof maybeResponse.text === "string") {
    return maybeResponse.text.trim();
  }

  const firstText =
    maybeResponse.candidates?.[0]?.content?.parts?.[0]?.text;

  if (typeof firstText === "string") {
    return firstText.trim();
  }

  return "";
}

export async function generateAgentReply(
  userId: string,
  input: GenerateAgentReplyInput
) {
  const agent = await getAgentById(userId, input.agentId);

  if (env.aiProvider !== "gemini") {
    return getMockReply(input);
  }

  if (!env.aiApiKey) {
    const error = new Error("AI_API_KEY is required when AI_PROVIDER=gemini");
    error.name = "BadRequestError";
    throw error;
  }

  const ai = new GoogleGenAI({
    apiKey: env.aiApiKey,
  });

  const prompt = `
You are generating the next spoken reply for an AI voice calling agent.

Agent configuration:
Name: ${agent.name}
Persona: ${agent.persona}
Company context: ${agent.companyContext}
Call objective: ${agent.callObjective}
Opening message: ${agent.openingMessage}
Language: ${agent.language}
Voice style: ${agent.voiceStyle}

Campaign objective:
${input.campaignObjective || "Not provided"}

Contact name:
${input.contactName || "Not provided"}

Conversation transcript so far:
${input.transcript}

Task:
Write ONLY the next agent reply.
Do not include JSON.
Do not include labels like "Agent:".
Keep it natural, short, and suitable for speaking aloud.
Maximum 2 sentences.
The reply should move the call toward the objective without sounding pushy.
`;

  const response = await ai.models.generateContent({
    model: env.aiModel,
    contents: prompt,
  });

  const reply = extractTextFromGeminiResponse(response);

  if (!reply) {
    const error = new Error("Gemini did not return a reply");
    error.name = "BadRequestError";
    throw error;
  }

  return {
    reply,
  };
}
