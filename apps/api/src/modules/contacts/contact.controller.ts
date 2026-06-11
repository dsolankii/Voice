import type { Response } from "express";
import type { AuthRequest } from "../../middleware/auth.middleware.js";
import { createContactSchema } from "./contact.schemas.js";
import {
  createContact,
  deleteContact,
  getContactById,
  listContacts,
  uploadContactsFromCsv,
} from "./contact.service.js";

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

export async function createContactController(req: AuthRequest, res: Response) {
  const userId = getRequiredUserId(req);
  const input = createContactSchema.parse(req.body);
  const contact = await createContact(userId, input);

  return res.status(201).json({
    contact,
  });
}

export async function uploadContactsController(req: AuthRequest, res: Response) {
  const userId = getRequiredUserId(req);

  if (!req.file) {
    const error = new Error("CSV file is required. Use form field name: file");
    error.name = "BadRequestError";
    throw error;
  }

  const result = await uploadContactsFromCsv(userId, req.file.buffer);

  return res.status(201).json(result);
}

export async function listContactsController(req: AuthRequest, res: Response) {
  const userId = getRequiredUserId(req);
  const contacts = await listContacts(userId);

  return res.json({
    contacts,
  });
}

export async function getContactController(req: AuthRequest, res: Response) {
  const userId = getRequiredUserId(req);
  const contactId = getRequiredParam(req.params.id, "contact id");
  const contact = await getContactById(userId, contactId);

  return res.json({
    contact,
  });
}

export async function deleteContactController(req: AuthRequest, res: Response) {
  const userId = getRequiredUserId(req);
  const contactId = getRequiredParam(req.params.id, "contact id");
  const contact = await deleteContact(userId, contactId);

  return res.json({
    contact,
  });
}
