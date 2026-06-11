import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { extractOutcomeController } from "./ai.controller.js";

export const aiRoutes = Router();

aiRoutes.use(requireAuth);

aiRoutes.post("/extract-outcome", asyncHandler(extractOutcomeController));
