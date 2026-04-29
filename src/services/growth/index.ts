import { prisma } from "../../config/db";
import { generateGrowthInsights } from "../ai";
import { consumeCredit } from "../ai/credits";
import { computeBestTimes } from "../scheduler/bestTime";

export interface RunInsightsParams {
  windowDays?: number;
}

export const runInsights = async (userId: string, params: RunInsightsParams = {}) => {
  await consumeCredit(userId, "growth", 2);
  const windowDays = params.windowDays ?? 14;
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  const posts = await prisma.post.findMany({
    where: { userId, status: "PUBLISHED", publishedAt: { gte: since } },
    include: { metrics: { orderBy: { capturedAt: "desc" }, take: 1 } },
  });

  const enriched = posts
    .map((p) => {
      const m = p.metrics[0];
      if (!m || !p.publishedAt) return null;
      const engagement = (m.likes + m.comments * 2 + m.shares * 3 + m.saves * 2) / Math.max(1, m.views);
      return {
        platform: p.platform,
        format: p.format,
        hook: p.hook,
        views: m.views,
        engagementRate: engagement,
        hourUTC: p.publishedAt.getUTCHours(),
        dayOfWeek: p.publishedAt.getUTCDay(),
      };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  const sortedByER = [...enriched].sort((a, b) => b.engagementRate - a.engagementRate);
  const top = sortedByER.slice(0, 5);
  const worst = sortedByER.slice(-3).reverse();
  const avgEngagement =
    enriched.length === 0
      ? 0
      : enriched.reduce((s, x) => s + x.engagementRate, 0) / enriched.length;

  const bestTimes = await computeBestTimes(userId, user.niche);
  const bestHour = bestTimes[0]?.hour ?? null;
  const bestDOW = bestTimes[0]?.dow ?? null;

  // record analytics run
  const run = await prisma.analyticsRun.create({
    data: {
      userId,
      windowStart: since,
      windowEnd: new Date(),
      totalPosts: enriched.length,
      avgEngagement,
      topPostId: posts.find((p) => p.hook === top[0]?.hook)?.id ?? null,
      bestHourUTC: bestHour,
      bestDOW: bestDOW,
      insights: { bestTimes, top, worst } as any,
    },
  });

  if (enriched.length === 0) {
    // Cold-start: still produce insights from niche heuristics so first-time users see value.
    const cold = await generateGrowthInsights({
      niche: user.niche ?? "general",
      goals: user.goals ?? undefined,
      windowDays,
      totalPosts: 0,
      avgEngagement: 0,
      topPosts: [],
      worstPosts: [],
      bestHourUTC: bestHour,
      bestDOW,
    });
    await persistInsights(userId, cold.insights);
    return { runId: run.id, ...cold };
  }

  const ai = await generateGrowthInsights({
    niche: user.niche ?? "general",
    goals: user.goals ?? undefined,
    windowDays,
    totalPosts: enriched.length,
    avgEngagement,
    topPosts: top,
    worstPosts: worst,
    bestHourUTC: bestHour,
    bestDOW,
  });
  await persistInsights(userId, ai.insights);
  return { runId: run.id, ...ai };
};

const persistInsights = async (userId: string, insights: any[]) => {
  for (const ins of insights) {
    await prisma.growthInsight.create({
      data: {
        userId,
        kind: ins.kind,
        title: ins.title,
        body: ins.body,
        confidence: ins.confidence ?? 0.6,
        recommendedFormat: ins.recommendedFormat ?? null,
        recommendedPlatform: ins.recommendedPlatform ?? null,
        recommendedAt: ins.recommendedHourUTC != null ? nextSlot(ins.recommendedHourUTC) : null,
      },
    });
  }
};

const nextSlot = (hourUTC: number) => {
  const d = new Date();
  d.setUTCHours(hourUTC, 0, 0, 0);
  if (d.getTime() < Date.now()) d.setUTCDate(d.getUTCDate() + 1);
  return d;
};

export const listRecommendations = (userId: string) =>
  prisma.growthInsight.findMany({
    where: { userId, consumed: false },
    orderBy: [{ confidence: "desc" }, { createdAt: "desc" }],
    take: 20,
  });

export const consumeRecommendation = (userId: string, id: string) =>
  prisma.growthInsight.updateMany({ where: { id, userId }, data: { consumed: true } });
