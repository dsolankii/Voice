import { Router } from "express";
import {
  loginController,
  meController,
  signupController,
} from "./auth.controller.js";
import { requireAuth } from "../../middleware/auth.middleware.js";
import { asyncHandler } from "../../utils/async-handler.js";

export const authRoutes = Router();

authRoutes.post("/signup", asyncHandler(signupController));
authRoutes.post("/login", asyncHandler(loginController));
authRoutes.get("/me", requireAuth, asyncHandler(meController));
