import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/db";
import { asyncHandler } from "../utils/async";
import { getCreditStatus } from "../services/ai/credits";

export const meRouter = Router();

meRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.sub },
      select: {
        id: true,
        email: true,
        displayName: true,
        niche: true,
        tone: true,
        goals: true,
        plan: true,
        createdAt: true,
      },
    });
    const credits = await getCreditStatus(req.user!.sub);
    res.json({ user, credits });
  }),
);

const patchSchema = z.object({
  displayName: z.string().optional(),
  niche: z.string().optional(),
  tone: z.string().optional(),
  goals: z.string().optional(),
});

meRouter.patch(
  "/",
  asyncHandler(async (req, res) => {
    const body = patchSchema.parse(req.body);
    const updated = await prisma.user.update({
      where: { id: req.user!.sub },
      data: body,
      select: { id: true, displayName: true, niche: true, tone: true, goals: true },
    });
    res.json(updated);
  }),
);
