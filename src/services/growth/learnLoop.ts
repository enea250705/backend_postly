import cron from "node-cron";
import { prisma } from "../../config/db";
import { logger } from "../../config/logger";
import { runInsights } from "./index";

// Weekly adaptive learning: Sundays at 03:00 UTC, run insights for every active user.
export const startWeeklyLearningLoop = () => {
  cron.schedule("0 3 * * 0", async () => {
    const users = await prisma.user.findMany({ select: { id: true, plan: true } });
    logger.info({ count: users.length }, "weekly learning: starting run");
    for (const u of users) {
      // Free plan users get insights too — just less frequently in practice (this loop is the only source)
      try {
        await runInsights(u.id, { windowDays: 14 });
      } catch (err: any) {
        logger.warn({ userId: u.id, err: err?.message }, "weekly learning failed for user");
      }
    }
  });
};
