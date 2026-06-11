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

const VOICE_STYLE_COLORS: Record<string, "purple" | "success" | "info" | "warning" | "default"> = {
  professional: "purple",
  friendly: "success",
  casual: "info",
  empathetic: "warning",
  energetic: "default",
};

const EMPTY_FORM = {
  name: "",
  persona: "",
  companyContext: "",
  callObjective: "",
  openingMessage: "",
  language: "en",
  voiceStyle: "professional" as Agent["voiceStyle"],
};

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
      await createAgent(form);
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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Agents</h1>
            <p className="text-sm text-slate-500 mt-1">
              AI callers with custom personas and objectives
            </p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "+ New agent"}
          </Button>
        </div>

        {/* Create form */}
        {showForm && (
          <Card>
            <h2 className="text-base font-semibold text-slate-900 mb-5">
              Create agent
            </h2>
            <form
              onSubmit={handleCreate}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              <Input
                label="Agent name"
                placeholder="e.g. Sales Rahul"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">
                  Voice style
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
                  {VOICE_STYLES.map((s) => (
                    <option key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Language"
                placeholder="en"
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value })}
              />
              <Input
                label="Call objective"
                placeholder="e.g. Book a site visit for 2BHK apartments"
                value={form.callObjective}
                onChange={(e) =>
                  setForm({ ...form, callObjective: e.target.value })
                }
                required
              />
              <div className="md:col-span-2">
                <Textarea
                  label="Persona"
                  placeholder="e.g. You are a helpful real estate advisor..."
                  rows={3}
                  value={form.persona}
                  onChange={(e) => setForm({ ...form, persona: e.target.value })}
                  required
                />
              </div>
              <div className="md:col-span-2">
                <Textarea
                  label="Company context"
                  placeholder="e.g. ABC Realty is a premium developer in Pune with 10+ projects..."
                  rows={3}
                  value={form.companyContext}
                  onChange={(e) =>
                    setForm({ ...form, companyContext: e.target.value })
                  }
                />
              </div>
              <div className="md:col-span-2">
                <Textarea
                  label="Opening message"
                  placeholder="e.g. Hi! This is Rahul from ABC Realty. Is this a good time to talk about your dream home?"
                  rows={2}
                  value={form.openingMessage}
                  onChange={(e) =>
                    setForm({ ...form, openingMessage: e.target.value })
                  }
                />
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

        {/* Agent list */}
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
                  <Badge
                    label={agent.voiceStyle}
                    variant={VOICE_STYLE_COLORS[agent.voiceStyle] ?? "default"}
                  />
                </div>
                <p className="text-xs text-slate-500 leading-relaxed mb-3 line-clamp-2">
                  {agent.callObjective}
                </p>
                {agent.persona && (
                  <p className="text-xs text-slate-400 italic line-clamp-2 mb-4">
                    {agent.persona}
                  </p>
                )}
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
