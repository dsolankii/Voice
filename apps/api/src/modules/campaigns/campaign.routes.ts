import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  createCampaignController,
  deleteCampaignController,
  getCampaignController,
  listCampaignsController,
  updateCampaignController,
} from "./campaign.controller.js";

export const campaignRoutes = Router();

campaignRoutes.use(requireAuth);

campaignRoutes.post("/", asyncHandler(createCampaignController));
campaignRoutes.get("/", asyncHandler(listCampaignsController));
campaignRoutes.get("/:id", asyncHandler(getCampaignController));
campaignRoutes.patch("/:id", asyncHandler(updateCampaignController));
campaignRoutes.delete("/:id", asyncHandler(deleteCampaignController));
