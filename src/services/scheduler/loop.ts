import cron from "node-cron";
import { prisma } from "../../config/db";
import { logger } from "../../config/logger";
import { getAdapter } from "../platforms";

// Runs every minute. Picks up SCHEDULED posts whose time has come, publishes them.
export const startSchedulerLoop = () => {
  cron.schedule("* * * * *", async () => {
    const now = new Date();
    const due = await prisma.post.findMany({
      where: { status: "SCHEDULED", scheduledAt: { lte: now } },
      include: { account: true },
      take: 25,
    });
    if (due.length === 0) return;
    logger.info({ count: due.length }, "scheduler: publishing due posts");
    for (const post of due) {
      try {
        if (!post.account) {
          await prisma.post.update({
            where: { id: post.id },
            data: { status: "FAILED", failureReason: "No connected account" },
          });
          continue;
        }
        await prisma.post.update({ where: { id: post.id }, data: { status: "PUBLISHING" } });
        const adapter = getAdapter(post.platform);
        const r = await adapter.publish(post.account.accessToken, {
          caption: post.caption,
          hook: post.hook,
          cta: post.cta,
          hashtags: post.hashtags,
          mediaUrls: post.mediaUrls,
          format: post.format,
        });
        await prisma.post.update({
          where: { id: post.id },
          data: {
            status: "PUBLISHED",
            publishedAt: new Date(),
            externalPostId: r.externalPostId,
          },
        });
      } catch (err: any) {
        logger.error({ postId: post.id, err: err?.message }, "scheduler publish failed");
        await prisma.post.update({
          where: { id: post.id },
          data: { status: "FAILED", failureReason: String(err?.message ?? err) },
        });
      }
    }
  });

  // Hourly: refresh post metrics for posts published in the last 7 days.
  cron.schedule("17 * * * *", async () => {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const posts = await prisma.post.findMany({
      where: { status: "PUBLISHED", publishedAt: { gte: since }, externalPostId: { not: null } },
      include: { account: true },
      take: 200,
    });
    for (const post of posts) {
      if (!post.account || !post.externalPostId) continue;
      try {
        const adapter = getAdapter(post.platform);
        const stats = await adapter.fetchPostStats(post.account.accessToken, post.externalPostId);
        await prisma.postMetric.create({
          data: { postId: post.id, ...stats },
        });
      } catch (err: any) {
        logger.warn({ postId: post.id, err: err?.message }, "metric refresh failed");
      }
    }
  });
};
