import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { Unauthorized } from "../utils/errors";

export interface AuthPayload {
  sub: string;
  plan: "FREE" | "CREATOR" | "PRO";
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export const requireAuth = (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next(Unauthorized());
  const token = header.slice("Bearer ".length);
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
    req.user = decoded;
    next();
  } catch {
    next(Unauthorized("Invalid or expired token"));
  }
};

export const requirePlan =
  (...plans: AuthPayload["plan"][]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(Unauthorized());
    if (!plans.includes(req.user.plan))
      return next(Unauthorized(`Requires plan: ${plans.join(" or ")}`));
    next();
  };
