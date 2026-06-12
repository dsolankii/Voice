"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { Input } from "@/components/input";
import { Textarea } from "@/components/textarea";
import {
  createCampaign,
  getAgents,
  getCampaigns,
  getCampaignSummary,
  getContacts,
} from "@/lib/api";
import type { Agent, Campaign, CampaignSummary, Contact } from "@/lib/types";

function statusVariant(
  status: Campaign["status"]
): "success" | "warning" | "info" | "default" {
  const map: Record<
    Campaign["status"],
    "success" | "warning" | "info" | "default"
  > = {
    draft: "default",
    running: "warning",
    completed: "success",
    archived: "info",
  };

  return map[status] ?? "default";
}

function formatDate(value?: string) {
  if (!value) return "Unknown date";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function completionPercent(summary?: CampaignSummary) {
  if (!summary || summary.totals.calls === 0) return 0;
  return Math.round((summary.totals.completed / summary.totals.calls) * 100);
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [summaries, setSummaries] = useState<Record<string, CampaignSummary>>(
    {}
  );
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
    setLoading(true);

    const [campaignResult, agentsResult, contactsResult] =
      await Promise.allSettled([getCampaigns(), getAgents(), getContacts()]);

    if (agentsResult.status === "fulfilled") {
      setAgents(agentsResult.value.agents);
    }

    if (contactsResult.status === "fulfilled") {
      setContacts(contactsResult.value.contacts);
    }

    if (campaignResult.status === "fulfilled") {
      const loadedCampaigns = campaignResult.value.campaigns;
      setCampaigns(loadedCampaigns);

      const summaryResults = await Promise.allSettled(
        loadedCampaigns.map((campaign) => getCampaignSummary(campaign.id))
      );

      const nextSummaries: Record<string, CampaignSummary> = {};

      summaryResults.forEach((result, index) => {
        if (result.status === "fulfilled") {
          nextSummaries[loadedCampaigns[index].id] = result.value.summary;
        }
      });

      setSummaries(nextSummaries);
    }

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

    if (form.contacts.length === 0) {
      setError("Please select at least one contact");
      return;
    }

    setSubmitting(true);

    try {
      await createCampaign({
        name: form.name,
        description: form.description,
        objective: form.objective,
        agentId: form.agent,
        contactIds: form.contacts,
      });

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
        ? prev.contacts.filter((contactId) => contactId !== id)
        : [...prev.contacts, id],
    }));
  }

  const totalCampaigns = campaigns.length;
  const runningCampaigns = campaigns.filter(
    (campaign) => campaign.status === "running"
  ).length;
  const completedCampaigns = campaigns.filter(
    (campaign) => campaign.status === "completed"
  ).length;
  const totalCalls = Object.values(summaries).reduce(
    (sum, summary) => sum + summary.totals.calls,
    0
  );
  const interestedLeads = Object.values(summaries).reduce(
    (sum, summary) => sum + summary.leadStatus.interested,
    0
  );

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Campaigns
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage campaigns, monitor outcomes, and continue simulations.
            </p>
          </div>

          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "+ New campaign"}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card>
            <p className="text-xs font-medium text-slate-500">
              Total campaigns
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {totalCampaigns}
            </p>
          </Card>

          <Card>
            <p className="text-xs font-medium text-slate-500">Running</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {runningCampaigns}
            </p>
          </Card>

          <Card>
            <p className="text-xs font-medium text-slate-500">Completed</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {completedCampaigns}
            </p>
          </Card>

          <Card>
            <p className="text-xs font-medium text-slate-500">
              Interested leads
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {interestedLeads}
            </p>
          </Card>
        </div>

        {showForm && (
          <Card>
            <h2 className="mb-5 text-base font-semibold text-slate-900">
              Create campaign
            </h2>

            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    required
                  >
                    <option value="">Select an agent...</option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
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
                required
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

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Select contacts ({form.contacts.length} selected)
                </label>

                {contacts.length === 0 ? (
                  <p className="text-xs italic text-slate-400">
                    No contacts yet. Upload a CSV first.
                  </p>
                ) : (
                  <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-50">
                    {contacts.map((contact) => (
                      <label
                        key={contact.id}
                        className="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={form.contacts.includes(contact.id)}
                          onChange={() => toggleContact(contact.id)}
                          className="accent-violet-600"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800">
                            {contact.name}
                          </p>
                          <p className="text-xs text-slate-400">
                            {contact.phone}
                            {contact.company ? ` · ${contact.company}` : ""}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  {error}
                </div>
              ) : null}

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

        {loading ? (
          <div className="py-8 text-center text-sm text-slate-400">
            Loading campaigns...
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <div className="text-4xl">Campaign</div>
            <p className="font-medium text-slate-600">No campaigns yet</p>
            <p className="text-sm text-slate-400">
              Create a campaign to begin running AI calls.
            </p>
            <Button onClick={() => setShowForm(true)} className="mt-2">
              + New campaign
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {campaigns.map((campaign) => {
              const summary = summaries[campaign.id];
              const percent = completionPercent(summary);
              const calls = summary?.totals.calls ?? 0;
              const completed = summary?.totals.completed ?? 0;
              const pending = summary?.totals.pending ?? 0;
              const interested = summary?.leadStatus.interested ?? 0;
              const positive = summary?.sentiment.positive ?? 0;
              const averageConfidence =
                summary?.quality.averageConfidence !== null &&
                summary?.quality.averageConfidence !== undefined
                  ? `${(summary.quality.averageConfidence * 100).toFixed(0)}%`
                  : "-";

              return (
                <Card key={campaign.id}>
                  <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold text-slate-900">
                          {campaign.name}
                        </h2>
                        <Badge
                          label={campaign.status}
                          variant={statusVariant(campaign.status)}
                        />
                      </div>

                      {campaign.objective ? (
                        <p className="line-clamp-2 text-sm text-slate-500">
                          {campaign.objective}
                        </p>
                      ) : (
                        <p className="text-sm text-slate-400">
                          No objective added.
                        </p>
                      )}

                      <p className="mt-2 text-xs text-slate-400">
                        Created {formatDate(campaign.createdAt)}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-6 md:min-w-[640px]">
                      <div>
                        <p className="text-xs text-slate-400">Contacts</p>
                        <p className="font-semibold text-slate-900">
                          {campaign.contactCount ?? campaign.contactIds.length}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-400">Calls</p>
                        <p className="font-semibold text-slate-900">{calls}</p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-400">Completed</p>
                        <p className="font-semibold text-slate-900">
                          {completed}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-400">Pending</p>
                        <p className="font-semibold text-slate-900">
                          {pending}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-400">Interested</p>
                        <p className="font-semibold text-slate-900">
                          {interested}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-slate-400">Confidence</p>
                        <p className="font-semibold text-slate-900">
                          {averageConfidence}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-stretch gap-2 md:w-36">
                      <Link
                        href={`/campaigns/${campaign.id}`}
                        className="inline-flex items-center justify-center rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
                      >
                        Open
                      </Link>

                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-violet-600"
                          style={{ width: `${percent}%` }}
                        />
                      </div>

                      <p className="text-center text-xs text-slate-400">
                        {percent}% complete
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4 text-xs">
                    <span className="rounded-full bg-slate-50 px-3 py-1 font-medium text-slate-600">
                      Positive: {positive}
                    </span>
                    <span className="rounded-full bg-slate-50 px-3 py-1 font-medium text-slate-600">
                      Callback: {summary?.leadStatus.callbackRequested ?? 0}
                    </span>
                    <span className="rounded-full bg-slate-50 px-3 py-1 font-medium text-slate-600">
                      No answer: {summary?.leadStatus.noAnswer ?? 0}
                    </span>
                    <span className="rounded-full bg-slate-50 px-3 py-1 font-medium text-slate-600">
                      Failed: {summary?.totals.failed ?? 0}
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <div className="rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm text-violet-700">
          Tip: Open a campaign to prepare calls, run simulations, extract
          outcomes, and export campaign results.
        </div>
      </div>
    </AppShell>
  );
}
