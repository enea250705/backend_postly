import { Router } from "express";
import { asyncHandler } from "../utils/async";
import { analyticsOverview, explainPostAnalytics } from "../services/analytics";

export const analyticsRouter = Router();

analyticsRouter.get(
  "/overview",
  asyncHandler(async (req, res) => {
    const days = req.query.days ? parseInt(String(req.query.days), 10) : 30;
    res.json(await analyticsOverview(req.user!.sub, days));
  }),
);

analyticsRouter.post(
  "/explain/:postId",
  asyncHandler(async (req, res) => {
    res.json(await explainPostAnalytics(req.user!.sub, req.params.postId));
  }),
);
