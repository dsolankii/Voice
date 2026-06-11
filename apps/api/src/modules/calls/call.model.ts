import mongoose, { Schema, type InferSchemaType } from "mongoose";

const callOutcomeSchema = new Schema(
  {
    summary: {
      type: String,
      required: true,
    },
    sentiment: {
      type: String,
      required: true,
      enum: ["positive", "neutral", "negative", "mixed"],
    },
    intent: {
      type: String,
      required: true,
    },
    leadStatus: {
      type: String,
      required: true,
      enum: [
        "interested",
        "not_interested",
        "callback_requested",
        "wrong_number",
        "no_answer",
        "needs_more_info",
        "unknown",
      ],
    },
    callbackTime: {
      type: String,
      default: null,
    },
    objections: {
      type: [String],
      default: [],
    },
    nextAction: {
      type: String,
      required: true,
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
  },
  {
    _id: false,
  }
);

const callSchema = new Schema(
  {
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
      index: true,
    },
    agentId: {
      type: Schema.Types.ObjectId,
      ref: "Agent",
      required: true,
      index: true,
    },
    contactId: {
      type: Schema.Types.ObjectId,
      ref: "Contact",
      required: true,
      index: true,
    },
    transcript: {
      type: String,
      trim: true,
      maxlength: 30000,
    },
    status: {
      type: String,
      required: true,
      default: "pending",
      enum: ["pending", "transcript_ready", "processing", "completed", "failed"],
      index: true,
    },
    outcome: {
      type: callOutcomeSchema,
      default: null,
    },
    outcomeExtractedAt: {
      type: Date,
      default: null,
    },
    errorMessage: {
      type: String,
      default: null,
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

callSchema.index({ createdBy: 1, campaignId: 1, createdAt: -1 });
callSchema.index({ createdBy: 1, contactId: 1 });

export type Call = InferSchemaType<typeof callSchema>;

export const CallModel = mongoose.model("Call", callSchema);
