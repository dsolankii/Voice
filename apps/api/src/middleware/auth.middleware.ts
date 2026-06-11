import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export type AuthRequest = Request & {
  userId?: string;
};

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Missing or invalid authorization header",
    });
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    const payload = jwt.verify(token, env.jwtSecret);

    if (typeof payload === "string" || !payload.sub) {
      return res.status(401).json({
        message: "Invalid token payload",
      });
    }

    req.userId = String(payload.sub);
    return next();
  } catch {
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
}
