import mongoose from "mongoose";
import { extractCallOutcome } from "../ai/extraction.service.js";
import { CampaignModel } from "../campaigns/campaign.model.js";
import { ContactModel } from "../contacts/contact.model.js";
import { CallModel } from "./call.model.js";
import type { CreateCallInput, UpdateCallInput } from "./call.schemas.js";

type CallLike = {
  _id: unknown;
  campaignId: unknown;
  agentId: unknown;
  contactId: unknown;
  transcript?: string | null;
  status?: string | null;
  outcome?: unknown;
  outcomeExtractedAt?: unknown;
  errorMessage?: string | null;
  createdBy: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

function toSafeCall(call: CallLike) {
  return {
    id: String(call._id),
    campaignId: String(call.campaignId),
    agentId: String(call.agentId),
    contactId: String(call.contactId),
    transcript: call.transcript || null,
    status: call.status || "pending",
    outcome: call.outcome || null,
    outcomeExtractedAt: call.outcomeExtractedAt || null,
    errorMessage: call.errorMessage || null,
    createdBy: String(call.createdBy),
    createdAt: call.createdAt,
    updatedAt: call.updatedAt,
  };
}

function assertValidObjectId(id: string, label: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error(`Invalid ${label}`);
    error.name = "BadRequestError";
    throw error;
  }
}

async function getCampaignForUser(userId: string, campaignId: string) {
  assertValidObjectId(campaignId, "campaign id");

  const campaign = await CampaignModel.findOne({
    _id: campaignId,
    createdBy: userId,
  }).lean<{
    _id: unknown;
    agentId: unknown;
    contactIds?: unknown[];
  }>();

  if (!campaign) {
    const error = new Error("Campaign not found");
    error.name = "NotFoundError";
    throw error;
  }

  return campaign;
}

async function validateContactForCampaign(
  userId: string,
  campaign: { contactIds?: unknown[] },
  contactId: string
) {
  assertValidObjectId(contactId, "contact id");

  const campaignContactIds = Array.isArray(campaign.contactIds)
    ? campaign.contactIds.map((id) => String(id))
    : [];

  if (!campaignContactIds.includes(contactId)) {
    const error = new Error("Contact is not part of this campaign");
    error.name = "BadRequestError";
    throw error;
  }

  const contact = await ContactModel.findOne({
    _id: contactId,
    createdBy: userId,
  });

  if (!contact) {
    const error = new Error("Contact not found");
    error.name = "NotFoundError";
    throw error;
  }

  return contact;
}

export async function createCall(userId: string, input: CreateCallInput) {
  const campaign = await getCampaignForUser(userId, input.campaignId);

  await validateContactForCampaign(userId, campaign, input.contactId);

  const call = await CallModel.create({
    campaignId: input.campaignId,
    agentId: String(campaign.agentId),
    contactId: input.contactId,
    transcript: input.transcript,
    status: input.transcript ? "transcript_ready" : "pending",
    createdBy: userId,
  });

  return toSafeCall(call.toObject());
}

export async function listCalls(userId: string, filters?: { campaignId?: string }) {
  const query: Record<string, unknown> = {
    createdBy: userId,
  };

  if (filters?.campaignId) {
    assertValidObjectId(filters.campaignId, "campaign id");
    query.campaignId = filters.campaignId;
  }

  const calls = await CallModel.find(query)
    .sort({
      createdAt: -1,
    })
    .lean<CallLike[]>();

  return calls.map(toSafeCall);
}

export async function getCallById(userId: string, callId: string) {
  assertValidObjectId(callId, "call id");

  const call = await CallModel.findOne({
    _id: callId,
    createdBy: userId,
  }).lean<CallLike>();

  if (!call) {
    const error = new Error("Call not found");
    error.name = "NotFoundError";
    throw error;
  }

  return toSafeCall(call);
}

export async function updateCall(
  userId: string,
  callId: string,
  input: UpdateCallInput
) {
  assertValidObjectId(callId, "call id");

  const updateData: Record<string, unknown> = {
    ...input,
  };

  if (input.transcript && !input.status) {
    updateData.status = "transcript_ready";
    updateData.errorMessage = null;
  }

  const call = await CallModel.findOneAndUpdate(
    {
      _id: callId,
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

  if (!call) {
    const error = new Error("Call not found");
    error.name = "NotFoundError";
    throw error;
  }

  return toSafeCall(call.toObject());
}

export async function extractOutcomeForCall(userId: string, callId: string) {
  assertValidObjectId(callId, "call id");

  const call = await CallModel.findOne({
    _id: callId,
    createdBy: userId,
  });

  if (!call) {
    const error = new Error("Call not found");
    error.name = "NotFoundError";
    throw error;
  }

  if (!call.transcript || call.transcript.trim().length < 20) {
    const error = new Error("Call transcript is required before extraction");
    error.name = "BadRequestError";
    throw error;
  }

  try {
    call.status = "processing";
    call.errorMessage = null;
    await call.save();

    const outcome = await extractCallOutcome(userId, {
      agentId: String(call.agentId),
      transcript: call.transcript,
    });

    call.outcome = outcome;
    call.status = "completed";
    call.outcomeExtractedAt = new Date();
    call.errorMessage = null;

    await call.save();

    return toSafeCall(call.toObject());
  } catch (error) {
    call.status = "failed";
    call.errorMessage =
      error instanceof Error ? error.message : "Outcome extraction failed";
    await call.save();

    throw error;
  }
}

export async function deleteCall(userId: string, callId: string) {
  assertValidObjectId(callId, "call id");

  const call = await CallModel.findOneAndDelete({
    _id: callId,
    createdBy: userId,
  });

  if (!call) {
    const error = new Error("Call not found");
    error.name = "NotFoundError";
    throw error;
  }

  return toSafeCall(call.toObject());
}
