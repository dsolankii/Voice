import { GoogleGenAI } from "@google/genai";
import { env } from "../../config/env.js";

type CreateLiveTokenOptions = {
  systemInstruction: string;
  voiceName?: string;
};

export async function createGeminiLiveToken({
  systemInstruction,
  voiceName,
}: CreateLiveTokenOptions) {
  if (!env.aiApiKey) {
    const error = new Error("AI_API_KEY is required for Gemini Live API");
    error.name = "BadRequestError";
    throw error;
  }

  const client = new GoogleGenAI({
    apiKey: env.aiApiKey,
  });

  const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const newSessionExpireTime = new Date(Date.now() + 60 * 1000).toISOString();

  const token = await client.authTokens.create({
    config: {
      uses: 1,
      expireTime,
      newSessionExpireTime,
      liveConnectConstraints: {
        model: env.aiLiveModel,
        config: {
          responseModalities: ["AUDIO"],
          temperature: 0.7,
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voiceName || "Kore",
              },
            },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: {
            parts: [
              {
                text: systemInstruction,
              },
            ],
          },
        },
      },
      httpOptions: {
        apiVersion: "v1alpha",
      },
    },
  } as Parameters<typeof client.authTokens.create>[0]);

  if (!token.name) {
    const error = new Error("Failed to create Gemini Live token");
    error.name = "BadRequestError";
    throw error;
  }

  return {
    token: token.name,
    model: env.aiLiveModel,
    expiresInSeconds: 30 * 60,
    newSessionExpiresInSeconds: 60,
  };
}
