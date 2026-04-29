export const GROWTH_SYSTEM = `You are Postly's growth strategist. You take a creator's recent post performance and produce concrete next-step recommendations.

Rules:
- Each insight must be ACTIONABLE THIS WEEK by a solo creator.
- Ground every claim in the data provided. Don't invent metrics.
- Confidence reflects how strongly the data supports the recommendation.

Return JSON:
{
  "insights": [
    {
      "kind": "next-post" | "best-time" | "format-shift" | "hook-pattern" | "platform-shift" | "frequency",
      "title": string (max 80 chars),
      "body": string (2-4 sentences),
      "confidence": number 0-1,
      "recommendedFormat": "REEL"|"TIKTOK"|"SHORT"|"CAROUSEL"|"THREAD"|"TWEET"|"POST"|"STORY"|"PIN"|null,
      "recommendedPlatform": "TWITTER"|"INSTAGRAM"|"TIKTOK"|"YOUTUBE"|"LINKEDIN"|"FACEBOOK"|"THREADS"|"PINTEREST"|null,
      "recommendedHourUTC": number 0-23 | null
    }
  ]
}`;

export const buildGrowthPrompt = (params: {
  niche: string;
  goals?: string;
  windowDays: number;
  totalPosts: number;
  avgEngagement: number;
  topPosts: Array<{
    platform: string;
    format: string;
    hook: string | null;
    views: number;
    engagementRate: number;
    hourUTC: number;
    dayOfWeek: number;
  }>;
  worstPosts: Array<{
    platform: string;
    format: string;
    hook: string | null;
    views: number;
    engagementRate: number;
  }>;
  bestHourUTC: number | null;
  bestDOW: number | null;
}) => `Creator niche: ${params.niche}
Goals: ${params.goals ?? "(not provided)"}
Window: last ${params.windowDays} days
Total posts: ${params.totalPosts}
Avg engagement rate: ${(params.avgEngagement * 100).toFixed(2)}%
Best posting hour (UTC): ${params.bestHourUTC ?? "n/a"}
Best day of week (0=Sun): ${params.bestDOW ?? "n/a"}

Top performers:
${params.topPosts
  .map(
    (p, i) =>
      `  ${i + 1}. [${p.platform}/${p.format}] hook="${p.hook ?? "n/a"}" views=${p.views} er=${(p.engagementRate * 100).toFixed(1)}% hour=${p.hourUTC} dow=${p.dayOfWeek}`,
  )
  .join("\n") || "  (none)"}

Worst performers:
${params.worstPosts
  .map(
    (p, i) =>
      `  ${i + 1}. [${p.platform}/${p.format}] hook="${p.hook ?? "n/a"}" views=${p.views} er=${(p.engagementRate * 100).toFixed(1)}%`,
  )
  .join("\n") || "  (none)"}

Generate 3-5 prioritized insights.`;
