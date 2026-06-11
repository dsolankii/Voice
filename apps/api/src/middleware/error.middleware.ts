import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export function errorMiddleware(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error(error);

  if (error instanceof ZodError) {
    return res.status(400).json({
      message: "Validation failed",
      issues: error.issues,
    });
  }

  if (error instanceof Error) {
    if (error.name === "ConflictError") {
      return res.status(409).json({
        message: error.message,
      });
    }

    if (error.name === "UnauthorizedError") {
      return res.status(401).json({
        message: error.message,
      });
    }

    return res.status(500).json({
      message: error.message || "Internal server error",
    });
  }

  return res.status(500).json({
    message: "Internal server error",
  });
}
