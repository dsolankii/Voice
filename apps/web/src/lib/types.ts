export type User = {
  id: string;
  name: string;
  email: string;
};

export type Agent = {
  id: string;
  name: string;
  persona: string;
  companyContext: string;
  callObjective: string;
  openingMessage: string;
  language: string;
  voiceStyle: "professional" | "friendly" | "casual" | "empathetic" | "energetic";
  status: "active" | "archived";
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type Contact = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  company?: string | null;
  notes?: string | null;
  source?: "manual" | "csv" | string | null;
  uploadBatchId?: string | null;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type Campaign = {
  id: string;
  name: string;
  description?: string | null;
  objective: string;
  agentId: string;
  contactIds: string[];
  contactCount: number;
  status: "draft" | "running" | "completed" | "archived";
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type CallOutcome = {
  summary: string;
  sentiment: "positive" | "neutral" | "negative" | "mixed";
  intent: string;
  leadStatus:
    | "interested"
    | "not_interested"
    | "callback_requested"
    | "wrong_number"
    | "no_answer"
    | "needs_more_info"
    | "unknown";
  callbackTime?: string | null;
  objections: string[];
  nextAction: string;
  confidence: number;
};

export type Call = {
  id: string;
  campaignId: string;
  agentId: string;
  contactId: string;
  transcript?: string | null;
  status: "pending" | "transcript_ready" | "processing" | "completed" | "failed";
  outcome?: CallOutcome | null;
  outcomeExtractedAt?: string | null;
  errorMessage?: string | null;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type CampaignSummary = {
  campaign: Campaign;
  totals: {
    contacts: number;
    calls: number;
    pending: number;
    transcriptReady: number;
    processing: number;
    completed: number;
    failed: number;
  };
  leadStatus: {
    interested: number;
    notInterested: number;
    callbackRequested: number;
    wrongNumber: number;
    noAnswer: number;
    needsMoreInfo: number;
    unknown: number;
  };
  sentiment: {
    positive: number;
    neutral: number;
    negative: number;
    mixed: number;
  };
  quality: {
    averageConfidence: number | null;
    analyzedCalls: number;
  };
};

export type UploadContactsResult = {
  uploadBatchId: string;
  totalRows: number;
  createdCount: number;
  skippedCount: number;
  skippedRows: Array<{
    rowNumber: number;
    reason: string;
  }>;
  contacts: Contact[];
};

export type UploadResult = UploadContactsResult;
