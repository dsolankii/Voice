import mongoose from "mongoose";
import { uploadContactsFromCsv } from "../contacts/contact.service.js";
import { ContactListModel } from "./contact-list.model.js";
import type { UploadContactListInput } from "./contact-list.schemas.js";

type ContactListLike = {
  _id: unknown;
  name: string;
  description?: string | null;
  uploadBatchId: string;
  contactIds?: unknown[] | null;
  createdBy: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

function toSafeContactList(contactList: ContactListLike) {
  return {
    id: String(contactList._id),
    name: contactList.name,
    description: contactList.description || null,
    uploadBatchId: contactList.uploadBatchId,
    contactIds: Array.isArray(contactList.contactIds)
      ? contactList.contactIds.map((contactId) => String(contactId))
      : [],
    contactCount: Array.isArray(contactList.contactIds)
      ? contactList.contactIds.length
      : 0,
    createdBy: String(contactList.createdBy),
    createdAt: contactList.createdAt,
    updatedAt: contactList.updatedAt,
  };
}

function assertValidObjectId(id: string, label: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error(`Invalid ${label}`);
    error.name = "BadRequestError";
    throw error;
  }
}

export async function uploadContactListFromCsv(
  userId: string,
  input: UploadContactListInput,
  fileBuffer: Buffer
) {
  const uploadResult = await uploadContactsFromCsv(userId, fileBuffer);

  if (uploadResult.createdCount === 0) {
    const error = new Error("No valid contacts were found in the CSV file");
    error.name = "BadRequestError";
    throw error;
  }

  const contactList = await ContactListModel.create({
    name: input.name,
    description: input.description,
    uploadBatchId: uploadResult.uploadBatchId,
    contactIds: uploadResult.contacts.map((contact) => contact.id),
    createdBy: userId,
  });

  return {
    contactList: toSafeContactList(contactList.toObject()),
    upload: uploadResult,
  };
}

export async function listContactLists(userId: string) {
  const contactLists = await ContactListModel.find({
    createdBy: userId,
  })
    .sort({
      createdAt: -1,
    })
    .lean<ContactListLike[]>();

  return contactLists.map(toSafeContactList);
}

export async function getContactListById(userId: string, contactListId: string) {
  assertValidObjectId(contactListId, "contact list id");

  const contactList = await ContactListModel.findOne({
    _id: contactListId,
    createdBy: userId,
  }).lean<ContactListLike>();

  if (!contactList) {
    const error = new Error("Contact list not found");
    error.name = "NotFoundError";
    throw error;
  }

  return toSafeContactList(contactList);
}

export async function deleteContactList(userId: string, contactListId: string) {
  assertValidObjectId(contactListId, "contact list id");

  const contactList = await ContactListModel.findOneAndDelete({
    _id: contactListId,
    createdBy: userId,
  });

  if (!contactList) {
    const error = new Error("Contact list not found");
    error.name = "NotFoundError";
    throw error;
  }

  return toSafeContactList(contactList.toObject());
}
