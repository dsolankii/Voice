"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";

type Contact = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  company?: string | null;
  notes?: string | null;
};

type Campaign = {
  id: string;
  name: string;
  objective: string;
  agentId: string;
  contactIds: string[];
  contactCount: number;
  status: string;
};

type Agent = {
  id: string;
  name: string;
  persona: string;
  companyContext: string;
  callObjective: string;
  openingMessage: string;
  language: string;
  voiceStyle: string;
};

type CallOutcome = {
  summary: string;
  sentiment: string;
  intent: string;
  leadStatus: string;
  callbackTime?: string | null;
  objections: string[];
  nextAction: string;
  confidence: number;
};

type SavedCall = {
  id: string;
  campaignId: string;
  contactId: string;
  agentId: string;
  transcript: string | null;
  status: string;
  outcome: CallOutcome | null;
};

type SpeechRecognitionEventLike = Event & {
  resultIndex?: number;
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
      isFinal?: boolean;
    };
    length: number;
  };
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function getToken() {
  if (typeof window === "undefined") {
    return null;
  }

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
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
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
      // ignore json parse error
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

function getSpeechRecognition() {
  if (typeof window === "undefined") {
    return null;
  }

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    return null;
  }

  return new SpeechRecognition();
}

export default function VoiceSimulatorPage() {
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
  const [transcriptLines, setTranscriptLines] = useState<string[]>([]);
  const [manualText, setManualText] = useState("");
  const [recognition, setRecognition] = useState<SpeechRecognitionLike | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [savedCall, setSavedCall] = useState<SavedCall | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [generatingReply, setGeneratingReply] = useState(false);
  const [error, setError] = useState("");
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [bargeInStatus, setBargeInStatus] = useState("Idle");
  const [micLevel, setMicLevel] = useState(0);

  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.id === selectedContactId) || null,
    [contacts, selectedContactId]
  );

  const fullTranscript = transcriptLines.join("\n");

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptLinesRef = useRef<string[]>([]);
  const autoModeRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const generatingReplyRef = useRef(false);
  const customerBufferRef = useRef("");
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const bargeInConfirmedRef = useRef(false);
  const possibleSpeechStartedAtRef = useRef<number | null>(null);
  const lastBargeInAtRef = useRef(0);
  const noiseFloorRef = useRef(0.015);

  function appendTranscriptLine(line: string) {
    setTranscriptLines((prev) => {
      const next = [...prev, line];
      transcriptLinesRef.current = next;
      return next;
    });
  }

  useEffect(() => {
    transcriptLinesRef.current = transcriptLines;
  }, [transcriptLines]);

  useEffect(() => {
    autoModeRef.current = isAutoMode;
  }, [isAutoMode]);

  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }

      recognitionRef.current?.stop();
      stopBargeInMonitor();

      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    const token = getToken();

    if (!token) {
      router.push(`/login?next=/campaigns/${campaignId}/voice-simulator`);
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
        setError(err instanceof Error ? err.message : "Failed to load simulator");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [campaignId, queryContactId, router]);

  function stopSpeaking() {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    isSpeakingRef.current = false;
    setIsSpeaking(false);
  }

  function speak(text: string, afterSpeak?: () => void) {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setError("Text-to-speech is not supported in this browser.");
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => {
      isSpeakingRef.current = true;
      setIsSpeaking(true);

      // Best-effort barge-in: keep listening while AI speaks.
      if (autoModeRef.current) {
        setTimeout(() => {
          startAutoListening();
        }, 250);
      }
    };

    utterance.onend = () => {
      isSpeakingRef.current = false;
      setIsSpeaking(false);

      if (afterSpeak) {
        afterSpeak();
      }

      if (autoModeRef.current) {
        setTimeout(() => {
          startAutoListening();
        }, 300);
      }
    };

    utterance.onerror = () => {
      isSpeakingRef.current = false;
      setIsSpeaking(false);

      if (afterSpeak) {
        afterSpeak();
      }
    };

    window.speechSynthesis.speak(utterance);
  }

  function speakOpeningMessage(afterSpeak?: () => void) {
    if (!agent) {
      return;
    }

    const message = agent.openingMessage || "Hello, I am calling about your interest.";
    appendTranscriptLine(`Agent: ${message}`);
    speak(message, afterSpeak);
  }

  function getAudioContextConstructor() {
    if (typeof window === "undefined") {
      return null;
    }

    return (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext ||
      null
    );
  }

  function calculateRms(data: Uint8Array) {
    let sum = 0;

    for (const value of data) {
      const normalized = (value - 128) / 128;
      sum += normalized * normalized;
    }

    return Math.sqrt(sum / data.length);
  }

  function confirmBargeIn() {
    const now = Date.now();

    if (now - lastBargeInAtRef.current < 1200) {
      return;
    }

    lastBargeInAtRef.current = now;
    bargeInConfirmedRef.current = true;
    possibleSpeechStartedAtRef.current = null;

    setBargeInStatus("Customer interrupted. Listening...");
    stopSpeaking();

    if (autoModeRef.current && !recognitionRef.current) {
      startAutoListening();
    }
  }

  function runBargeInLoop() {
    const analyser = analyserRef.current;

    if (!analyser) {
      return;
    }

    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);

    const rms = calculateRms(data);
    setMicLevel(rms);

    const now = Date.now();
    const adaptiveThreshold = Math.max(noiseFloorRef.current * 3.5, 0.04);

    if (!isSpeakingRef.current) {
      // Slowly learn the room noise only when AI is not speaking.
      if (rms < 0.05) {
        noiseFloorRef.current = noiseFloorRef.current * 0.95 + rms * 0.05;
      }

      possibleSpeechStartedAtRef.current = null;

      if (autoModeRef.current) {
        setBargeInStatus("Listening to customer...");
      }
    } else if (
      autoModeRef.current &&
      !bargeInConfirmedRef.current &&
      rms > adaptiveThreshold
    ) {
      if (!possibleSpeechStartedAtRef.current) {
        possibleSpeechStartedAtRef.current = now;
        setBargeInStatus("Possible interruption...");
      }

      const speechDuration = now - possibleSpeechStartedAtRef.current;

      if (speechDuration >= 550) {
        confirmBargeIn();
      }
    } else if (isSpeakingRef.current && !bargeInConfirmedRef.current) {
      possibleSpeechStartedAtRef.current = null;

      if (autoModeRef.current) {
        setBargeInStatus("AI speaking. Monitoring for real interruption...");
      }
    }

    animationFrameRef.current = requestAnimationFrame(runBargeInLoop);
  }

  async function startBargeInMonitor() {
    if (
      typeof window === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      mediaStreamRef.current
    ) {
      return;
    }

    const AudioContextConstructor = getAudioContextConstructor();

    if (!AudioContextConstructor) {
      return;
    }

    try {
      setBargeInStatus("Starting microphone monitor...");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const audioContext = new AudioContextConstructor();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();

      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.75;

      source.connect(analyser);

      mediaStreamRef.current = stream;
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      setBargeInStatus("Calibrating background noise...");

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      animationFrameRef.current = requestAnimationFrame(runBargeInLoop);
    } catch {
      setBargeInStatus("Mic monitor unavailable");
      setError("Could not start microphone monitor for interruption detection.");
    }
  }

  function stopBargeInMonitor() {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;

    void audioContextRef.current?.close();
    audioContextRef.current = null;
    analyserRef.current = null;
    possibleSpeechStartedAtRef.current = null;
    bargeInConfirmedRef.current = false;
    setMicLevel(0);
    setBargeInStatus("Idle");
  }

  function startListening() {
    const recognitionInstance = getSpeechRecognition();

    if (!recognitionInstance) {
      setError(
        "Speech recognition is not supported in this browser. Use Chrome or Edge, or type the customer reply manually."
      );
      return;
    }

    recognitionInstance.continuous = false;
    recognitionInstance.interimResults = false;
    recognitionInstance.lang = "en-IN";

    recognitionInstance.onresult = (event) => {
      const result = event.results[0]?.[0]?.transcript;

      if (result) {
        appendTranscriptLine(`Customer: ${result}`);
      }
    };

    recognitionInstance.onerror = () => {
      setError("Speech recognition failed. You can type the customer reply manually.");
      setIsListening(false);
    };

    recognitionInstance.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognitionInstance;
    setRecognition(recognitionInstance);
    setError("");
    setIsListening(true);
    recognitionInstance.start();
  }

  function stopListening() {
    recognitionRef.current?.stop();
    recognition?.stop();
    recognitionRef.current = null;
    setIsListening(false);
  }

  async function processCustomerBuffer() {
    const customerText = customerBufferRef.current.trim();

    if (!customerText || generatingReplyRef.current) {
      return;
    }

    customerBufferRef.current = "";
    bargeInConfirmedRef.current = false;
    setInterimText("");

    appendTranscriptLine(`Customer: ${customerText}`);

    await generateAgentReply(true);
  }

  function handleAutoSpeechResult(event: SpeechRecognitionEventLike) {
    let finalText = "";
    let interim = "";

    const startIndex = event.resultIndex ?? 0;

    for (let index = startIndex; index < event.results.length; index += 1) {
      const resultItem = event.results[index];
      const transcript = resultItem?.[0]?.transcript ?? "";

      if (!transcript.trim()) {
        continue;
      }

      if (resultItem.isFinal) {
        finalText += ` ${transcript}`;
      } else {
        interim += ` ${transcript}`;
      }
    }

    const heardSomething = finalText.trim() || interim.trim();

    // While AI is speaking, browser STT often hears speaker echo.
    // Trust interruption text only after Web Audio confirms real human speech.
    if (heardSomething && isSpeakingRef.current && !bargeInConfirmedRef.current) {
      setBargeInStatus("Ignoring possible AI echo/noise...");
      return;
    }

    if (heardSomething && isSpeakingRef.current && bargeInConfirmedRef.current) {
      stopSpeaking();
    }

    if (interim.trim()) {
      setInterimText(interim.trim());
    }

    if (finalText.trim()) {
      customerBufferRef.current = `${customerBufferRef.current} ${finalText}`.trim();

      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }

      silenceTimerRef.current = setTimeout(() => {
        void processCustomerBuffer();
      }, 900);
    }
  }

  function startAutoListening() {
    if (!autoModeRef.current || recognitionRef.current) {
      return;
    }

    const recognitionInstance = getSpeechRecognition();

    if (!recognitionInstance) {
      setError(
        "Speech recognition is not supported in this browser. Use Chrome or Edge."
      );
      setIsAutoMode(false);
      autoModeRef.current = false;
      return;
    }

    recognitionInstance.continuous = true;
    recognitionInstance.interimResults = true;
    recognitionInstance.lang = "en-IN";

    recognitionInstance.onresult = handleAutoSpeechResult;

    recognitionInstance.onerror = () => {
      setIsListening(false);
      recognitionRef.current = null;

      if (autoModeRef.current) {
        setTimeout(() => {
          startAutoListening();
        }, 700);
      }
    };

    recognitionInstance.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;

      if (autoModeRef.current && !generatingReplyRef.current) {
        setTimeout(() => {
          startAutoListening();
        }, 350);
      }
    };

    recognitionRef.current = recognitionInstance;
    setRecognition(recognitionInstance);
    setError("");
    setIsListening(true);

    try {
      recognitionInstance.start();
    } catch {
      recognitionRef.current = null;
      setIsListening(false);
    }
  }

  function stopAutoListening() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
  }

  async function startAutoCall() {
    if (!agent) {
      setError("Agent is not loaded yet.");
      return;
    }

    setError("");
    setSavedCall(null);
    setIsAutoMode(true);
    autoModeRef.current = true;
    bargeInConfirmedRef.current = false;

    await startBargeInMonitor();

    if (transcriptLinesRef.current.length === 0) {
      speakOpeningMessage(() => {
        startAutoListening();
      });
    } else {
      startAutoListening();
    }
  }

  function stopAutoCall() {
    setIsAutoMode(false);
    autoModeRef.current = false;
    customerBufferRef.current = "";
    setInterimText("");

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    stopAutoListening();
    stopSpeaking();
    stopBargeInMonitor();
  }

  function addManualCustomerLine() {
    const text = manualText.trim();

    if (!text) {
      return;
    }

    appendTranscriptLine(`Customer: ${text}`);
    setManualText("");
  }

  async function generateAgentReply(autoContinue = false) {
    if (!agent) {
      setError("Agent is not loaded yet.");
      return;
    }

    const currentTranscript = transcriptLinesRef.current.join("\n");

    if (currentTranscript.trim().length < 10) {
      setError("Add at least one transcript line before generating an AI reply.");
      return;
    }

    if (generatingReplyRef.current) {
      return;
    }

    generatingReplyRef.current = true;
    setGeneratingReply(true);
    setError("");

    try {
      const response = await apiRequest<{ reply: string }>("/api/ai/generate-reply", {
        method: "POST",
        body: JSON.stringify({
          agentId: agent.id,
          transcript: currentTranscript,
          contactName: selectedContact?.name,
          campaignObjective: campaign?.objective,
        }),
      });

      appendTranscriptLine(`Agent: ${response.reply}`);
      speak(response.reply, () => {
        if (autoContinue && autoModeRef.current) {
          startAutoListening();
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate AI reply");
    } finally {
      generatingReplyRef.current = false;
      setGeneratingReply(false);
    }
  }

  async function addAgentReply() {
    await generateAgentReply(false);
  }

  function clearTranscript() {
    stopAutoCall();
    setTranscriptLines([]);
    transcriptLinesRef.current = [];
    setSavedCall(null);
    setError("");
  }

  async function saveCall() {
    if (!selectedContactId) {
      setError("Select a contact first.");
      return;
    }

    if (fullTranscript.trim().length < 20) {
      setError("Transcript is too short. Add at least one agent and customer message.");
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
        <div className="max-w-6xl mx-auto text-slate-600">Loading voice simulator...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href={`/campaigns/${campaignId}`}
              className="text-sm font-medium text-violet-600 hover:text-violet-700"
            >
              ← Back to campaign
            </Link>
            <h1 className="mt-3 text-3xl font-bold text-slate-950">
              Browser Voice Simulator
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Test TTS, STT, transcript capture, and Gemini outcome extraction before adding real phone calls.
            </p>
          </div>
        </div>

        {error ? (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <section className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">Campaign</h2>
              <div className="mt-4 space-y-2 text-sm">
                <p>
                  <span className="font-medium text-slate-700">Name:</span>{" "}
                  <span className="text-slate-600">{campaign?.name}</span>
                </p>
                <p>
                  <span className="font-medium text-slate-700">Objective:</span>{" "}
                  <span className="text-slate-600">{campaign?.objective}</span>
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">Agent</h2>
              <div className="mt-4 space-y-2 text-sm">
                <p>
                  <span className="font-medium text-slate-700">Name:</span>{" "}
                  <span className="text-slate-600">{agent?.name}</span>
                </p>
                <p>
                  <span className="font-medium text-slate-700">Voice style:</span>{" "}
                  <span className="text-slate-600">{agent?.voiceStyle}</span>
                </p>
                <p>
                  <span className="font-medium text-slate-700">Opening:</span>{" "}
                  <span className="text-slate-600">{agent?.openingMessage}</span>
                </p>
              </div>

              <button
                onClick={() => speakOpeningMessage()}
                className="mt-4 w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
              >
                Speak opening message
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">Contact</h2>

              <select
                value={selectedContactId}
                onChange={(event) => setSelectedContactId(event.target.value)}
                className="mt-4 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-500"
              >
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.name} — {contact.phone}
                  </option>
                ))}
              </select>

              {selectedContact ? (
                <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                  <p className="font-medium text-slate-800">{selectedContact.name}</p>
                  <p>{selectedContact.phone}</p>
                  <p>{selectedContact.email || "No email"}</p>
                  <p>{selectedContact.company || "No company"}</p>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">No contacts in this campaign.</p>
              )}
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Live Transcript</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Use manual mode, or start Auto Call for hands-free conversation.
                  </p>

                  {isAutoMode ? (
                    <p className="mt-2 text-xs font-medium text-violet-700">
                      Auto mode:{" "}
                      {generatingReply
                        ? "AI is thinking..."
                        : isSpeaking
                          ? "AI is speaking. Customer can interrupt."
                          : isListening
                            ? "Listening to customer..."
                            : "Ready"}
                    </p>
                  ) : null}

                  {isAutoMode ? (
                    <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                      <p className="text-xs font-medium text-slate-600">
                        Barge-in detector: {bargeInStatus}
                      </p>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-violet-500 transition-all"
                          style={{
                            width: `${Math.min(100, Math.round(micLevel * 900))}%`,
                          }}
                        />
                      </div>
                    </div>
                  ) : null}

                  {interimText ? (
                    <p className="mt-1 text-xs text-slate-400">
                      Hearing: {interimText}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  {!isAutoMode ? (
                    <button
                      onClick={startAutoCall}
                      className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
                    >
                      Start Auto Call
                    </button>
                  ) : (
                    <button
                      onClick={stopAutoCall}
                      className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                    >
                      Stop Auto Call
                    </button>
                  )}

                  {!isListening ? (
                    <button
                      onClick={startListening}
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                    >
                      Start microphone
                    </button>
                  ) : (
                    <button
                      onClick={stopListening}
                      className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                    >
                      Stop listening
                    </button>
                  )}

                  <button
                    onClick={clearTranscript}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="mt-5 min-h-[260px] rounded-xl border border-slate-200 bg-slate-950 p-4 font-mono text-sm text-slate-100">
                {transcriptLines.length === 0 ? (
                  <p className="text-slate-400">
                    No transcript yet. Click “Speak opening message”, then respond using microphone or manual input.
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

              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input
                  value={manualText}
                  onChange={(event) => setManualText(event.target.value)}
                  placeholder="Type customer reply manually..."
                  className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500"
                />
                <button
                  onClick={addManualCustomerLine}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Add customer line
                </button>
                <button
                  onClick={addAgentReply}
                  disabled={generatingReply}
                  className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {generatingReply ? "Generating..." : "Generate AI Reply"}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">Save and Extract</h2>
              <p className="mt-1 text-sm text-slate-500">
                Save this transcript as a call record, then run Gemini outcome extraction.
              </p>

              {existingCallId ? (
                <p className="mt-2 rounded-lg bg-violet-50 px-3 py-2 text-xs font-medium text-violet-700">
                  Using prepared call: {existingCallId}
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={saveCall}
                  disabled={saving}
                  className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Saving..." : existingCallId ? "Save to prepared call" : "Save call"}
                </button>

                <button
                  onClick={extractOutcome}
                  disabled={!savedCall || extracting}
                  className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {extracting ? "Extracting..." : "Extract outcome"}
                </button>
              </div>

              {savedCall ? (
                <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <p>
                    <span className="font-medium text-slate-700">Call ID:</span>{" "}
                    <span className="text-slate-600">{savedCall.id}</span>
                  </p>
                  <p>
                    <span className="font-medium text-slate-700">Status:</span>{" "}
                    <span className="text-slate-600">{savedCall.status}</span>
                  </p>

                  {savedCall.outcome ? (
                    <div className="mt-4 space-y-2">
                      <h3 className="font-semibold text-slate-950">AI Outcome</h3>
                      <p>
                        <span className="font-medium text-slate-700">Summary:</span>{" "}
                        {savedCall.outcome.summary}
                      </p>
                      <p>
                        <span className="font-medium text-slate-700">Sentiment:</span>{" "}
                        {savedCall.outcome.sentiment}
                      </p>
                      <p>
                        <span className="font-medium text-slate-700">Lead status:</span>{" "}
                        {savedCall.outcome.leadStatus}
                      </p>
                      <p>
                        <span className="font-medium text-slate-700">Callback:</span>{" "}
                        {savedCall.outcome.callbackTime || "None"}
                      </p>
                      <p>
                        <span className="font-medium text-slate-700">Next action:</span>{" "}
                        {savedCall.outcome.nextAction}
                      </p>
                      <p>
                        <span className="font-medium text-slate-700">Confidence:</span>{" "}
                        {(savedCall.outcome.confidence * 100).toFixed(0)}%
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
