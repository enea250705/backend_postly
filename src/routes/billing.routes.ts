import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/async";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../config/db";
import { getCreditStatus } from "../services/ai/credits";

export const billingRouter = Router();

const PLANS = [
  {
    id: "FREE",
    name: "Starter",
    price: 0,
    weeklyAICredits: 10,
    platforms: 1,
    features: ["Hook + caption generator", "1 connected platform", "Manual scheduling"],
  },
  {
    id: "CREATOR",
    name: "Creator",
    price: 9,
    weeklyAICredits: 200,
    platforms: 3,
    features: [
      "Everything in Starter",
      "3 platforms",
      "Auto-growth engine",
      "Explainable analytics",
      "Smart scheduler with best-time AI",
    ],
  },
  {
    id: "PRO",
    name: "Pro",
    price: 19,
    weeklyAICredits: "unlimited",
    platforms: "all 8",
    features: [
      "Everything in Creator",
      "All 8 platforms",
      "Auto reply + DM funnels",
      "Monetization assistant",
      "Weekly adaptive learning",
    ],
  },
];

billingRouter.get("/plans", (_req, res) => res.json(PLANS));

billingRouter.get(
  "/status",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await getCreditStatus(req.user!.sub));
  }),
);

// Skeleton plan switch — in production this is a Stripe webhook target.
billingRouter.post(
  "/upgrade",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { plan } = z.object({ plan: z.enum(["FREE", "CREATOR", "PRO"]) }).parse(req.body);
    const updated = await prisma.user.update({
      where: { id: req.user!.sub },
      data: { plan },
      select: { id: true, plan: true },
    });
    res.json(updated);
  }),
);
