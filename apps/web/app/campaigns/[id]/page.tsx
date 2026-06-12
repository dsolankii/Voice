"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { StatCard } from "@/components/stat-card";
import { Textarea } from "@/components/textarea";
import { statusBadge, sentimentBadge, Badge } from "@/components/badge";
import {
  createCall,
  downloadCampaignCsv,
  extractCallOutcome,
  getCalls,
  getCampaign,
  getCampaignSummary,
  getContacts,
  prepareCampaignCalls,
  updateCampaign,
} from "@/lib/api";
import type { Call, Campaign, CampaignSummary, Contact } from "@/lib/types";

function LeadStatusBadge({ status }: { status?: string }) {
  if (!status) return <span className="text-slate-300">—</span>;
  const map: Record<string, string> = {
    interested: "Interested",
    not_interested: "Not Interested",
    callback_requested: "Callback",
    wrong_number: "Wrong #",
    no_answer: "No Answer",
    needs_more_info: "Needs Info",
    unknown: "Unknown",
  };
  const variantMap: Record<string, "success" | "error" | "warning" | "info" | "default"> = {
    interested: "success",
    callback_requested: "warning",
    not_interested: "error",
    no_answer: "default",
    wrong_number: "error",
    needs_more_info: "info",
    unknown: "default",
  };
  return <Badge label={map[status] ?? status} variant={variantMap[status] ?? "default"} />;
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [summary, setSummary] = useState<CampaignSummary | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [preparingCalls, setPreparingCalls] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showCallForm, setShowCallForm] = useState(false);
  const [callForm, setCallForm] = useState({
    contactId: "",
    transcript: "",
  });
  const [callSubmitting, setCallSubmitting] = useState(false);
  const [callError, setCallError] = useState("");

  async function load() {
    const [c, s, cl, ct] = await Promise.allSettled([
      getCampaign(id),
      getCampaignSummary(id),
      getCalls(id),
      getContacts(),
    ]);
    if (c.status === "fulfilled") setCampaign(c.value.campaign);
    if (s.status === "fulfilled") setSummary(s.value.summary);
    if (cl.status === "fulfilled") setCalls(cl.value.calls);
    if (ct.status === "fulfilled") setContacts(ct.value.contacts);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [id]);

  async function handleExtract(callId: string) {
    setExtractingId(callId);
    try {
      await extractCallOutcome(callId);
      await load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setExtractingId(null);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      await downloadCampaignCsv(id);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  async function handlePrepareCalls() {
    setPreparingCalls(true);
    try {
      const result = await prepareCampaignCalls(id);
      await load();
      alert(
        `Prepared calls. Created: ${result.createdCount}, skipped: ${result.skippedCount}`
      );
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to prepare calls");
    } finally {
      setPreparingCalls(false);
    }
  }

  async function handleUpdateCampaignStatus(status: Campaign["status"]) {
    setUpdatingStatus(true);
    try {
      await updateCampaign(id, { status });
      await load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update campaign status");
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleCreateCall(e: React.FormEvent) {
    e.preventDefault();
    setCallError("");
    if (!callForm.contactId) {
      setCallError("Please select a contact");
      return;
    }
    setCallSubmitting(true);
    try {
      await createCall({
        campaignId: id,
        contactId: callForm.contactId,
        transcript: callForm.transcript,
      });
      setCallForm({ contactId: "", transcript: "" });
      setShowCallForm(false);
      await load();
    } catch (err: unknown) {
      setCallError(err instanceof Error ? err.message : "Failed to create call");
    } finally {
      setCallSubmitting(false);
    }
  }

  function getContactName(contactId: string | Contact): string {
    if (typeof contactId === "object") return contactId.name;
    const c = contacts.find((ct) => ct.id === contactId);
    return c?.name ?? contactId;
  }

  function getContactId(contactId: string | Contact): string {
    if (typeof contactId === "object") return contactId.id;
    return contactId;
  }

  if (loading) {
    return (
      <AppShell>
        <div className="text-sm text-slate-400 py-16 text-center">
          Loading campaign...
        </div>
      </AppShell>
    );
  }

  if (!campaign) {
    return (
      <AppShell>
        <div className="text-sm text-red-500 py-16 text-center">
          Campaign not found
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <a
                href="/campaigns"
                className="text-sm text-slate-400 hover:text-slate-600"
              >
                Campaigns
              </a>
              <span className="text-slate-300">/</span>
              <span className="text-sm text-slate-700">{campaign.name}</span>
            </div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {campaign.name}
            </h1>
            {campaign.objective && (
              <p className="text-sm text-slate-500 mt-1">{campaign.objective}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {statusBadge(campaign.status)}
            {campaign.status === "draft" ? (
              <Button
                size="sm"
                variant="secondary"
                loading={updatingStatus}
                onClick={() => handleUpdateCampaignStatus("running")}
              >
                Start Campaign
              </Button>
            ) : null}

            {campaign.status === "running" ? (
              <Button
                size="sm"
                variant="secondary"
                loading={updatingStatus}
                onClick={() => handleUpdateCampaignStatus("completed")}
              >
                Mark Completed
              </Button>
            ) : null}

            {campaign.status !== "archived" ? (
              <Button
                size="sm"
                variant="secondary"
                loading={updatingStatus}
                onClick={() => handleUpdateCampaignStatus("archived")}
              >
                Archive
              </Button>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                loading={updatingStatus}
                onClick={() => handleUpdateCampaignStatus("draft")}
              >
                Restore Draft
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              loading={preparingCalls}
              onClick={handlePrepareCalls}
            >
              Prepare Calls
            </Button>
              <Link
                href={`/campaigns/${campaign.id}/voice-simulator`}
                className="inline-flex items-center justify-center rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-700 hover:bg-violet-100"
              >
                🎙 Voice Simulator
              </Link>

            <Button
              size="sm"
              variant="secondary"
              loading={exporting}
              onClick={handleExport}
            >
              ⬇ Export CSV
            </Button>
          </div>
        </div>

        {/* Summary stats */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard
              label="Contacts"
              value={summary.totals.contacts}
              accent
            />
            <StatCard label="Calls" value={summary.totals.calls} />
            <StatCard label="Completed" value={summary.totals.completed} />
            <StatCard
              label="Callbacks"
              value={summary.leadStatus.callbackRequested}
            />
            <StatCard
              label="Positive"
              value={summary.sentiment.positive}
            />
            <StatCard
              label="Avg confidence"
              value={
                summary.quality.averageConfidence !== null
                  ? `${(summary.quality.averageConfidence * 100).toFixed(0)}%`
                  : "—"
              }
            />
          </div>
        )}

        {/* Add call */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-900">
              Calls
              <span className="ml-2 text-slate-400 font-normal text-sm">
                ({calls.length})
              </span>
            </h2>
            <Button size="sm" onClick={() => setShowCallForm(!showCallForm)}>
              {showCallForm ? "Cancel" : "+ Add call"}
            </Button>
          </div>

          {showCallForm && (
            <div className="border border-slate-100 rounded-xl bg-slate-50 p-4 mb-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">
                New call record
              </h3>
              <form onSubmit={handleCreateCall} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">
                    Contact
                  </label>
                  <select
                    value={callForm.contactId}
                    onChange={(e) =>
                      setCallForm({ ...callForm, contactId: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    required
                  >
                    <option value="">Select a contact…</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — {c.phone}
                      </option>
                    ))}
                  </select>
                </div>
                <Textarea
                  label="Transcript (optional)"
                  placeholder="Paste the call transcript here. You can also add it later and click Extract Outcome."
                  rows={5}
                  value={callForm.transcript}
                  onChange={(e) =>
                    setCallForm({ ...callForm, transcript: e.target.value })
                  }
                />
                {callError && (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
                    {callError}
                  </div>
                )}
                <div className="flex gap-3">
                  <Button type="submit" loading={callSubmitting} size="sm">
                    Save call
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    onClick={() => setShowCallForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Calls table */}
          {calls.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <div className="text-3xl">📞</div>
              <p className="text-slate-600 font-medium text-sm">No calls yet</p>
              <p className="text-xs text-slate-400">
                Add a transcript to test AI extraction
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-3 text-left text-xs font-medium text-slate-500 pr-4">
                      Contact
                    </th>
                    <th className="pb-3 text-left text-xs font-medium text-slate-500 pr-4">
                      Status
                    </th>
                    <th className="pb-3 text-left text-xs font-medium text-slate-500 pr-4">
                      Sentiment
                    </th>
                    <th className="pb-3 text-left text-xs font-medium text-slate-500 pr-4">
                      Lead status
                    </th>
                    <th className="pb-3 text-left text-xs font-medium text-slate-500 pr-4">
                      Callback
                    </th>
                    <th className="pb-3 text-left text-xs font-medium text-slate-500 pr-4">
                      Confidence
                    </th>
                    <th className="pb-3 text-left text-xs font-medium text-slate-500 pr-4">
                      Next action
                    </th>
                    <th className="pb-3 text-right text-xs font-medium text-slate-500">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((call) => (
                    <tr
                      key={call.id}
                      className="border-b border-slate-50 last:border-0"
                    >
                      <td className="py-3 pr-4 font-medium text-slate-900">
                        {getContactName(call.contactId)}
                      </td>
                      <td className="py-3 pr-4">{statusBadge(call.status)}</td>
                      <td className="py-3 pr-4">
                        {sentimentBadge(call.outcome?.sentiment) ?? (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <LeadStatusBadge status={call.outcome?.leadStatus} />
                      </td>
                      <td className="py-3 pr-4 text-slate-500 text-xs">
                        {call.outcome?.callbackTime ?? "—"}
                      </td>
                      <td className="py-3 pr-4 text-slate-600 text-xs font-mono">
                        {call.outcome
                          ? `${(call.outcome.confidence * 100).toFixed(0)}%`
                          : "—"}
                      </td>
                      <td className="py-3 pr-4 text-slate-500 text-xs max-w-[180px] truncate">
                        {call.outcome?.nextAction ?? "—"}
                      </td>
                      <td className="py-3 text-right">
                        {call.status === "pending" ? (
                          <Link
                            href={`/campaigns/${id}/voice-simulator?callId=${call.id}&contactId=${getContactId(call.contactId)}`}
                            className="inline-flex items-center justify-center rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100"
                          >
                            🎙 Start Simulation
                          </Link>
                        ) : null}
                        <Button
                          size="sm"
                          variant={
                            call.status === "completed"
                              ? "ghost"
                              : "primary"
                          }
                          loading={extractingId === call.id}
                          disabled={
                            call.status === "processing" ||
                            extractingId === call.id
                          }
                          onClick={() => handleExtract(call.id)}
                        >
                          {call.status === "completed"
                            ? "Re-extract"
                            : "✨ Extract"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Outcome summaries */}
        {calls.filter((c) => c.outcome?.summary).length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-slate-900 mb-3">
              AI summaries
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {calls
                .filter((c) => c.outcome?.summary)
                .map((call) => (
                  <Card key={call.id} padding="sm">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-slate-700">
                        {getContactName(call.contactId)}
                      </p>
                      <div className="flex items-center gap-1.5">
                        {sentimentBadge(call.outcome?.sentiment)}
                        <LeadStatusBadge status={call.outcome?.leadStatus} />
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {call.outcome?.summary}
                    </p>
                    {call.outcome?.nextAction && (
                      <div className="mt-2 pt-2 border-t border-slate-50">
                        <p className="text-xs text-slate-400">
                          <span className="font-medium text-slate-600">
                            Next:{" "}
                          </span>
                          {call.outcome.nextAction}
                        </p>
                      </div>
                    )}
                  </Card>
                ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
