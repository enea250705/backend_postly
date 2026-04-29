import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { HttpError } from "../utils/errors";
import { logger } from "../config/logger";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: "ValidationError", issues: err.flatten() });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }
  logger.error({ err }, "unhandled error");
  res.status(500).json({ error: "InternalServerError" });
};

export const notFoundHandler = (_req: any, res: any) => {
  res.status(404).json({ error: "NotFound" });
};
