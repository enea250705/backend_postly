import { prisma } from "../../config/db";
import { explainPost } from "../ai";
import { consumeCredit } from "../ai/credits";
import { NotFound } from "../../utils/errors";

export const analyticsOverview = async (userId: string, days = 30) => {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const posts = await prisma.post.findMany({
    where: { userId, status: "PUBLISHED", publishedAt: { gte: since } },
    include: { metrics: { orderBy: { capturedAt: "desc" }, take: 1 } },
  });

  let views = 0,
    likes = 0,
    comments = 0,
    shares = 0,
    saves = 0,
    reach = 0;
  for (const p of posts) {
    const m = p.metrics[0];
    if (!m) continue;
    views += m.views;
    likes += m.likes;
    comments += m.comments;
    shares += m.shares;
    saves += m.saves;
    reach += m.reach;
  }
  const totalEngagement = likes + comments * 2 + shares * 3 + saves * 2;
  const avgEngagement = views > 0 ? totalEngagement / views : 0;

  const byPlatform: Record<string, { posts: number; views: number; engagement: number }> = {};
  for (const p of posts) {
    const m = p.metrics[0];
    const key = p.platform;
    byPlatform[key] ??= { posts: 0, views: 0, engagement: 0 };
    byPlatform[key].posts += 1;
    if (m) {
      byPlatform[key].views += m.views;
      byPlatform[key].engagement +=
        m.likes + m.comments * 2 + m.shares * 3 + m.saves * 2;
    }
  }

  const top = [...posts]
    .sort((a, b) => (b.metrics[0]?.views ?? 0) - (a.metrics[0]?.views ?? 0))
    .slice(0, 5)
    .map((p) => ({
      id: p.id,
      platform: p.platform,
      format: p.format,
      hook: p.hook,
      caption: p.caption.slice(0, 140),
      views: p.metrics[0]?.views ?? 0,
      likes: p.metrics[0]?.likes ?? 0,
      comments: p.metrics[0]?.comments ?? 0,
    }));

  return {
    windowDays: days,
    totals: { posts: posts.length, views, likes, comments, shares, saves, reach },
    avgEngagementRate: avgEngagement,
    byPlatform,
    topPosts: top,
  };
};

export const explainPostAnalytics = async (userId: string, postId: string) => {
  await consumeCredit(userId, "explain");
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { metrics: { orderBy: { capturedAt: "desc" }, take: 1 }, user: true },
  });
  if (!post || post.userId !== userId) throw NotFound("post");
  const m = post.metrics[0];
  if (!m) throw NotFound("no metrics yet for this post");

  // Compute baseline engagement from this user's other posts
  const others = await prisma.postMetric.findMany({
    where: { post: { userId, status: "PUBLISHED", id: { not: postId } } },
    take: 50,
    orderBy: { capturedAt: "desc" },
  });
  const baseSum = others.reduce(
    (acc, x) => acc + (x.likes + x.comments * 2 + x.shares * 3 + x.saves * 2) / Math.max(1, x.views),
    0,
  );
  const baseline = others.length ? baseSum / others.length : 0.03;

  const ex = await explainPost({
    niche: post.user.niche ?? "general",
    platform: post.platform,
    format: post.format,
    hook: post.hook,
    caption: post.caption,
    metrics: {
      views: m.views,
      likes: m.likes,
      comments: m.comments,
      shares: m.shares,
      saves: m.saves,
      retention: m.retention ?? null,
    },
    baselineEngagement: baseline,
  });

  return prisma.postExplanation.create({
    data: {
      postId,
      summary: ex.summary,
      hookScore: ex.hookScore,
      retentionLift: ex.retentionLift,
      positives: ex.positives,
      negatives: ex.negatives,
      patterns: ex.patterns,
    },
  });
};
