import { getToken } from "./auth";
import type {
  Agent,
  Call,
  Campaign,
  CampaignSummary,
  Contact,
  UploadResult,
  User,
} from "./types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      message = body.message ?? body.error ?? message;
    } catch {
      // ignore parse errors
    }
    throw new ApiError(message, res.status);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return res.json() as Promise<T>;
  }
  // For blob responses (CSV export)
  return res.blob() as unknown as Promise<T>;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function login(
  email: string,
  password: string
): Promise<{ user: User; token: string }> {
  return apiRequest("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function signup(
  name: string,
  email: string,
  password: string
): Promise<{ user: User; token: string }> {
  return apiRequest("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
}

export async function getMe(): Promise<{ user: User }> {
  return apiRequest("/api/auth/me");
}

// ─── Agents ──────────────────────────────────────────────────────────────────

export async function getAgents(): Promise<{ agents: Agent[] }> {
  return apiRequest("/api/agents");
}

export async function createAgent(
  data: Omit<Agent, "id" | "createdAt" | "updatedAt" | "createdBy" | "status">
): Promise<{ agent: Agent }> {
  return apiRequest("/api/agents", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateAgent(
  id: string,
  data: Partial<Agent>
): Promise<{ agent: Agent }> {
  return apiRequest(`/api/agents/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteAgent(id: string): Promise<void> {
  return apiRequest(`/api/agents/${id}`, { method: "DELETE" });
}

// ─── Contacts ────────────────────────────────────────────────────────────────

export async function getContacts(): Promise<{ contacts: Contact[] }> {
  return apiRequest("/api/contacts");
}

export async function uploadContactsCsv(
  file: File
): Promise<{ result: UploadResult }> {
  const token = getToken();
  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${BASE_URL}/api/contacts/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });

  if (!res.ok) {
    let message = `Upload failed with status ${res.status}`;
    try {
      const body = await res.json();
      message = body.message ?? body.error ?? message;
    } catch {
      // ignore
    }
    throw new ApiError(message, res.status);
  }

  return res.json();
}

export async function deleteContact(id: string): Promise<void> {
  return apiRequest(`/api/contacts/${id}`, { method: "DELETE" });
}

// ─── Campaigns ───────────────────────────────────────────────────────────────

export async function getCampaigns(): Promise<{ campaigns: Campaign[] }> {
  return apiRequest("/api/campaigns");
}

export async function createCampaign(data: {
  name: string;
  description?: string;
  objective: string;
  agentId: string;
  contactIds: string[];
}): Promise<{ campaign: Campaign }> {
  return apiRequest("/api/campaigns", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getCampaign(id: string): Promise<{ campaign: Campaign }> {
  return apiRequest(`/api/campaigns/${id}`);
}


export async function updateCampaign(
  id: string,
  data: Partial<{
    name: string;
    description: string;
    objective: string;
    agentId: string;
    contactIds: string[];
    status: Campaign["status"];
  }>
): Promise<{ campaign: Campaign }> {
  return apiRequest(`/api/campaigns/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function getCampaignSummary(
  id: string
): Promise<{ summary: CampaignSummary }> {
  return apiRequest(`/api/campaigns/${id}/summary`);
}

export async function downloadCampaignCsv(campaignId: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}/api/campaigns/${campaignId}/export`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    throw new ApiError("Export failed", res.status);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `campaign-${campaignId}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}


export async function prepareCampaignCalls(
  campaignId: string
): Promise<{
  campaignId: string;
  contactCount: number;
  existingCallContactCount: number;
  createdCount: number;
  skippedCount: number;
  calls: Call[];
}> {
  return apiRequest(`/api/campaigns/${campaignId}/prepare-calls`, {
    method: "POST",
  });
}

// ─── Calls ───────────────────────────────────────────────────────────────────

export async function getCalls(campaignId?: string): Promise<{ calls: Call[] }> {
  const qs = campaignId ? `?campaignId=${campaignId}` : "";
  return apiRequest(`/api/calls${qs}`);
}

export async function createCall(data: {
  campaignId: string;
  contactId: string;
  transcript?: string;
}): Promise<{ call: Call }> {
  return apiRequest("/api/calls", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function extractCallOutcome(callId: string): Promise<{ call: Call }> {
  return apiRequest(`/api/calls/${callId}/extract-outcome`, { method: "POST" });
}

export async function deleteCall(id: string): Promise<void> {
  return apiRequest(`/api/calls/${id}`, { method: "DELETE" });
}
