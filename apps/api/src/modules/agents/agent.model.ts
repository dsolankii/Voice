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
      maxlength: 6000,
    },
    companyContext: {
      type: String,
      required: false,
      default: "",
      trim: true,
      maxlength: 6000,
    },
    callObjective: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 4000,
    },
    openingMessage: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 2500,
    },
    closingMessage: {
      type: String,
      required: false,
      default: "Thanks for your time. Have a great day. Goodbye.",
      trim: true,
      maxlength: 1200,
    },
    conversationGuidelines: {
      type: String,
      required: false,
      default: "",
      trim: true,
      maxlength: 8000,
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
    voiceName: {
      type: String,
      required: true,
      default: "Kore",
      enum: [
        "Kore",
        "Puck",
        "Charon",
        "Fenrir",
        "Achird",
        "Sulafat",
        "Despina",
      ],
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
