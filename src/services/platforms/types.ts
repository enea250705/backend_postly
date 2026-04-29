import type { Platform, ContentFormat } from "@prisma/client";

export interface PublishInput {
  caption: string;
  hook?: string | null;
  cta?: string | null;
  hashtags?: string | null;
  mediaUrls: string[];
  format: ContentFormat;
}

export interface PublishResult {
  externalPostId: string;
  url?: string;
}

export interface AccountStats {
  followers: number;
  following: number;
  posts: number;
  engagementRate?: number;
}

export interface PostStats {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reach: number;
  retention?: number;
  clickThrough?: number;
}

export interface InboundMessage {
  externalId: string;
  participant: string;
  body: string;
  kind: "COMMENT" | "DM";
}

export interface PlatformAdapter {
  platform: Platform;
  connect(code: string, redirectUri: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
    handle: string;
    externalId: string;
    scopes?: string;
  }>;
  refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  }>;
  publish(token: string, input: PublishInput): Promise<PublishResult>;
  fetchAccountStats(token: string, externalId: string): Promise<AccountStats>;
  fetchPostStats(token: string, externalPostId: string): Promise<PostStats>;
  fetchInbox(token: string, sinceISO: string): Promise<InboundMessage[]>;
  reply(token: string, externalConversationId: string, body: string): Promise<void>;
  authUrl(redirectUri: string, state: string): string;
}
