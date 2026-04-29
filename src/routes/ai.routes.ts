import { Router } from "express";
import { z } from "zod";
import { Platform } from "@prisma/client";
import { asyncHandler } from "../utils/async";
import {
  generateCaptionsForUser,
  generateHooksForUser,
  repurposeIdea,
} from "../services/content.service";

export const aiRouter = Router();

const platformEnum = z.nativeEnum(Platform);

aiRouter.post(
  "/hooks",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        niche: z.string(),
        topic: z.string().optional(),
        platform: platformEnum,
        count: z.number().int().min(1).max(12).optional(),
      })
      .parse(req.body);
    const out = await generateHooksForUser(req.user!.sub, body);
    res.json({ hooks: out });
  }),
);

aiRouter.post(
  "/captions",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        niche: z.string(),
        hook: z.string(),
        platform: platformEnum,
        goal: z.string().optional(),
        count: z.number().int().min(1).max(6).optional(),
      })
      .parse(req.body);
    res.json(await generateCaptionsForUser(req.user!.sub, body));
  }),
);

aiRouter.post(
  "/repurpose",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        idea: z.string(),
        niche: z.string(),
        platforms: z.array(z.string()).optional(),
        tone: z.string().optional(),
      })
      .parse(req.body);
    res.json(await repurposeIdea(req.user!.sub, body));
  }),
);
