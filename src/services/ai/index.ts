import { ai } from "./provider";
import { HOOKS_SYSTEM, buildHooksPrompt } from "./prompts/hooks";
import { CAPTIONS_SYSTEM, buildCaptionsPrompt } from "./prompts/captions";
import { REPURPOSE_SYSTEM, buildRepurposePrompt } from "./prompts/repurpose";
import { EXPLAIN_SYSTEM, buildExplainPrompt } from "./prompts/explain";
import {
  MONETIZE_SYSTEM,
  buildMonetizePrompt,
  LANDING_SYSTEM,
  buildLandingPrompt,
} from "./prompts/monetize";
import { INTENT_SYSTEM, buildIntentPrompt, REPLY_SYSTEM, buildReplyPrompt } from "./prompts/inbox";
import { GROWTH_SYSTEM, buildGrowthPrompt } from "./prompts/growth";

export type Hook = { text: string; angle: string; score: number; why: string };
export const generateHooks = (params: Parameters<typeof buildHooksPrompt>[0]) =>
  ai.generateJSON<Hook[]>({
    system: HOOKS_SYSTEM,
    user: buildHooksPrompt(params),
    temperature: 0.95,
    maxTokens: 1200,
  });

export type CaptionVariation = {
  caption: string;
  cta: string;
  hashtags: string[];
  score: number;
  why: string;
};
export const generateCaptions = (params: Parameters<typeof buildCaptionsPrompt>[0]) =>
  ai.generateJSON<{ variations: CaptionVariation[] }>({
    system: CAPTIONS_SYSTEM,
    user: buildCaptionsPrompt(params),
    temperature: 0.85,
    maxTokens: 1500,
  });

export const repurposeContent = (params: Parameters<typeof buildRepurposePrompt>[0]) =>
  ai.generateJSON<{ outputs: Record<string, any> }>({
    system: REPURPOSE_SYSTEM,
    user: buildRepurposePrompt(params),
    temperature: 0.8,
    maxTokens: 3500,
  });

export type Explanation = {
  summary: string;
  hookScore: number;
  retentionLift: number;
  positives: string[];
  negatives: string[];
  patterns: string[];
};
export const explainPost = (params: Parameters<typeof buildExplainPrompt>[0]) =>
  ai.generateJSON<Explanation>({
    system: EXPLAIN_SYSTEM,
    user: buildExplainPrompt(params),
    temperature: 0.3,
    maxTokens: 1000,
  });

export type MonetizeOffer = {
  productType: string;
  title: string;
  pitch: string;
  audience: string;
  pricingHint: string;
  contentIdeas: string[];
};
export const suggestMonetization = (params: Parameters<typeof buildMonetizePrompt>[0]) =>
  ai.generateJSON<{ offers: MonetizeOffer[] }>({
    system: MONETIZE_SYSTEM,
    user: buildMonetizePrompt(params),
    temperature: 0.75,
    maxTokens: 2000,
  });

export type Landing = {
  headline: string;
  subhead: string;
  problemBullets: string[];
  solutionBullets: string[];
  outcomeBullets: string[];
  primaryCTA: string;
  secondaryCTA: string;
  faq: { q: string; a: string }[];
};
export const generateLanding = (params: Parameters<typeof buildLandingPrompt>[0]) =>
  ai.generateJSON<Landing>({
    system: LANDING_SYSTEM,
    user: buildLandingPrompt(params),
    temperature: 0.55,
    maxTokens: 1800,
  });

export type Intent = {
  intent: string;
  confidence: number;
  shouldAutoReply: boolean;
  funnelStage: string | null;
  extractedEmail: string | null;
};
export const classifyIntent = (msg: string) =>
  ai.generateJSON<Intent>({
    system: INTENT_SYSTEM,
    user: buildIntentPrompt(msg),
    temperature: 0.1,
    maxTokens: 200,
  });

export const writeReply = (params: Parameters<typeof buildReplyPrompt>[0]) =>
  ai.generateJSON<{ reply: string; shouldSendLink: boolean }>({
    system: REPLY_SYSTEM,
    user: buildReplyPrompt(params),
    temperature: 0.6,
    maxTokens: 400,
  });

export type GrowthInsightOut = {
  kind: string;
  title: string;
  body: string;
  confidence: number;
  recommendedFormat: string | null;
  recommendedPlatform: string | null;
  recommendedHourUTC: number | null;
};
export const generateGrowthInsights = (params: Parameters<typeof buildGrowthPrompt>[0]) =>
  ai.generateJSON<{ insights: GrowthInsightOut[] }>({
    system: GROWTH_SYSTEM,
    user: buildGrowthPrompt(params),
    temperature: 0.4,
    maxTokens: 1800,
  });
