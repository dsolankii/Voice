import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { parse } from "csv-parse/sync";
import { ContactModel } from "./contact.model.js";
import {
  createContactSchema,
  type CreateContactInput,
} from "./contact.schemas.js";

function toSafeContact(contact: {
  _id: unknown;
  name: string;
  phone: string;
  email?: string | null;
  company?: string | null;
  notes?: string | null;
  source?: string | null;
  uploadBatchId?: string | null;
  createdBy: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}) {
  return {
    id: String(contact._id),
    name: contact.name,
    phone: contact.phone,
    email: contact.email || null,
    company: contact.company || null,
    notes: contact.notes || null,
    source: contact.source || null,
    uploadBatchId: contact.uploadBatchId || null,
    createdBy: String(contact.createdBy),
    createdAt: contact.createdAt,
    updatedAt: contact.updatedAt,
  };
}

function assertValidObjectId(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error("Invalid contact id");
    error.name = "BadRequestError";
    throw error;
  }
}

function normalizeHeader(header: string) {
  return header.trim().toLowerCase().replace(/\s+/g, "_");
}

function pick(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function mapCsvRowToContact(row: Record<string, unknown>) {
  return {
    name: pick(row, ["name", "full_name", "fullname", "contact_name"]),
    phone: pick(row, ["phone", "mobile", "phone_number", "number", "contact_number"]),
    email: pick(row, ["email", "mail", "email_address"]),
    company: pick(row, ["company", "organization", "organisation", "business"]),
    notes: pick(row, ["notes", "note", "remarks", "description"]),
  };
}

export async function createContact(userId: string, input: CreateContactInput) {
  const contact = await ContactModel.create({
    ...input,
    source: "manual",
    createdBy: userId,
  });

  return toSafeContact(contact);
}

export async function uploadContactsFromCsv(userId: string, fileBuffer: Buffer) {
  const content = fileBuffer.toString("utf-8");
  const uploadBatchId = randomUUID();

  const rows = parse(content, {
    columns: (headers: string[]) => headers.map(normalizeHeader),
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, unknown>[];

  const contactsToCreate = [];
  const skippedRows: Array<{ rowNumber: number; reason: string }> = [];

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;

    try {
      const mapped = mapCsvRowToContact(row);
      const parsed = createContactSchema.parse(mapped);

      contactsToCreate.push({
        ...parsed,
        source: "csv",
        uploadBatchId,
        createdBy: userId,
      });
    } catch {
      skippedRows.push({
        rowNumber,
        reason:
          "Invalid or missing required fields. Required: name and phone. Email must be valid if provided.",
      });
    }
  }

  const createdContacts =
    contactsToCreate.length > 0
      ? await ContactModel.insertMany(contactsToCreate)
      : [];

  return {
    uploadBatchId,
    totalRows: rows.length,
    createdCount: createdContacts.length,
    skippedCount: skippedRows.length,
    skippedRows,
    contacts: createdContacts.map(toSafeContact),
  };
}

export async function listContacts(userId: string) {
  const contacts = await ContactModel.find({
    createdBy: userId,
  }).sort({
    createdAt: -1,
  });

  return contacts.map(toSafeContact);
}

export async function getContactById(userId: string, contactId: string) {
  assertValidObjectId(contactId);

  const contact = await ContactModel.findOne({
    _id: contactId,
    createdBy: userId,
  });

  if (!contact) {
    const error = new Error("Contact not found");
    error.name = "NotFoundError";
    throw error;
  }

  return toSafeContact(contact);
}

export async function deleteContact(userId: string, contactId: string) {
  assertValidObjectId(contactId);

  const contact = await ContactModel.findOneAndDelete({
    _id: contactId,
    createdBy: userId,
  });

  if (!contact) {
    const error = new Error("Contact not found");
    error.name = "NotFoundError";
    throw error;
  }

  return toSafeContact(contact);
}
