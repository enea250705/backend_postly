import { prisma } from "../../config/db";
import { computeBestTimes } from "./bestTime";

export const calendarView = async (userId: string, monthISO: string) => {
  const start = new Date(monthISO);
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);

  const [posts, user] = await Promise.all([
    prisma.post.findMany({
      where: {
        userId,
        OR: [
          { scheduledAt: { gte: start, lt: end } },
          { publishedAt: { gte: start, lt: end } },
        ],
      },
      orderBy: [{ scheduledAt: "asc" }, { publishedAt: "asc" }],
    }),
    prisma.user.findUnique({ where: { id: userId } }),
  ]);

  const bestTimes = await computeBestTimes(userId, user?.niche ?? null);

  // Project upcoming insights as suggestions on the calendar
  const insights = await prisma.growthInsight.findMany({
    where: { userId, consumed: false, recommendedAt: { gte: start, lt: end } },
  });

  return { posts, bestTimes, insights };
};
