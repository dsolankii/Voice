import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  createAgentController,
  deleteAgentController,
  getAgentController,
  listAgentsController,
  updateAgentController,
} from "./agent.controller.js";

export const agentRoutes = Router();

agentRoutes.use(requireAuth);

agentRoutes.post("/", asyncHandler(createAgentController));
agentRoutes.get("/", asyncHandler(listAgentsController));
agentRoutes.get("/:id", asyncHandler(getAgentController));
agentRoutes.patch("/:id", asyncHandler(updateAgentController));
agentRoutes.delete("/:id", asyncHandler(deleteAgentController));
