import mongoose, { Schema, type InferSchemaType } from "mongoose";

const contactSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 160,
    },
    company: {
      type: String,
      trim: true,
      maxlength: 160,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    source: {
      type: String,
      enum: ["manual", "csv"],
      default: "manual",
    },
    uploadBatchId: {
      type: String,
      index: true,
    },
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

contactSchema.index({ createdBy: 1, phone: 1 });

export type Contact = InferSchemaType<typeof contactSchema>;

export const ContactModel = mongoose.model("Contact", contactSchema);
