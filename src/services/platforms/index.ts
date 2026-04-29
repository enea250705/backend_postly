import { Platform } from "@prisma/client";
import type { PlatformAdapter } from "./types";
import { TwitterAdapter } from "./twitter";
import { InstagramAdapter } from "./instagram";
import { TikTokAdapter } from "./tiktok";
import { YouTubeAdapter } from "./youtube";
import { LinkedInAdapter } from "./linkedin";
import { FacebookAdapter } from "./facebook";
import { ThreadsAdapter } from "./threads";
import { PinterestAdapter } from "./pinterest";

const registry: Record<Platform, PlatformAdapter> = {
  [Platform.TWITTER]: new TwitterAdapter(),
  [Platform.INSTAGRAM]: new InstagramAdapter(),
  [Platform.TIKTOK]: new TikTokAdapter(),
  [Platform.YOUTUBE]: new YouTubeAdapter(),
  [Platform.LINKEDIN]: new LinkedInAdapter(),
  [Platform.FACEBOOK]: new FacebookAdapter(),
  [Platform.THREADS]: new ThreadsAdapter(),
  [Platform.PINTEREST]: new PinterestAdapter(),
};

export const getAdapter = (p: Platform): PlatformAdapter => registry[p];
export const allPlatforms = Object.keys(registry) as Platform[];
export type { PlatformAdapter } from "./types";
