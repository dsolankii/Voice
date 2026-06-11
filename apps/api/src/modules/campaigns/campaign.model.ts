import mongoose, { Schema, type InferSchemaType } from "mongoose";

const campaignSchema = new Schema(
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
    objective: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 2000,
    },
    agentId: {
      type: Schema.Types.ObjectId,
      ref: "Agent",
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
    status: {
      type: String,
      required: true,
      default: "draft",
      enum: ["draft", "running", "completed", "archived"],
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

campaignSchema.index({ createdBy: 1, createdAt: -1 });

export type Campaign = InferSchemaType<typeof campaignSchema>;

export const CampaignModel = mongoose.model("Campaign", campaignSchema);
