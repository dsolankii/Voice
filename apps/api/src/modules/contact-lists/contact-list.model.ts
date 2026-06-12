import mongoose, { Schema, type InferSchemaType } from "mongoose";

const contactListSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    uploadBatchId: {
      type: String,
      required: true,
      index: true,
    },
    contactIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Contact",
        required: true,
      },
    ],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

contactListSchema.index({ createdBy: 1, createdAt: -1 });

export type ContactList = InferSchemaType<typeof contactListSchema>;

export const ContactListModel = mongoose.model(
  "ContactList",
  contactListSchema
);
