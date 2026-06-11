import type { Response } from "express";
import type { AuthRequest } from "../../middleware/auth.middleware.js";
import {
  createCall,
  deleteCall,
  extractOutcomeForCall,
  getCallById,
  listCalls,
  updateCall,
} from "./call.service.js";
import { createCallSchema, updateCallSchema } from "./call.schemas.js";

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

function getOptionalQueryString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  return undefined;
}

export async function createCallController(req: AuthRequest, res: Response) {
  const userId = getRequiredUserId(req);
  const input = createCallSchema.parse(req.body);
  const call = await createCall(userId, input);

  return res.status(201).json({
    call,
  });
}

export async function listCallsController(req: AuthRequest, res: Response) {
  const userId = getRequiredUserId(req);
  const campaignId = getOptionalQueryString(req.query.campaignId);
  const calls = await listCalls(userId, {
    campaignId,
  });

  return res.json({
    calls,
  });
}

export async function getCallController(req: AuthRequest, res: Response) {
  const userId = getRequiredUserId(req);
  const callId = getRequiredParam(req.params.id, "call id");
  const call = await getCallById(userId, callId);

  return res.json({
    call,
  });
}

export async function updateCallController(req: AuthRequest, res: Response) {
  const userId = getRequiredUserId(req);
  const callId = getRequiredParam(req.params.id, "call id");
  const input = updateCallSchema.parse(req.body);
  const call = await updateCall(userId, callId, input);

  return res.json({
    call,
  });
}

export async function extractOutcomeForCallController(
  req: AuthRequest,
  res: Response
) {
  const userId = getRequiredUserId(req);
  const callId = getRequiredParam(req.params.id, "call id");
  const call = await extractOutcomeForCall(userId, callId);

  return res.json({
    call,
  });
}

export async function deleteCallController(req: AuthRequest, res: Response) {
  const userId = getRequiredUserId(req);
  const callId = getRequiredParam(req.params.id, "call id");
  const call = await deleteCall(userId, callId);

  return res.json({
    call,
  });
}
