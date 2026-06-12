"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

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
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
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
  const campaignId = params.id;

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
  const [error, setError] = useState("");

  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.id === selectedContactId) || null,
    [contacts, selectedContactId]
  );

  const fullTranscript = transcriptLines.join("\n");

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
          setSelectedContactId(campaignContacts[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load simulator");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [campaignId, router]);

  function speak(text: string) {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setError("Text-to-speech is not supported in this browser.");
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 1;

    window.speechSynthesis.speak(utterance);
  }

  function speakOpeningMessage() {
    if (!agent) {
      return;
    }

    const message = agent.openingMessage || "Hello, I am calling about your interest.";
    setTranscriptLines((prev) => [...prev, `Agent: ${message}`]);
    speak(message);
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
        setTranscriptLines((prev) => [...prev, `Customer: ${result}`]);
      }
    };

    recognitionInstance.onerror = () => {
      setError("Speech recognition failed. You can type the customer reply manually.");
      setIsListening(false);
    };

    recognitionInstance.onend = () => {
      setIsListening(false);
    };

    setRecognition(recognitionInstance);
    setError("");
    setIsListening(true);
    recognitionInstance.start();
  }

  function stopListening() {
    recognition?.stop();
    setIsListening(false);
  }

  function addManualCustomerLine() {
    const text = manualText.trim();

    if (!text) {
      return;
    }

    setTranscriptLines((prev) => [...prev, `Customer: ${text}`]);
    setManualText("");
  }

  function addAgentReply() {
    const reply =
      "Thank you for sharing that. I will note your requirement and our team will follow up with suitable options.";

    setTranscriptLines((prev) => [...prev, `Agent: ${reply}`]);
    speak(reply);
  }

  function clearTranscript() {
    setTranscriptLines([]);
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
      const response = await apiRequest<{ call: SavedCall }>("/api/calls", {
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
                onClick={speakOpeningMessage}
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
                    Use microphone or type customer replies manually.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
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
                  className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-100"
                >
                  Agent follow-up
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-950">Save and Extract</h2>
              <p className="mt-1 text-sm text-slate-500">
                Save this transcript as a call record, then run Gemini outcome extraction.
              </p>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={saveCall}
                  disabled={saving}
                  className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save call"}
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
