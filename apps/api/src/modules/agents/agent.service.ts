import mongoose from "mongoose";
import { AgentModel } from "./agent.model.js";
import type { CreateAgentInput, UpdateAgentInput } from "./agent.schemas.js";

function toSafeAgent(agent: {
  _id: unknown;
  name: string;
  persona: string;
  companyContext: string;
  callObjective: string;
  openingMessage: string;
  language: string;
  voiceStyle: string;
  status: string;
  createdBy: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}) {
  return {
    id: String(agent._id),
    name: agent.name,
    persona: agent.persona,
    companyContext: agent.companyContext,
    callObjective: agent.callObjective,
    openingMessage: agent.openingMessage,
    language: agent.language,
    voiceStyle: agent.voiceStyle,
    status: agent.status,
    createdBy: String(agent.createdBy),
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
  };
}

function assertValidObjectId(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error("Invalid agent id");
    error.name = "BadRequestError";
    throw error;
  }
}

export async function createAgent(userId: string, input: CreateAgentInput) {
  const agent = await AgentModel.create({
    ...input,
    createdBy: userId,
  });

  return toSafeAgent(agent);
}

export async function listAgents(userId: string) {
  const agents = await AgentModel.find({
    createdBy: userId,
  }).sort({
    createdAt: -1,
  });

  return agents.map(toSafeAgent);
}

export async function getAgentById(userId: string, agentId: string) {
  assertValidObjectId(agentId);

  const agent = await AgentModel.findOne({
    _id: agentId,
    createdBy: userId,
  });

  if (!agent) {
    const error = new Error("Agent not found");
    error.name = "NotFoundError";
    throw error;
  }

  return toSafeAgent(agent);
}

export async function updateAgent(
  userId: string,
  agentId: string,
  input: UpdateAgentInput
) {
  assertValidObjectId(agentId);

  const agent = await AgentModel.findOneAndUpdate(
    {
      _id: agentId,
      createdBy: userId,
    },
    {
      $set: input,
    },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!agent) {
    const error = new Error("Agent not found");
    error.name = "NotFoundError";
    throw error;
  }

  return toSafeAgent(agent);
}

export async function deleteAgent(userId: string, agentId: string) {
  assertValidObjectId(agentId);

  const agent = await AgentModel.findOneAndDelete({
    _id: agentId,
    createdBy: userId,
  });

  if (!agent) {
    const error = new Error("Agent not found");
    error.name = "NotFoundError";
    throw error;
  }

  return toSafeAgent(agent);
}
