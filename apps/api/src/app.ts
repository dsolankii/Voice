import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { agentRoutes } from "./modules/agents/agent.routes.js";
import { aiRoutes } from "./modules/ai/ai.routes.js";
import { contactRoutes } from "./modules/contacts/contact.routes.js";
import { contactListRoutes } from "./modules/contact-lists/contact-list.routes.js";
import { campaignRoutes } from "./modules/campaigns/campaign.routes.js";
import { callRoutes } from "./modules/calls/call.routes.js";
import { errorMiddleware } from "./middleware/error.middleware.js";

export const app = express();

app.use(
  cors({
    origin: env.corsOrigin,
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "voice-ai-api",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/agents", agentRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/contacts", contactRoutes);
app.use("/api/contact-lists", contactListRoutes);
app.use("/api/campaigns", campaignRoutes);
app.use("/api/calls", callRoutes);

app.use(errorMiddleware);
