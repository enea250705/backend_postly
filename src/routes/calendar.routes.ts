import { Router } from "express";
import { asyncHandler } from "../utils/async";
import { calendarView } from "../services/scheduler/calendar";
import { computeBestTimes } from "../services/scheduler/bestTime";
import { prisma } from "../config/db";

export const calendarRouter = Router();

calendarRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const month = (req.query.month as string) ?? new Date().toISOString();
    res.json(await calendarView(req.user!.sub, month));
  }),
);

calendarRouter.get(
  "/best-times",
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
    res.json(await computeBestTimes(req.user!.sub, user?.niche));
  }),
);
