import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/async";
import * as m from "../services/monetize";

export const monetizeRouter = Router();

monetizeRouter.get(
  "/offers",
  asyncHandler(async (req, res) => {
    res.json(await m.listOffers(req.user!.sub));
  }),
);

monetizeRouter.post(
  "/offers",
  asyncHandler(async (req, res) => {
    const body = z.object({ count: z.number().int().min(1).max(8).optional() }).parse(req.body ?? {});
    res.status(201).json(await m.suggestOffers(req.user!.sub, body.count));
  }),
);

monetizeRouter.post(
  "/offers/:id/landing",
  asyncHandler(async (req, res) => {
    res.json(await m.generateLandingForOffer(req.user!.sub, req.params.id));
  }),
);
