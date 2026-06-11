import type { Response } from "express";
import type { AuthRequest } from "../../middleware/auth.middleware.js";
import {
  createAgent,
  deleteAgent,
  getAgentById,
  listAgents,
  updateAgent,
} from "./agent.service.js";
import { createAgentSchema, updateAgentSchema } from "./agent.schemas.js";

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

export async function createAgentController(req: AuthRequest, res: Response) {
  const userId = getRequiredUserId(req);
  const input = createAgentSchema.parse(req.body);
  const agent = await createAgent(userId, input);

  return res.status(201).json({
    agent,
  });
}

export async function listAgentsController(req: AuthRequest, res: Response) {
  const userId = getRequiredUserId(req);
  const agents = await listAgents(userId);

  return res.json({
    agents,
  });
}

export async function getAgentController(req: AuthRequest, res: Response) {
  const userId = getRequiredUserId(req);
  const agentId = getRequiredParam(req.params.id, "agent id");
  const agent = await getAgentById(userId, agentId);

  return res.json({
    agent,
  });
}

export async function updateAgentController(req: AuthRequest, res: Response) {
  const userId = getRequiredUserId(req);
  const agentId = getRequiredParam(req.params.id, "agent id");
  const input = updateAgentSchema.parse(req.body);
  const agent = await updateAgent(userId, agentId, input);

  return res.json({
    agent,
  });
}

export async function deleteAgentController(req: AuthRequest, res: Response) {
  const userId = getRequiredUserId(req);
  const agentId = getRequiredParam(req.params.id, "agent id");
  const agent = await deleteAgent(userId, agentId);

  return res.json({
    agent,
  });
}
