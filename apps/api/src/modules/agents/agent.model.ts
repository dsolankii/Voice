import mongoose, { Schema, type InferSchemaType } from "mongoose";

const agentSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    persona: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 2000,
    },
    companyContext: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 3000,
    },
    callObjective: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 2000,
    },
    openingMessage: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 1000,
    },
    language: {
      type: String,
      required: true,
      default: "en",
      trim: true,
    },
    voiceStyle: {
      type: String,
      required: true,
      default: "professional",
      enum: ["professional", "friendly", "casual", "empathetic", "energetic"],
    },
    status: {
      type: String,
      required: true,
      default: "active",
      enum: ["active", "archived"],
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

export type Agent = InferSchemaType<typeof agentSchema>;

export const AgentModel = mongoose.model("Agent", agentSchema);
