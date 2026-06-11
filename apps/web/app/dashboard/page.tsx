"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { getAgents, getCampaigns, getCalls, getContacts } from "@/lib/api";

const MVP_STEPS = [
  {
    num: "01",
    title: "Create an agent",
    desc: "Define your AI caller's persona, objective, and voice style.",
    href: "/agents",
    cta: "Go to Agents",
  },
  {
    num: "02",
    title: "Upload contacts",
    desc: "Import your lead list as a CSV file.",
    href: "/contacts",
    cta: "Go to Contacts",
  },
  {
    num: "03",
    title: "Create a campaign",
    desc: "Combine an agent with a contact list to launch a campaign.",
    href: "/campaigns",
    cta: "Go to Campaigns",
  },
  {
    num: "04",
    title: "Extract AI outcomes",
    desc: "Paste call transcripts and let Gemini AI analyze the results.",
    href: "/campaigns",
    cta: "View Campaigns",
  },
  {
    num: "05",
    title: "Export as CSV",
    desc: "Download the full campaign results with AI-extracted insights.",
    href: "/campaigns",
    cta: "View Campaigns",
  },
];

export default function DashboardPage() {
  const [stats, setStats] = useState({
    campaigns: 0,
    agents: 0,
    contacts: 0,
    calls: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      getCampaigns(),
      getAgents(),
      getContacts(),
      getCalls(),
    ]).then(([campaigns, agents, contacts, calls]) => {
      setStats({
        campaigns:
          campaigns.status === "fulfilled"
            ? campaigns.value.campaigns.length
            : 0,
        agents:
          agents.status === "fulfilled" ? agents.value.agents.length : 0,
        contacts:
          contacts.status === "fulfilled" ? contacts.value.contacts.length : 0,
        calls:
          calls.status === "fulfilled" ? calls.value.calls.length : 0,
      });
      setLoading(false);
    });
  }, []);

  return (
    <AppShell>
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            Overview of your AI voice campaign platform
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Campaigns"
            value={loading ? "—" : stats.campaigns}
            accent
            icon="📣"
          />
          <StatCard
            label="Agents"
            value={loading ? "—" : stats.agents}
            icon="🤖"
          />
          <StatCard
            label="Contacts"
            value={loading ? "—" : stats.contacts}
            icon="👥"
          />
          <StatCard
            label="Total Calls"
            value={loading ? "—" : stats.calls}
            icon="📞"
          />
        </div>

        {/* MVP Flow */}
        <div>
          <h2 className="text-base font-semibold text-slate-900 mb-4">
            Platform workflow
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {MVP_STEPS.map((step) => (
              <div
                key={step.num}
                className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex flex-col gap-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-violet-400 font-mono">
                    {step.num}
                  </span>
                  <h3 className="text-sm font-semibold text-slate-800">
                    {step.title}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed flex-1">
                  {step.desc}
                </p>
                <Link
                  href={step.href}
                  className="text-xs font-medium text-violet-600 hover:text-violet-700 flex items-center gap-1 mt-1"
                >
                  {step.cta}
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
