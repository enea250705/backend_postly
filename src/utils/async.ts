import type { NextFunction, Request, Response } from "express";

export const asyncHandler =
  <T = unknown>(fn: (req: Request, res: Response, next: NextFunction) => Promise<T>) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);
