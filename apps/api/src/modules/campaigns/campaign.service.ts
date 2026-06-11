import mongoose from "mongoose";
import { getAgentById } from "../agents/agent.service.js";
import { ContactModel } from "../contacts/contact.model.js";
import { CallModel } from "../calls/call.model.js";
import { CampaignModel } from "./campaign.model.js";
import type {
  CreateCampaignInput,
  UpdateCampaignInput,
} from "./campaign.schemas.js";

type CampaignLike = {
  _id: unknown;
  name: string;
  description?: string | null;
  objective: string;
  agentId: unknown;
  contactIds?: unknown[] | null;
  status?: string | null;
  createdBy: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

function toSafeCampaign(campaign: CampaignLike) {
  return {
    id: String(campaign._id),
    name: campaign.name,
    description: campaign.description || null,
    objective: campaign.objective,
    agentId: String(campaign.agentId),
    contactIds: Array.isArray(campaign.contactIds)
      ? campaign.contactIds.map((contactId) => String(contactId))
      : [],
    contactCount: Array.isArray(campaign.contactIds)
      ? campaign.contactIds.length
      : 0,
    status: campaign.status || "draft",
    createdBy: String(campaign.createdBy),
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
  };
}

function assertValidObjectId(id: string, label: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error(`Invalid ${label}`);
    error.name = "BadRequestError";
    throw error;
  }
}

function getUniqueIds(ids: string[]) {
  return [...new Set(ids)];
}

async function validateContactsBelongToUser(userId: string, contactIds: string[]) {
  const uniqueContactIds = getUniqueIds(contactIds);

  for (const contactId of uniqueContactIds) {
    assertValidObjectId(contactId, "contact id");
  }

  const count = await ContactModel.countDocuments({
    _id: {
      $in: uniqueContactIds,
    },
    createdBy: userId,
  });

  if (count !== uniqueContactIds.length) {
    const error = new Error("One or more contacts were not found for this user");
    error.name = "BadRequestError";
    throw error;
  }

  return uniqueContactIds;
}

export async function createCampaign(
  userId: string,
  input: CreateCampaignInput
) {
  assertValidObjectId(input.agentId, "agent id");

  await getAgentById(userId, input.agentId);

  const uniqueContactIds = await validateContactsBelongToUser(
    userId,
    input.contactIds
  );

  const campaign = await CampaignModel.create({
    name: input.name,
    description: input.description,
    objective: input.objective,
    agentId: input.agentId,
    contactIds: uniqueContactIds,
    createdBy: userId,
  });

  return toSafeCampaign(campaign.toObject());
}

export async function listCampaigns(userId: string) {
  const campaigns = await CampaignModel.find({
    createdBy: userId,
  })
    .sort({
      createdAt: -1,
    })
    .lean<CampaignLike[]>();

  return campaigns.map(toSafeCampaign);
}

export async function getCampaignById(userId: string, campaignId: string) {
  assertValidObjectId(campaignId, "campaign id");

  const campaign = await CampaignModel.findOne({
    _id: campaignId,
    createdBy: userId,
  }).lean<CampaignLike>();

  if (!campaign) {
    const error = new Error("Campaign not found");
    error.name = "NotFoundError";
    throw error;
  }

  return toSafeCampaign(campaign);
}

export async function updateCampaign(
  userId: string,
  campaignId: string,
  input: UpdateCampaignInput
) {
  assertValidObjectId(campaignId, "campaign id");

  const updateData: Record<string, unknown> = {
    ...input,
  };

  if (input.agentId) {
    assertValidObjectId(input.agentId, "agent id");
    await getAgentById(userId, input.agentId);
  }

  if (input.contactIds) {
    updateData.contactIds = await validateContactsBelongToUser(
      userId,
      input.contactIds
    );
  }

  const campaign = await CampaignModel.findOneAndUpdate(
    {
      _id: campaignId,
      createdBy: userId,
    },
    {
      $set: updateData,
    },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!campaign) {
    const error = new Error("Campaign not found");
    error.name = "NotFoundError";
    throw error;
  }

  return toSafeCampaign(campaign.toObject());
}

export async function deleteCampaign(userId: string, campaignId: string) {
  assertValidObjectId(campaignId, "campaign id");

  const campaign = await CampaignModel.findOneAndDelete({
    _id: campaignId,
    createdBy: userId,
  });

  if (!campaign) {
    const error = new Error("Campaign not found");
    error.name = "NotFoundError";
    throw error;
  }

  return toSafeCampaign(campaign.toObject());
}

export async function getCampaignSummary(userId: string, campaignId: string) {
  const campaign = await getCampaignById(userId, campaignId);

  const calls = await CallModel.find({
    campaignId,
    createdBy: userId,
  }).lean<{
    status?: string | null;
    outcome?: {
      sentiment?: string | null;
      leadStatus?: string | null;
      confidence?: number | null;
    } | null;
  }[]>();

  const summary = {
    campaign,
    totals: {
      contacts: campaign.contactCount,
      calls: calls.length,
      pending: 0,
      transcriptReady: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    },
    leadStatus: {
      interested: 0,
      notInterested: 0,
      callbackRequested: 0,
      wrongNumber: 0,
      noAnswer: 0,
      needsMoreInfo: 0,
      unknown: 0,
    },
    sentiment: {
      positive: 0,
      neutral: 0,
      negative: 0,
      mixed: 0,
    },
    quality: {
      averageConfidence: null as number | null,
      analyzedCalls: 0,
    },
  };

  let confidenceSum = 0;
  let confidenceCount = 0;

  for (const call of calls) {
    switch (call.status) {
      case "pending":
        summary.totals.pending += 1;
        break;
      case "transcript_ready":
        summary.totals.transcriptReady += 1;
        break;
      case "processing":
        summary.totals.processing += 1;
        break;
      case "completed":
        summary.totals.completed += 1;
        break;
      case "failed":
        summary.totals.failed += 1;
        break;
    }

    if (!call.outcome) {
      continue;
    }

    summary.quality.analyzedCalls += 1;

    switch (call.outcome.leadStatus) {
      case "interested":
        summary.leadStatus.interested += 1;
        break;
      case "not_interested":
        summary.leadStatus.notInterested += 1;
        break;
      case "callback_requested":
        summary.leadStatus.callbackRequested += 1;
        break;
      case "wrong_number":
        summary.leadStatus.wrongNumber += 1;
        break;
      case "no_answer":
        summary.leadStatus.noAnswer += 1;
        break;
      case "needs_more_info":
        summary.leadStatus.needsMoreInfo += 1;
        break;
      default:
        summary.leadStatus.unknown += 1;
        break;
    }

    switch (call.outcome.sentiment) {
      case "positive":
        summary.sentiment.positive += 1;
        break;
      case "neutral":
        summary.sentiment.neutral += 1;
        break;
      case "negative":
        summary.sentiment.negative += 1;
        break;
      case "mixed":
        summary.sentiment.mixed += 1;
        break;
    }

    if (typeof call.outcome.confidence === "number") {
      confidenceSum += call.outcome.confidence;
      confidenceCount += 1;
    }
  }

  if (confidenceCount > 0) {
    summary.quality.averageConfidence = Number(
      (confidenceSum / confidenceCount).toFixed(2)
    );
  }

  return summary;
}

type ExportContactLike = {
  _id: unknown;
  name: string;
  phone: string;
  email?: string | null;
  company?: string | null;
  notes?: string | null;
};

type ExportCallLike = {
  _id: unknown;
  contactId: unknown;
  status?: string | null;
  transcript?: string | null;
  outcome?: {
    summary?: string | null;
    sentiment?: string | null;
    intent?: string | null;
    leadStatus?: string | null;
    callbackTime?: string | null;
    objections?: string[] | null;
    nextAction?: string | null;
    confidence?: number | null;
  } | null;
  outcomeExtractedAt?: unknown;
  createdAt?: unknown;
};

function escapeCsvValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);
  const escapedValue = stringValue.replace(/"/g, '""');

  if (
    escapedValue.includes(",") ||
    escapedValue.includes('"') ||
    escapedValue.includes("\n") ||
    escapedValue.includes("\r")
  ) {
    return `"${escapedValue}"`;
  }

  return escapedValue;
}

function formatDateForCsv(value: unknown) {
  if (!value) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

function buildCsvRow(values: unknown[]) {
  return values.map(escapeCsvValue).join(",");
}

export async function getCampaignExportCsv(userId: string, campaignId: string) {
  const campaign = await getCampaignById(userId, campaignId);

  const contacts = await ContactModel.find({
    _id: {
      $in: campaign.contactIds,
    },
    createdBy: userId,
  })
    .sort({
      createdAt: 1,
    })
    .lean<ExportContactLike[]>();

  const calls = await CallModel.find({
    campaignId,
    createdBy: userId,
  })
    .sort({
      createdAt: 1,
    })
    .lean<ExportCallLike[]>();

  const callsByContactId = new Map<string, ExportCallLike[]>();

  for (const call of calls) {
    const contactId = String(call.contactId);
    const existingCalls = callsByContactId.get(contactId) || [];
    existingCalls.push(call);
    callsByContactId.set(contactId, existingCalls);
  }

  const header = [
    "campaign_id",
    "campaign_name",
    "contact_id",
    "contact_name",
    "phone",
    "email",
    "company",
    "contact_notes",
    "call_id",
    "call_status",
    "call_created_at",
    "outcome_extracted_at",
    "summary",
    "sentiment",
    "intent",
    "lead_status",
    "callback_time",
    "objections",
    "next_action",
    "confidence",
    "transcript",
  ];

  const rows = [buildCsvRow(header)];

  for (const contact of contacts) {
    const contactId = String(contact._id);
    const contactCalls = callsByContactId.get(contactId) || [];

    if (contactCalls.length === 0) {
      rows.push(
        buildCsvRow([
          campaign.id,
          campaign.name,
          contactId,
          contact.name,
          contact.phone,
          contact.email,
          contact.company,
          contact.notes,
          "",
          "not_called",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
        ])
      );

      continue;
    }

    for (const call of contactCalls) {
      rows.push(
        buildCsvRow([
          campaign.id,
          campaign.name,
          contactId,
          contact.name,
          contact.phone,
          contact.email,
          contact.company,
          contact.notes,
          String(call._id),
          call.status,
          formatDateForCsv(call.createdAt),
          formatDateForCsv(call.outcomeExtractedAt),
          call.outcome?.summary,
          call.outcome?.sentiment,
          call.outcome?.intent,
          call.outcome?.leadStatus,
          call.outcome?.callbackTime,
          call.outcome?.objections?.join("; "),
          call.outcome?.nextAction,
          call.outcome?.confidence,
          call.transcript,
        ])
      );
    }
  }

  return rows.join("\n");
}
