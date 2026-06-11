import mongoose from "mongoose";
import { getAgentById } from "../agents/agent.service.js";
import { ContactModel } from "../contacts/contact.model.js";
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
