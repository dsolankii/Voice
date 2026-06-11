import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  createCallController,
  deleteCallController,
  extractOutcomeForCallController,
  getCallController,
  listCallsController,
  updateCallController,
} from "./call.controller.js";

export const callRoutes = Router();

callRoutes.use(requireAuth);

callRoutes.post("/", asyncHandler(createCallController));
callRoutes.get("/", asyncHandler(listCallsController));
callRoutes.get("/:id", asyncHandler(getCallController));
callRoutes.patch("/:id", asyncHandler(updateCallController));
callRoutes.post("/:id/extract-outcome", asyncHandler(extractOutcomeForCallController));
callRoutes.delete("/:id", asyncHandler(deleteCallController));
