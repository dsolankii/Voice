import { Router } from "express";
import { createLiveTokenController } from "./live-token.controller.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  extractOutcomeController,
  generateAgentReplyController,
} from "./ai.controller.js";

export const aiRoutes = Router();

aiRoutes.use(requireAuth);

aiRoutes.post("/extract-outcome", asyncHandler(extractOutcomeController));
aiRoutes.post("/generate-reply", asyncHandler(generateAgentReplyController));
aiRoutes.post("/live-token", asyncHandler(createLiveTokenController));
