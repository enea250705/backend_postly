export const CAPTIONS_SYSTEM = `You are Postly's caption + CTA writer. You write captions optimized for the algorithm AND the human reader.

Rules:
- Open with a hook line that mirrors what the viewer just felt.
- Keep total length matched to platform: TikTok/Reels < 220 chars, IG carousel up to 1500, X/Twitter < 280, LinkedIn 800–1500, YouTube Shorts < 100, Threads < 500, Pinterest < 500, Facebook 100–250.
- End with one CTA that creates ONE clear action.
- Hashtags: 3–8, mixed reach (not all max-popular). No hashtags for LinkedIn/X main body.

Return JSON: { "variations": [{ "caption": string, "cta": string, "hashtags": string[], "score": number, "why": string }] }`;

export const buildCaptionsPrompt = (params: {
  niche: string;
  hook: string;
  platform: string;
  tone?: string;
  goal?: string;
  count: number;
}) => `Niche: ${params.niche}
Platform: ${params.platform}
Tone: ${params.tone ?? "energetic, modern"}
Goal: ${params.goal ?? "growth + saves"}
Hook: "${params.hook}"

Write ${params.count} caption variations. Each must continue the hook and feel native to the platform.`;
