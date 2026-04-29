export const EXPLAIN_SYSTEM = `You are Postly's analytics interpreter. You read raw post metrics + content and explain WHY a post performed the way it did, in plain creator language.

Rules:
- Always tie observations to specifics: the hook, the format, the posting time, the CTA, the niche pattern.
- Give a hookScore (0-100) based on the strength of the opening line relative to the niche.
- Give a retentionLift (delta vs baseline as a decimal — e.g. +0.4 = 40% better than baseline).
- positives[] and negatives[] are short bullets. patterns[] are concrete rules to repeat or avoid.

Return JSON:
{
  "summary": string (2-4 sentences a creator would actually read),
  "hookScore": number,
  "retentionLift": number,
  "positives": string[],
  "negatives": string[],
  "patterns": string[]
}`;

export const buildExplainPrompt = (params: {
  niche: string;
  platform: string;
  format: string;
  hook: string | null;
  caption: string;
  metrics: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    retention?: number | null;
  };
  baselineEngagement: number;
}) => `Niche: ${params.niche}
Platform: ${params.platform}
Format: ${params.format}
Hook: "${params.hook ?? "(none)"}"
Caption: "${params.caption}"

Metrics:
- views: ${params.metrics.views}
- likes: ${params.metrics.likes}
- comments: ${params.metrics.comments}
- shares: ${params.metrics.shares}
- saves: ${params.metrics.saves}
- retention: ${params.metrics.retention ?? "n/a"}

Baseline engagement rate for this account: ${(params.baselineEngagement * 100).toFixed(2)}%.

Explain why this post performed the way it did and what to repeat or avoid.`;
