import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/async";
import {
  consumeRecommendation,
  listRecommendations,
  runInsights,
} from "../services/growth";

export const growthRouter = Router();

growthRouter.get(
  "/recommendations",
  asyncHandler(async (req, res) => {
    res.json(await listRecommendations(req.user!.sub));
  }),
);

growthRouter.post(
  "/learn",
  asyncHandler(async (req, res) => {
    const body = z.object({ windowDays: z.number().int().min(1).max(60).optional() }).parse(req.body ?? {});
    res.json(await runInsights(req.user!.sub, body));
  }),
);

growthRouter.post(
  "/recommendations/:id/consume",
  asyncHandler(async (req, res) => {
    await consumeRecommendation(req.user!.sub, req.params.id);
    res.status(204).end();
  }),
);
