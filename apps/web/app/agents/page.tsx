"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Input } from "@/components/input";
import { Textarea } from "@/components/textarea";
import { createAgent, deleteAgent, getAgents } from "@/lib/api";
import type { Agent } from "@/lib/types";

const VOICE_STYLES = [
  "professional",
  "friendly",
  "casual",
  "empathetic",
  "energetic",
] as const;

const VOICE_STYLE_COLORS: Record<
  string,
  "purple" | "success" | "info" | "warning" | "default"
> = {
  professional: "purple",
  friendly: "success",
  casual: "info",
  empathetic: "warning",
  energetic: "default",
};

const GOOGLE_LIVE_VOICES: Array<{
  value: Agent["voiceName"];
  label: string;
  description: string;
}> = [
  { value: "Kore", label: "Kore", description: "Firm, stable" },
  { value: "Puck", label: "Puck", description: "Upbeat" },
  { value: "Charon", label: "Charon", description: "Professional" },
  { value: "Fenrir", label: "Fenrir", description: "Energetic" },
  { value: "Achird", label: "Achird", description: "Friendly" },
  { value: "Sulafat", label: "Sulafat", description: "Warm" },
  { value: "Despina", label: "Despina", description: "Smooth" },
];

const DEFAULT_CLOSING =
  "Thanks for your time. Have a great day. Goodbye.";

const EMPTY_FORM = {
  name: "",
  persona: "",
  companyContext: "",
  callObjective: "",
  openingMessage: "",
  closingMessage: DEFAULT_CLOSING,
  conversationGuidelines: "",
  language: "English",
  voiceStyle: "professional" as Agent["voiceStyle"],
  voiceName: "Kore" as Agent["voiceName"],
};

function countText(value: string) {
  return value.trim().length;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    try {
      const res = await getAgents();
      setAgents(res.agents);
    } catch {
      // silently fail on reload
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await createAgent({
        ...form,
        companyContext: form.companyContext.trim(),
        closingMessage: form.closingMessage.trim() || DEFAULT_CLOSING,
        conversationGuidelines: form.conversationGuidelines.trim(),
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create agent");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this agent?")) return;

    try {
      await deleteAgent(id);
      setAgents((prev) => prev.filter((a) => a.id !== id));
    } catch {
      alert("Failed to delete agent");
    }
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Agents</h1>
            <p className="text-sm text-slate-500 mt-1">
              Configure persona, objective, opening, closing, and call rules.
            </p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "+ New agent"}
          </Button>
        </div>

        {showForm && (
          <Card>
            <div className="mb-5">
              <h2 className="text-base font-semibold text-slate-900">
                Create agent
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Keep opening and closing short. Put long scripts, objection
                handling, and call-flow rules in conversation guidelines.
              </p>
            </div>

            <form
              onSubmit={handleCreate}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              <Input
                label="Agent name"
                placeholder="e.g. Real Estate Rahul"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  Language
                </label>
                <select
                  value={form.language}
                  onChange={(e) => setForm({ ...form, language: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="English">English</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  Speaking style
                </label>
                <select
                  value={form.voiceStyle}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      voiceStyle: e.target.value as Agent["voiceStyle"],
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  {VOICE_STYLES.map((style) => (
                    <option key={style} value={style}>
                      {style.charAt(0).toUpperCase() + style.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  Gemini Live voice
                </label>
                <select
                  value={form.voiceName}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      voiceName: e.target.value as Agent["voiceName"],
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  {GOOGLE_LIVE_VOICES.map((voice) => (
                    <option key={voice.value} value={voice.value}>
                      {voice.label} — {voice.description}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-400">
                  Used only in Gemini Live realtime calls.
                </p>
              </div>

              <div className="md:col-span-2">
                <Textarea
                  label="Persona"
                  placeholder="e.g. You are a friendly, energetic male real estate calling agent. You sound confident, natural, and helpful."
                  rows={4}
                  value={form.persona}
                  onChange={(e) =>
                    setForm({ ...form, persona: e.target.value })
                  }
                  required
                />
                <p className="mt-1 text-xs text-slate-400">
                  {countText(form.persona)} / 6000 characters
                </p>
              </div>

              <div className="md:col-span-2">
                <Textarea
                  label="Call objective"
                  placeholder="e.g. Qualify the customer for property interest, location, budget, timeline, and callback preference."
                  rows={3}
                  value={form.callObjective}
                  onChange={(e) =>
                    setForm({ ...form, callObjective: e.target.value })
                  }
                  required
                />
                <p className="mt-1 text-xs text-slate-400">
                  {countText(form.callObjective)} / 4000 characters
                </p>
              </div>

              <div className="md:col-span-2">
                <Textarea
                  label="Company context"
                  placeholder="Optional: company details, product details, locations, offers, eligibility, pricing, FAQs, etc."
                  rows={4}
                  value={form.companyContext}
                  onChange={(e) =>
                    setForm({ ...form, companyContext: e.target.value })
                  }
                />
                <p className="mt-1 text-xs text-slate-400">
                  Optional · {countText(form.companyContext)} / 6000 characters
                </p>
              </div>

              <div className="md:col-span-2">
                <Textarea
                  label="Opening message"
                  placeholder="e.g. Hi, this is Rahul from ABC Realty. Is this a good time to talk for a minute?"
                  rows={3}
                  value={form.openingMessage}
                  onChange={(e) =>
                    setForm({ ...form, openingMessage: e.target.value })
                  }
                  required
                />
                <p className="mt-1 text-xs text-slate-400">
                  First thing the agent says · {countText(form.openingMessage)} /
                  2500 characters
                </p>
              </div>

              <div className="md:col-span-2">
                <Textarea
                  label="Closing message"
                  placeholder={DEFAULT_CLOSING}
                  rows={2}
                  value={form.closingMessage}
                  onChange={(e) =>
                    setForm({ ...form, closingMessage: e.target.value })
                  }
                />
                <p className="mt-1 text-xs text-slate-400">
                  Used when the call naturally ends ·{" "}
                  {countText(form.closingMessage)} / 1200 characters
                </p>
              </div>

              <div className="md:col-span-2">
                <Textarea
                  label="Conversation guidelines"
                  placeholder={`Optional but recommended:
- Ask one question at a time.
- If customer is busy, ask for callback time.
- If interested, collect location, budget, timeline, and site visit preference.
- If not interested, politely close.
- Do not read these rules aloud.`}
                  rows={7}
                  value={form.conversationGuidelines}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      conversationGuidelines: e.target.value,
                    })
                  }
                />
                <p className="mt-1 text-xs text-slate-400">
                  Long script, call flow, objection handling ·{" "}
                  {countText(form.conversationGuidelines)} / 8000 characters
                </p>
              </div>

              {error && (
                <div className="md:col-span-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
                  {error}
                </div>
              )}

              <div className="md:col-span-2 flex gap-3 pt-2">
                <Button type="submit" loading={submitting}>
                  Create agent
                </Button>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        )}

        {loading ? (
          <div className="text-sm text-slate-400 py-8 text-center">
            Loading agents...
          </div>
        ) : agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="text-4xl">🤖</div>
            <p className="text-slate-600 font-medium">No agents yet</p>
            <p className="text-sm text-slate-400">
              Create your first AI agent to get started
            </p>
            <Button onClick={() => setShowForm(true)} className="mt-2">
              + New agent
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent) => (
              <Card key={agent.id}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center text-violet-700 font-semibold text-sm">
                      {agent.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        {agent.name}
                      </h3>
                      <p className="text-xs text-slate-400">{agent.language}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <Badge
                      label={agent.voiceStyle}
                      variant={VOICE_STYLE_COLORS[agent.voiceStyle] ?? "default"}
                    />
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                      {agent.voiceName || "Kore"}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed mb-3 line-clamp-2">
                  {agent.callObjective}
                </p>

                {agent.persona && (
                  <p className="text-xs text-slate-400 italic line-clamp-2 mb-4">
                    {agent.persona}
                  </p>
                )}

                {agent.conversationGuidelines ? (
                  <div className="mb-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    Custom conversation rules added
                  </div>
                ) : null}

                <div className="flex justify-end pt-3 border-t border-slate-50">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(agent.id)}
                    className="text-red-400 hover:text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
