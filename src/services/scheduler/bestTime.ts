import { prisma } from "../../config/db";

// Best-time-to-post for a given user is derived from their own engagement history.
// Falls back to niche-default when there isn't enough signal.
const NICHE_DEFAULTS: Record<string, { hour: number; dow: number }[]> = {
  fitness: [{ hour: 6, dow: 1 }, { hour: 18, dow: 3 }, { hour: 9, dow: 6 }],
  coding: [{ hour: 14, dow: 2 }, { hour: 9, dow: 4 }],
  travel: [{ hour: 19, dow: 5 }, { hour: 11, dow: 0 }],
  food: [{ hour: 12, dow: 3 }, { hour: 18, dow: 5 }],
  default: [{ hour: 12, dow: 2 }, { hour: 18, dow: 4 }, { hour: 20, dow: 6 }],
};

export const computeBestTimes = async (userId: string, niche?: string | null) => {
  // Pull last 30 days of post metrics for this user.
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const posts = await prisma.post.findMany({
    where: { userId, status: "PUBLISHED", publishedAt: { gte: since } },
    include: { metrics: { orderBy: { capturedAt: "desc" }, take: 1 } },
  });

  if (posts.length < 5) {
    const defs = NICHE_DEFAULTS[(niche ?? "default").toLowerCase()] ?? NICHE_DEFAULTS.default;
    return defs.map((d) => ({ hour: d.hour, dow: d.dow, score: 0.6, source: "niche-default" }));
  }

  // Bucket by (dow, hour) and compute mean engagement.
  const buckets = new Map<string, { sum: number; n: number; hour: number; dow: number }>();
  for (const p of posts) {
    if (!p.publishedAt) continue;
    const m = p.metrics[0];
    if (!m) continue;
    const eng = (m.likes + m.comments * 2 + m.shares * 3 + m.saves * 2) / Math.max(1, m.views);
    const hour = p.publishedAt.getUTCHours();
    const dow = p.publishedAt.getUTCDay();
    const k = `${dow}-${hour}`;
    const cur = buckets.get(k) ?? { sum: 0, n: 0, hour, dow };
    cur.sum += eng;
    cur.n += 1;
    buckets.set(k, cur);
  }

  const ranked = Array.from(buckets.values())
    .map((b) => ({ hour: b.hour, dow: b.dow, score: b.sum / b.n, source: "user-history" as const }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return ranked;
};
