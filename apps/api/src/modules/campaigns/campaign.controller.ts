import type { Response } from "express";
import type { AuthRequest } from "../../middleware/auth.middleware.js";
import {
  createCampaign,
  deleteCampaign,
  getCampaignById,
  listCampaigns,
  updateCampaign,
} from "./campaign.service.js";
import {
  createCampaignSchema,
  updateCampaignSchema,
} from "./campaign.schemas.js";

function getRequiredUserId(req: AuthRequest): string {
  if (!req.userId) {
    const error = new Error("Unauthorized");
    error.name = "UnauthorizedError";
    throw error;
  }

  return req.userId;
}

function getRequiredParam(value: string | string[] | undefined, name: string): string {
  if (!value || Array.isArray(value)) {
    const error = new Error(`Missing or invalid ${name}`);
    error.name = "BadRequestError";
    throw error;
  }

  return value;
}

export async function createCampaignController(req: AuthRequest, res: Response) {
  const userId = getRequiredUserId(req);
  const input = createCampaignSchema.parse(req.body);
  const campaign = await createCampaign(userId, input);

  return res.status(201).json({
    campaign,
  });
}

export async function listCampaignsController(req: AuthRequest, res: Response) {
  const userId = getRequiredUserId(req);
  const campaigns = await listCampaigns(userId);

  return res.json({
    campaigns,
  });
}

export async function getCampaignController(req: AuthRequest, res: Response) {
  const userId = getRequiredUserId(req);
  const campaignId = getRequiredParam(req.params.id, "campaign id");
  const campaign = await getCampaignById(userId, campaignId);

  return res.json({
    campaign,
  });
}

export async function updateCampaignController(req: AuthRequest, res: Response) {
  const userId = getRequiredUserId(req);
  const campaignId = getRequiredParam(req.params.id, "campaign id");
  const input = updateCampaignSchema.parse(req.body);
  const campaign = await updateCampaign(userId, campaignId, input);

  return res.json({
    campaign,
  });
}

export async function deleteCampaignController(req: AuthRequest, res: Response) {
  const userId = getRequiredUserId(req);
  const campaignId = getRequiredParam(req.params.id, "campaign id");
  const campaign = await deleteCampaign(userId, campaignId);

  return res.json({
    campaign,
  });
}
