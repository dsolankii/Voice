import type { Request, Response } from "express";
import type { AuthRequest } from "../../middleware/auth.middleware.js";
import { getUserById, login, signup } from "./auth.service.js";
import { loginSchema, signupSchema } from "./auth.schemas.js";

export async function signupController(req: Request, res: Response) {
  const input = signupSchema.parse(req.body);
  const result = await signup(input);

  return res.status(201).json(result);
}

export async function loginController(req: Request, res: Response) {
  const input = loginSchema.parse(req.body);
  const result = await login(input);

  return res.json(result);
}

export async function meController(req: AuthRequest, res: Response) {
  if (!req.userId) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  const user = await getUserById(req.userId);

  return res.json({
    user,
  });
}
