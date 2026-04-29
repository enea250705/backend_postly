import type { Platform, ContentFormat } from "@prisma/client";
import { prisma } from "../config/db";
import { generateHooks, generateCaptions, repurposeContent } from "./ai";
import { consumeCredit } from "./ai/credits";
import { BadRequest } from "../utils/errors";

const PLATFORM_DEFAULTS: Record<Platform, string> = {
  TWITTER: "twitter",
  INSTAGRAM: "instagram",
  TIKTOK: "tiktok",
  YOUTUBE: "youtube_shorts",
  LINKEDIN: "linkedin",
  FACEBOOK: "facebook",
  THREADS: "threads",
  PINTEREST: "pinterest",
};

export const generateHooksForUser = async (userId: string, params: {
  niche: string;
  topic?: string;
  platform: Platform;
  count?: number;
}) => {
  await consumeCredit(userId, "hook");
  const out = await generateHooks({
    niche: params.niche,
    topic: params.topic,
    platform: PLATFORM_DEFAULTS[params.platform],
    count: Math.max(1, Math.min(params.count ?? 6, 12)),
  });
  await prisma.contentDraft.create({
    data: {
      userId,
      niche: params.niche,
      prompt: params.topic ?? "",
      kind: "hook",
      variations: out as any,
      model: "anthropic",
    },
  });
  return out;
};

export const generateCaptionsForUser = async (userId: string, params: {
  niche: string;
  hook: string;
  platform: Platform;
  goal?: string;
  count?: number;
}) => {
  if (!params.hook?.trim()) throw BadRequest("hook is required");
  await consumeCredit(userId, "caption");
  const out = await generateCaptions({
    niche: params.niche,
    hook: params.hook,
    platform: PLATFORM_DEFAULTS[params.platform],
    goal: params.goal,
    count: Math.max(1, Math.min(params.count ?? 3, 6)),
  });
  await prisma.contentDraft.create({
    data: {
      userId,
      niche: params.niche,
      prompt: params.hook,
      kind: "caption",
      variations: out.variations as any,
      model: "anthropic",
    },
  });
  return out;
};

const PLATFORM_TO_FORMAT: Record<string, { platform: Platform; format: ContentFormat }> = {
  INSTAGRAM_REEL: { platform: "INSTAGRAM", format: "REEL" },
  TIKTOK: { platform: "TIKTOK", format: "TIKTOK" },
  YOUTUBE_SHORT: { platform: "YOUTUBE", format: "SHORT" },
  CAROUSEL: { platform: "INSTAGRAM", format: "CAROUSEL" },
  TWITTER_THREAD: { platform: "TWITTER", format: "THREAD" },
  LINKEDIN: { platform: "LINKEDIN", format: "POST" },
  THREADS: { platform: "THREADS", format: "POST" },
  PINTEREST: { platform: "PINTEREST", format: "PIN" },
};

export const repurposeIdea = async (
  userId: string,
  params: { idea: string; niche: string; platforms?: string[]; tone?: string },
) => {
  if (!params.idea?.trim()) throw BadRequest("idea is required");
  await consumeCredit(userId, "repurpose", 2);
  const platforms = params.platforms?.length
    ? params.platforms
    : Object.keys(PLATFORM_TO_FORMAT);
  const out = await repurposeContent({
    idea: params.idea,
    niche: params.niche,
    tone: params.tone,
    platforms,
  });
  await prisma.contentDraft.create({
    data: {
      userId,
      niche: params.niche,
      prompt: params.idea,
      kind: "repurpose",
      variations: out as any,
      model: "anthropic",
    },
  });
  return out;
};

export const PLATFORM_TO_FORMAT_MAP = PLATFORM_TO_FORMAT;
