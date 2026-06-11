"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Input } from "@/components/input";
import { Textarea } from "@/components/textarea";
import { createCampaign, getAgents, getCampaigns, getContacts } from "@/lib/api";
import type { Agent, Campaign, Contact } from "@/lib/types";

function statusVariant(status: string) {
  const map: Record<string, "success" | "warning" | "info" | "default"> = {
    active: "success",
    paused: "warning",
    completed: "info",
    draft: "default",
  };
  return map[status] ?? "default";
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    objective: "",
    agent: "",
    contacts: [] as string[],
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const [c, a, ct] = await Promise.allSettled([
      getCampaigns(),
      getAgents(),
      getContacts(),
    ]);
    if (c.status === "fulfilled") setCampaigns(c.value.campaigns);
    if (a.status === "fulfilled") setAgents(a.value.agents);
    if (ct.status === "fulfilled") setContacts(ct.value.contacts);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.agent) {
      setError("Please select an agent");
      return;
    }
    setSubmitting(true);
    try {
      await createCampaign(form);
      setForm({
        name: "",
        description: "",
        objective: "",
        agent: "",
        contacts: [],
      });
      setShowForm(false);
      await load();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to create campaign"
      );
    } finally {
      setSubmitting(false);
    }
  }

  function toggleContact(id: string) {
    setForm((prev) => ({
      ...prev,
      contacts: prev.contacts.includes(id)
        ? prev.contacts.filter((c) => c !== id)
        : [...prev.contacts, id],
    }));
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Campaigns</h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage your AI voice campaigns
            </p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "+ New campaign"}
          </Button>
        </div>

        {/* Create form */}
        {showForm && (
          <Card>
            <h2 className="text-base font-semibold text-slate-900 mb-5">
              Create campaign
            </h2>
            <form
              onSubmit={handleCreate}
              className="flex flex-col gap-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Campaign name"
                  placeholder="e.g. Q1 Mumbai Leads"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">
                    Agent
                  </label>
                  <select
                    value={form.agent}
                    onChange={(e) =>
                      setForm({ ...form, agent: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    required
                  >
                    <option value="">Select an agent…</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <Input
                label="Objective"
                placeholder="e.g. Book site visits for 2BHK apartments"
                value={form.objective}
                onChange={(e) =>
                  setForm({ ...form, objective: e.target.value })
                }
              />
              <Textarea
                label="Description (optional)"
                placeholder="Campaign notes..."
                rows={2}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />

              {/* Contacts selection */}
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">
                  Select contacts ({form.contacts.length} selected)
                </label>
                {contacts.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">
                    No contacts yet. Upload a CSV first.
                  </p>
                ) : (
                  <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-50">
                    {contacts.map((c) => (
                      <label
                        key={c.id}
                        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={form.contacts.includes(c.id)}
                          onChange={() => toggleContact(c.id)}
                          className="accent-violet-600"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800">
                            {c.name}
                          </p>
                          <p className="text-xs text-slate-400">
                            {c.phone}
                            {c.company ? ` · ${c.company}` : ""}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button type="submit" loading={submitting}>
                  Create campaign
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

        {/* Campaign list */}
        {loading ? (
          <div className="text-sm text-slate-400 py-8 text-center">
            Loading campaigns...
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="text-4xl">📣</div>
            <p className="text-slate-600 font-medium">No campaigns yet</p>
            <p className="text-sm text-slate-400">
              Create a campaign to begin running AI calls
            </p>
            <Button onClick={() => setShowForm(true)} className="mt-2">
              + New campaign
            </Button>
          </div>
        ) : (
          <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">
                    Contacts
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">
                    Created
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{c.name}</p>
                      {c.objective && (
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                          {c.objective}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        label={c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                        variant={statusVariant(c.status)}
                      />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {Array.isArray(c.contactIds) ? c.contactIds.length : c.contactCount ?? 0}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {c.createdAt
                        ? new Date(c.createdAt).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/campaigns/${c.id}`}>
                        <Button size="sm" variant="secondary">
                          Open →
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
