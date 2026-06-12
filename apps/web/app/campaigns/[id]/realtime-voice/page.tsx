"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type Contact = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  company?: string | null;
};

type Campaign = {
  id: string;
  name: string;
  objective: string;
  agentId: string;
  contactIds: string[];
};

type Agent = {
  id: string;
  name: string;
  openingMessage: string;
  voiceStyle: string;
  voiceName?: string;
};

type SavedCall = {
  id: string;
  campaignId: string;
  contactId: string;
  agentId: string;
  transcript: string | null;
  status: string;
  outcome?: {
    summary: string;
    sentiment: string;
    leadStatus: string;
    nextAction: string;
    confidence: number;
  } | null;
};

type LiveTokenResponse = {
  token: string;
  model: string;
  expiresInSeconds: number;
  newSessionExpiresInSeconds: number;
};

type GeminiServerMessage = {
  setupComplete?: unknown;
  serverContent?: {
    interrupted?: boolean;
    turnComplete?: boolean;
    inputTranscription?: {
      text?: string;
    };
    outputTranscription?: {
      text?: string;
    };
    modelTurn?: {
      parts?: Array<{
        inlineData?: {
          data?: string;
          mimeType?: string;
        };
      }>;
    };
  };
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const LIVE_WS_URL =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained";

function getToken() {
  if (typeof window === "undefined") return null;

  return (
    localStorage.getItem("vc_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("accessToken")
  );
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    let message = "Request failed";

    try {
      const data = await response.json();
      message = data.message || data.error || message;
    } catch {
      // ignore
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

function base64ToInt16Array(base64: string) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Int16Array(bytes.buffer);
}

function int16ArrayToBase64(samples: Int16Array) {
  const bytes = new Uint8Array(samples.buffer);
  let binary = "";

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return window.btoa(binary);
}

function downsampleTo16Khz(input: Float32Array, sourceRate: number) {
  const targetRate = 16000;

  if (sourceRate === targetRate) {
    return floatToPcm16(input);
  }

  const ratio = sourceRate / targetRate;
  const outputLength = Math.floor(input.length / ratio);
  const output = new Float32Array(outputLength);

  for (let index = 0; index < outputLength; index += 1) {
    output[index] = input[Math.floor(index * ratio)] || 0;
  }

  return floatToPcm16(output);
}

function floatToPcm16(input: Float32Array) {
  const output = new Int16Array(input.length);

  for (let index = 0; index < input.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, input[index]));
    output[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  return output;
}

function getSampleRateFromMimeType(mimeType?: string) {
  const match = mimeType?.match(/rate=(\d+)/);
  return match ? Number(match[1]) : 24000;
}

export default function RealtimeVoicePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const campaignId = params.id;
  const existingCallId = searchParams.get("callId");
  const queryContactId = searchParams.get("contactId");

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [loading, setLoading] = useState(true);
  const [liveStatus, setLiveStatus] = useState("Idle");
  const [isLive, setIsLive] = useState(false);
  const [error, setError] = useState("");
  const [transcriptLines, setTranscriptLines] = useState<string[]>([]);
  const [savedCall, setSavedCall] = useState<SavedCall | null>(null);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const playbackContextRef = useRef<AudioContext | null>(null);
  const playbackTimeRef = useRef(0);
  const playbackSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const lastLocalBargeInAtRef = useRef(0);
  const speakingWhileAgentFramesRef = useRef(0);
  const noiseFloorRef = useRef(0.012);
  const micCalibrationUntilRef = useRef(0);
  const lastAgentAudioAtRef = useRef(0);
  const autoEndTimerRef = useRef<number | null>(null);
  const closeStatusOverrideRef = useRef<string | null>(null);
  const callEndingDetectedRef = useRef(false);
  const customerEndingDetectedRef = useRef(false);
  const transcriptRef = useRef<string[]>([]);
  const lastInputTranscriptRef = useRef("");
  const lastOutputTranscriptRef = useRef("");
  const activeCustomerLineIndexRef = useRef<number | null>(null);
  const activeAgentLineIndexRef = useRef<number | null>(null);

  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.id === selectedContactId) || null,
    [contacts, selectedContactId]
  );

  const fullTranscript =
    (transcriptLines.length > 0 ? transcriptLines : transcriptRef.current).join(
      "\n"
    );

  function mergeTranscriptText(existing: string, incoming: string) {
    const cleanExisting = existing.replace(/\s+/g, " ").trim();
    const cleanIncoming = incoming.replace(/\s+/g, " ").trim();

    if (!cleanExisting) return cleanIncoming;
    if (!cleanIncoming) return cleanExisting;

    if (cleanIncoming.startsWith(cleanExisting)) {
      return cleanIncoming;
    }

    if (cleanExisting.includes(cleanIncoming)) {
      return cleanExisting;
    }

    for (
      let overlapLength = Math.min(cleanExisting.length, cleanIncoming.length);
      overlapLength > 0;
      overlapLength -= 1
    ) {
      if (
        cleanExisting.endsWith(cleanIncoming.slice(0, overlapLength))
      ) {
        return `${cleanExisting}${cleanIncoming.slice(overlapLength)}`.replace(
          /\s+/g,
          " "
        ).trim();
      }
    }

    return `${cleanExisting} ${cleanIncoming}`.replace(/\s+/g, " ").trim();
  }

  function upsertTranscriptLine(speaker: "Customer" | "Agent", text: string) {
    const cleanText = text.replace(/\s+/g, " ").trim();

    if (!cleanText) {
      return;
    }

    const prefix = `${speaker}: `;
    const activeIndexRef =
      speaker === "Customer" ? activeCustomerLineIndexRef : activeAgentLineIndexRef;

    setTranscriptLines((prev) => {
      const next = [...prev];
      const activeIndex = activeIndexRef.current;

      if (
        activeIndex !== null &&
        activeIndex >= 0 &&
        activeIndex < next.length &&
        next[activeIndex].startsWith(prefix)
      ) {
        const existingText = next[activeIndex].slice(prefix.length);
        next[activeIndex] = `${prefix}${mergeTranscriptText(
          existingText,
          cleanText
        )}`;
      } else {
        activeIndexRef.current = next.length;
        next.push(`${prefix}${cleanText}`);
      }

      transcriptRef.current = next;
      return next;
    });
  }

  function resetActiveTranscriptLines() {
    activeCustomerLineIndexRef.current = null;
    activeAgentLineIndexRef.current = null;
    lastInputTranscriptRef.current = "";
    lastOutputTranscriptRef.current = "";
  }

  useEffect(() => {
    transcriptRef.current = transcriptLines;
  }, [transcriptLines]);

  useEffect(() => {
    const token = getToken();

    if (!token) {
      router.push(`/login?next=/campaigns/${campaignId}/realtime-voice`);
      return;
    }

    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const campaignResponse = await apiRequest<{ campaign: Campaign }>(
          `/api/campaigns/${campaignId}`
        );

        const loadedCampaign = campaignResponse.campaign;
        setCampaign(loadedCampaign);

        const [agentResponse, contactsResponse] = await Promise.all([
          apiRequest<{ agent: Agent }>(`/api/agents/${loadedCampaign.agentId}`),
          apiRequest<{ contacts: Contact[] }>("/api/contacts"),
        ]);

        setAgent(agentResponse.agent);

        const campaignContacts = contactsResponse.contacts.filter((contact) =>
          loadedCampaign.contactIds.includes(contact.id)
        );

        setContacts(campaignContacts);

        if (campaignContacts.length > 0) {
          const matchingContact = queryContactId
            ? campaignContacts.find((contact) => contact.id === queryContactId)
            : null;

          setSelectedContactId(matchingContact?.id || campaignContacts[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load realtime voice page");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [campaignId, queryContactId, router]);

  useEffect(() => {
    return () => {
      stopRealtimeCall();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearAutoEndTimer() {
    if (autoEndTimerRef.current !== null) {
      window.clearTimeout(autoEndTimerRef.current);
      autoEndTimerRef.current = null;
    }
  }

  function getLatestTranscriptLine(speaker: "Customer" | "Agent") {
    const prefix = `${speaker}: `;

    for (let index = transcriptRef.current.length - 1; index >= 0; index -= 1) {
      const line = transcriptRef.current[index];

      if (line.startsWith(prefix)) {
        return line.slice(prefix.length).trim();
      }
    }

    return "";
  }

  function normalizeTranscriptText(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  }

  function looksLikeCustomerEnding(text: string) {
    const normalized = normalizeTranscriptText(text);

    const shortGoodbyes = [
      "bye",
      "goodbye",
      "ok bye",
      "okay bye",
      "thanks bye",
      "thank you bye",
      "no thanks",
      "not interested",
      "i am not interested",
      "call me later",
      "i am busy",
    ];

    return shortGoodbyes.some((phrase) => normalized.includes(phrase));
  }

  function looksLikeAgentClosing(text: string) {
    const normalized = normalizeTranscriptText(text);

    const closingPhrases = [
      "goodbye",
      "bye",
      "have a great day",
      "have a good day",
      "thanks for your time",
      "thank you for your time",
      "we will follow up",
      "someone from our team will follow up",
      "talk to you soon",
      "take care",
    ];

    return closingPhrases.some((phrase) => normalized.includes(phrase));
  }

  function getRemainingPlaybackMs() {
    const audioContext = playbackContextRef.current;

    if (!audioContext) {
      return 1800;
    }

    const remainingSeconds = Math.max(
      0,
      playbackTimeRef.current - audioContext.currentTime
    );

    return Math.max(1800, remainingSeconds * 1000 + 900);
  }

  function scheduleAutoEndCall(reason: string, minimumDelayMs = 2500) {
    if (!wsRef.current) {
      return;
    }

    clearAutoEndTimer();

    const waitMs = Math.max(minimumDelayMs, getRemainingPlaybackMs());
    callEndingDetectedRef.current = true;

    setLiveStatus("Call ending detected. Finishing final audio...");

    autoEndTimerRef.current = window.setTimeout(() => {
      closeStatusOverrideRef.current = reason;
      stopRealtimeCall(reason);
    }, waitMs);
  }

  async function websocketDataToText(data: string | Blob | ArrayBuffer) {
    if (typeof data === "string") {
      return data;
    }

    if (data instanceof Blob) {
      return data.text();
    }

    return new TextDecoder().decode(data);
  }

  function getAudioFeatures(input: Float32Array) {
    let sum = 0;
    let peak = 0;
    let zeroCrossings = 0;
    let previous = input[0] || 0;

    for (let index = 0; index < input.length; index += 1) {
      const sample = input[index];
      const absoluteSample = Math.abs(sample);

      sum += sample * sample;
      peak = Math.max(peak, absoluteSample);

      if (
        index > 0 &&
        ((sample >= 0 && previous < 0) || (sample < 0 && previous >= 0))
      ) {
        zeroCrossings += 1;
      }

      previous = sample;
    }

    return {
      rms: Math.sqrt(sum / input.length),
      peak,
      zeroCrossingRate: zeroCrossings / input.length,
    };
  }

  function updateNoiseFloor(rms: number) {
    // Smooth background noise estimate. We only update this during non-agent
    // periods or initial calibration so real speech does not raise it too much.
    noiseFloorRef.current = noiseFloorRef.current * 0.95 + rms * 0.05;
  }

  function isAgentAudioQueuedOrPlaying() {
    const audioContext = playbackContextRef.current;

    if (!audioContext) {
      return false;
    }

    // Only treat it as interruptible if there is still meaningful audio queued.
    return playbackTimeRef.current > audioContext.currentTime + 0.25;
  }

  function stopPlayback() {
    for (const source of playbackSourcesRef.current) {
      try {
        source.stop();
      } catch {
        // Source may already be stopped.
      }
    }

    playbackSourcesRef.current = [];

    void playbackContextRef.current?.close();
    playbackContextRef.current = null;
    playbackTimeRef.current = 0;
  }

  function handleLocalBargeInFromMic(input: Float32Array) {
    const { rms, peak, zeroCrossingRate } = getAudioFeatures(input);
    const now = Date.now();

    if (now < micCalibrationUntilRef.current) {
      updateNoiseFloor(rms);
      return;
    }

    if (!isAgentAudioQueuedOrPlaying()) {
      const quietEnoughForNoiseUpdate =
        rms < Math.max(0.045, noiseFloorRef.current * 3);

      if (quietEnoughForNoiseUpdate) {
        updateNoiseFloor(rms);
      }

      speakingWhileAgentFramesRef.current = 0;
      return;
    }

    // Ignore tiny noises right when model audio starts playing.
    if (now - lastAgentAudioAtRef.current < 400) {
      speakingWhileAgentFramesRef.current = 0;
      return;
    }

    const noiseFloor = noiseFloorRef.current;

    // More strict than before:
    // - must be clearly louder than room noise
    // - must have a strong enough peak
    // - must look somewhat voice-like by zero-crossing rate
    const rmsThreshold = Math.max(0.055, noiseFloor * 5.5);
    const peakThreshold = Math.max(0.13, rmsThreshold * 2.1);
    const voiceLike =
      zeroCrossingRate > 0.015 && zeroCrossingRate < 0.22;
    const loudEnough = rms > rmsThreshold && peak > peakThreshold;

    if (loudEnough && voiceLike) {
      speakingWhileAgentFramesRef.current += 1;
    } else {
      speakingWhileAgentFramesRef.current = Math.max(
        0,
        speakingWhileAgentFramesRef.current - 1
      );
    }

    const recentlyInterrupted = now - lastLocalBargeInAtRef.current < 1200;

    // 6 frames at 1024 buffer is roughly 120-150ms on common browser sample rates.
    // This avoids interrupting on clicks, fan bursts, keyboard taps, etc.
    if (speakingWhileAgentFramesRef.current >= 6 && !recentlyInterrupted) {
      lastLocalBargeInAtRef.current = now;
      speakingWhileAgentFramesRef.current = 0;
      stopPlayback();
      setLiveStatus("You interrupted. Listening...");
    }
  }

  function playPcmAudio(base64: string, mimeType?: string) {
    const sampleRate = getSampleRateFromMimeType(mimeType);
    const samples = base64ToInt16Array(base64);

    const AudioContextConstructor = window.AudioContext;
    const audioContext =
      playbackContextRef.current || new AudioContextConstructor();

    playbackContextRef.current = audioContext;

    const audioBuffer = audioContext.createBuffer(
      1,
      samples.length,
      sampleRate
    );

    const channelData = audioBuffer.getChannelData(0);

    for (let index = 0; index < samples.length; index += 1) {
      channelData[index] = samples[index] / 32768;
    }

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);

    lastAgentAudioAtRef.current = Date.now();
    playbackSourcesRef.current.push(source);
    source.onended = () => {
      playbackSourcesRef.current = playbackSourcesRef.current.filter(
        (item) => item !== source
      );
    };

    const startAt = Math.max(audioContext.currentTime, playbackTimeRef.current);
    source.start(startAt);
    playbackTimeRef.current = startAt + audioBuffer.duration;
  }

  async function beginRealtimeAudioAfterSetup() {
    const websocket = wsRef.current;

    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      setLiveStatus("Setup complete. Starting microphone...");
      await startMicrophoneStreaming(websocket);

      setLiveStatus("Calibrating background noise...");
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 850);
      });

      if (websocket.readyState === WebSocket.OPEN) {
        websocket.send(
          JSON.stringify({
            realtimeInput: {
              text:
                "Start the call now. Speak your opening message naturally.",
            },
          })
        );
      }

      setLiveStatus("Live call running. Speak naturally.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to start microphone streaming"
      );
      setLiveStatus("Microphone failed");
      stopRealtimeCall();
    }
  }

  function handleServerMessage(message: GeminiServerMessage) {
    if (message.setupComplete) {
      void beginRealtimeAudioAfterSetup();
      return;
    }

    const serverContent = message.serverContent;

    if (!serverContent) {
      return;
    }

    if (serverContent.interrupted) {
      stopPlayback();
      setLiveStatus("Interrupted. Listening...");
    }

    const inputText = serverContent.inputTranscription?.text?.trim();

    if (inputText && inputText !== lastInputTranscriptRef.current) {
      lastInputTranscriptRef.current = inputText;
      upsertTranscriptLine("Customer", inputText);

      if (looksLikeCustomerEnding(inputText)) {
        customerEndingDetectedRef.current = true;
        setLiveStatus("Customer ending detected. Waiting for final agent reply...");
        scheduleAutoEndCall("Customer ended the call. Auto-stopped.", 8500);
      }
    }

    const outputText = serverContent.outputTranscription?.text?.trim();

    if (outputText && outputText !== lastOutputTranscriptRef.current) {
      lastOutputTranscriptRef.current = outputText;
      upsertTranscriptLine("Agent", outputText);
    }

    const parts = serverContent.modelTurn?.parts ?? [];

    for (const part of parts) {
      const audioData = part.inlineData?.data;

      if (audioData) {
        playPcmAudio(audioData, part.inlineData?.mimeType);
      }
    }

    if (serverContent.turnComplete) {
      const latestAgentLine = getLatestTranscriptLine("Agent");

      if (latestAgentLine && looksLikeAgentClosing(latestAgentLine)) {
        scheduleAutoEndCall("Conversation ended. Auto-stopped.");
      } else if (!callEndingDetectedRef.current) {
        setLiveStatus("Listening...");
      }

      resetActiveTranscriptLines();
    }
  }

  async function startMicrophoneStreaming(websocket: WebSocket) {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(1024, 1, 1);

    noiseFloorRef.current = 0.012;
    micCalibrationUntilRef.current = Date.now() + 800;
    speakingWhileAgentFramesRef.current = 0;
    lastLocalBargeInAtRef.current = 0;

    processor.onaudioprocess = (event) => {
      if (websocket.readyState !== WebSocket.OPEN) {
        return;
      }

      const input = event.inputBuffer.getChannelData(0);
      const isCalibrating = Date.now() < micCalibrationUntilRef.current;

      handleLocalBargeInFromMic(input);

      if (isCalibrating) {
        return;
      }

      const pcm16 = downsampleTo16Khz(input, audioContext.sampleRate);
      const base64 = int16ArrayToBase64(pcm16);

      websocket.send(
        JSON.stringify({
          realtimeInput: {
            audio: {
              data: base64,
              mimeType: "audio/pcm;rate=16000",
            },
          },
        })
      );
    };

    source.connect(processor);
    processor.connect(audioContext.destination);

    micStreamRef.current = stream;
    micContextRef.current = audioContext;
    processorRef.current = processor;
    sourceRef.current = source;
  }

  function stopMicrophoneStreaming() {
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();

    micStreamRef.current?.getTracks().forEach((track) => track.stop());

    void micContextRef.current?.close();

    processorRef.current = null;
    sourceRef.current = null;
    micStreamRef.current = null;
    micContextRef.current = null;
  }

  async function startRealtimeCall() {
    if (!campaign || !agent || !selectedContact) {
      setError("Campaign, agent, or contact is not loaded yet.");
      return;
    }

    setError("");
    setSavedCall(null);
    setTranscriptLines([]);
    transcriptRef.current = [];
    resetActiveTranscriptLines();
    clearAutoEndTimer();
    closeStatusOverrideRef.current = null;
    callEndingDetectedRef.current = false;
    customerEndingDetectedRef.current = false;
    lastLocalBargeInAtRef.current = 0;
    speakingWhileAgentFramesRef.current = 0;
    noiseFloorRef.current = 0.012;
    micCalibrationUntilRef.current = 0;
    lastAgentAudioAtRef.current = 0;
    stopPlayback();

    try {
      setLiveStatus("Creating secure Live API token...");

      const tokenResponse = await apiRequest<LiveTokenResponse>(
        "/api/ai/live-token",
        {
          method: "POST",
          body: JSON.stringify({
            campaignId,
            contactName: selectedContact.name,
          }),
        }
      );

      setLiveStatus("Connecting to Gemini Live...");

      const websocket = new WebSocket(
        `${LIVE_WS_URL}?access_token=${encodeURIComponent(tokenResponse.token)}`
      );

      wsRef.current = websocket;

      websocket.onopen = () => {
        setIsLive(true);
        setLiveStatus("Connected. Sending setup...");

        websocket.send(
          JSON.stringify({
            setup: {
              model: `models/${tokenResponse.model}`,
            },
          })
        );

        setLiveStatus("Waiting for Gemini setup...");
      };

      websocket.onmessage = async (event) => {
        try {
          const rawMessage = await websocketDataToText(event.data);
          const message = JSON.parse(rawMessage) as GeminiServerMessage;
          handleServerMessage(message);
        } catch (err) {
          console.error("Failed to parse Gemini Live message", err, event.data);
          setLiveStatus("Received unreadable Gemini message. Check console.");
        }
      };

      websocket.onerror = () => {
        setError("Gemini Live WebSocket error.");
        setLiveStatus("Connection error");
      };

      websocket.onclose = (event) => {
        const statusOverride = closeStatusOverrideRef.current;
        closeStatusOverrideRef.current = null;

        setIsLive(false);
        setTranscriptLines((prev) => {
          if (prev.length > 0) {
            return prev;
          }

          return transcriptRef.current;
        });
        setLiveStatus(
          statusOverride ||
            `Call ended. Code: ${event.code}${
              event.reason ? `, reason: ${event.reason}` : ""
            }`
        );
        stopMicrophoneStreaming();
      };
    } catch (err) {
      setIsLive(false);
      setLiveStatus("Failed to start");
      setError(err instanceof Error ? err.message : "Failed to start realtime call");
      stopMicrophoneStreaming();
      stopPlayback();
    }
  }

  function stopRealtimeCall(status = "Call ended") {
    clearAutoEndTimer();

    if (status !== "Call ended") {
      closeStatusOverrideRef.current = status;
    }

    wsRef.current?.close();
    wsRef.current = null;

    stopMicrophoneStreaming();
    stopPlayback();

    setIsLive(false);
    setLiveStatus(status);
  }

  async function saveCall() {
    if (!selectedContactId) {
      setError("Select a contact first.");
      return;
    }

    if (fullTranscript.trim().length < 20) {
      setError("Transcript is too short.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = existingCallId
        ? await apiRequest<{ call: SavedCall }>(`/api/calls/${existingCallId}`, {
            method: "PATCH",
            body: JSON.stringify({
              transcript: fullTranscript,
            }),
          })
        : await apiRequest<{ call: SavedCall }>("/api/calls", {
            method: "POST",
            body: JSON.stringify({
              campaignId,
              contactId: selectedContactId,
              transcript: fullTranscript,
            }),
          });

      setSavedCall(response.call);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save call");
    } finally {
      setSaving(false);
    }
  }

  async function extractOutcome() {
    if (!savedCall) {
      setError("Save the call before extracting outcome.");
      return;
    }

    setExtracting(true);
    setError("");

    try {
      const response = await apiRequest<{ call: SavedCall }>(
        `/api/calls/${savedCall.id}/extract-outcome`,
        {
          method: "POST",
        }
      );

      setSavedCall(response.call);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to extract outcome");
    } finally {
      setExtracting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-8">
        <div className="mx-auto max-w-6xl text-slate-600">
          Loading realtime voice...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6">
          <Link
            href={`/campaigns/${campaignId}`}
            className="text-sm font-medium text-violet-600 hover:text-violet-700"
          >
            ← Back to campaign
          </Link>

          <h1 className="mt-3 text-3xl font-bold text-slate-950">
            Realtime Gemini Live Voice
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Streams microphone audio to Gemini Live and plays the spoken response
            back in real time.
          </p>
        </div>

        {error ? (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <section className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">Campaign</h2>
              <p className="mt-3 text-sm text-slate-600">{campaign?.name}</p>
              <p className="mt-2 text-xs text-slate-500">
                {campaign?.objective}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">Agent</h2>
              <p className="mt-3 text-sm text-slate-600">{agent?.name}</p>
              <p className="mt-2 text-xs text-slate-500">
                Voice style: {agent?.voiceStyle}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Gemini Live voice: {agent?.voiceName || "Kore"}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">Contact</h2>

              <select
                value={selectedContactId}
                onChange={(event) => setSelectedContactId(event.target.value)}
                disabled={isLive}
                className="mt-4 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-500 disabled:bg-slate-100"
              >
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.name} — {contact.phone}
                  </option>
                ))}
              </select>

              {selectedContact ? (
                <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                  <p className="font-medium text-slate-800">
                    {selectedContact.name}
                  </p>
                  <p>{selectedContact.phone}</p>
                  <p>{selectedContact.company || "No company"}</p>
                </div>
              ) : null}
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">
                    Live Call
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Status: {liveStatus}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {!isLive ? (
                    <button
                      onClick={startRealtimeCall}
                      className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
                    >
                      Start Realtime Call
                    </button>
                  ) : (
                    <button
                      onClick={() => stopRealtimeCall()}
                      className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                    >
                      Stop Call
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setTranscriptLines([]);
                      transcriptRef.current = [];
                      resetActiveTranscriptLines();
                      clearAutoEndTimer();
                      closeStatusOverrideRef.current = null;
                      callEndingDetectedRef.current = false;
                      customerEndingDetectedRef.current = false;
                      setSavedCall(null);
                    }}
                    disabled={isLive}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="mt-5 min-h-[340px] rounded-xl border border-slate-200 bg-slate-950 p-4 font-mono text-sm text-slate-100">
                {transcriptLines.length === 0 ? (
                  <p className="text-slate-400">
                    No transcript yet. Click Start Realtime Call and speak
                    naturally.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {transcriptLines.map((line, index) => (
                      <p
                        key={`${line}-${index}`}
                        className={
                          line.startsWith("Agent:")
                            ? "text-violet-200"
                            : "text-emerald-200"
                        }
                      >
                        {line}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">
                Save & Extract
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Save the realtime transcript into the prepared call, then run
                the same Gemini outcome extractor.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={saveCall}
                  disabled={saving || isLive}
                  className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Transcript"}
                </button>

                <button
                  onClick={extractOutcome}
                  disabled={!savedCall || extracting || isLive}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {extracting ? "Extracting..." : "Extract Outcome"}
                </button>
              </div>

              {savedCall?.outcome ? (
                <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <p className="font-semibold text-slate-900">Outcome</p>
                  <p className="mt-2 text-slate-600">
                    {savedCall.outcome.summary}
                  </p>
                  <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                    <div>
                      <span className="text-slate-400">Lead:</span>{" "}
                      {savedCall.outcome.leadStatus}
                    </div>
                    <div>
                      <span className="text-slate-400">Sentiment:</span>{" "}
                      {savedCall.outcome.sentiment}
                    </div>
                    <div>
                      <span className="text-slate-400">Confidence:</span>{" "}
                      {(savedCall.outcome.confidence * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
