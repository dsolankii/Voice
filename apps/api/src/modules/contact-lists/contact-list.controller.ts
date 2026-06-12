import type { Response } from "express";
import type { AuthRequest } from "../../middleware/auth.middleware.js";
import { uploadContactListSchema } from "./contact-list.schemas.js";
import {
  deleteContactList,
  getContactListById,
  listContactLists,
  uploadContactListFromCsv,
} from "./contact-list.service.js";

function getRequiredUserId(req: AuthRequest): string {
  if (!req.userId) {
    const error = new Error("Unauthorized");
    error.name = "UnauthorizedError";
    throw error;
  }

  return req.userId;
}

function getRequiredParam(
  value: string | string[] | undefined,
  name: string
): string {
  if (!value || Array.isArray(value)) {
    const error = new Error(`Missing or invalid ${name}`);
    error.name = "BadRequestError";
    throw error;
  }

  return value;
}

export async function uploadContactListController(
  req: AuthRequest,
  res: Response
) {
  const userId = getRequiredUserId(req);

  if (!req.file) {
    const error = new Error("CSV file is required. Use form field name: file");
    error.name = "BadRequestError";
    throw error;
  }

  const input = uploadContactListSchema.parse(req.body);
  const result = await uploadContactListFromCsv(userId, input, req.file.buffer);

  return res.status(201).json(result);
}

export async function listContactListsController(
  req: AuthRequest,
  res: Response
) {
  const userId = getRequiredUserId(req);
  const contactLists = await listContactLists(userId);

  return res.json({
    contactLists,
  });
}

export async function getContactListController(
  req: AuthRequest,
  res: Response
) {
  const userId = getRequiredUserId(req);
  const contactListId = getRequiredParam(req.params.id, "contact list id");
  const contactList = await getContactListById(userId, contactListId);

  return res.json({
    contactList,
  });
}

export async function deleteContactListController(
  req: AuthRequest,
  res: Response
) {
  const userId = getRequiredUserId(req);
  const contactListId = getRequiredParam(req.params.id, "contact list id");
  const contactList = await deleteContactList(userId, contactListId);

  return res.json({
    contactList,
  });
}
