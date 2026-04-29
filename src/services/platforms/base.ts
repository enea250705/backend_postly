import type {
  AccountStats,
  InboundMessage,
  PlatformAdapter,
  PostStats,
  PublishInput,
  PublishResult,
} from "./types";
import type { Platform } from "@prisma/client";
import { logger } from "../../config/logger";

// In dev / when OAuth creds are missing, the adapter falls back to realistic mock data
// so the rest of the system stays end-to-end testable. Real credentials enable real calls.
export abstract class BasePlatformAdapter implements PlatformAdapter {
  abstract platform: Platform;
  protected get hasCreds(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }
  protected abstract clientId: string;
  protected abstract clientSecret: string;
  abstract authUrl(redirectUri: string, state: string): string;

  async connect(_code: string, _redirectUri: string) {
    if (!this.hasCreds) {
      // dev fallback
      return {
        accessToken: `mock_${this.platform}_${Date.now()}`,
        handle: `demo_${this.platform.toLowerCase()}`,
        externalId: `mock-${this.platform}-${Math.random().toString(36).slice(2, 10)}`,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        scopes: "read,write",
      };
    }
    return this.realConnect(_code, _redirectUri);
  }

  protected abstract realConnect(code: string, redirectUri: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
    handle: string;
    externalId: string;
    scopes?: string;
  }>;

  async refreshAccessToken(refreshToken: string) {
    if (!this.hasCreds) {
      return {
        accessToken: `mock_${this.platform}_${Date.now()}`,
        refreshToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };
    }
    return this.realRefresh(refreshToken);
  }

  protected abstract realRefresh(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  }>;

  async publish(token: string, input: PublishInput): Promise<PublishResult> {
    if (!this.hasCreds || token.startsWith("mock_")) {
      const id = `mock-post-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      logger.info({ platform: this.platform, id }, "[mock] publish");
      return { externalPostId: id, url: `https://example.com/${this.platform}/${id}` };
    }
    return this.realPublish(token, input);
  }

  protected abstract realPublish(token: string, input: PublishInput): Promise<PublishResult>;

  async fetchAccountStats(token: string, externalId: string): Promise<AccountStats> {
    if (!this.hasCreds || token.startsWith("mock_")) {
      return {
        followers: 1000 + Math.floor(Math.random() * 9000),
        following: 200 + Math.floor(Math.random() * 800),
        posts: 50 + Math.floor(Math.random() * 200),
        engagementRate: 0.03 + Math.random() * 0.05,
      };
    }
    return this.realFetchAccountStats(token, externalId);
  }

  protected abstract realFetchAccountStats(token: string, externalId: string): Promise<AccountStats>;

  async fetchPostStats(token: string, externalPostId: string): Promise<PostStats> {
    if (!this.hasCreds || token.startsWith("mock_")) {
      const views = 500 + Math.floor(Math.random() * 50_000);
      const likes = Math.floor(views * (0.03 + Math.random() * 0.06));
      return {
        views,
        likes,
        comments: Math.floor(likes * 0.05),
        shares: Math.floor(likes * 0.07),
        saves: Math.floor(likes * 0.12),
        reach: Math.floor(views * 0.85),
        retention: 0.3 + Math.random() * 0.5,
        clickThrough: Math.random() * 0.04,
      };
    }
    return this.realFetchPostStats(token, externalPostId);
  }

  protected abstract realFetchPostStats(token: string, externalPostId: string): Promise<PostStats>;

  async fetchInbox(token: string, sinceISO: string): Promise<InboundMessage[]> {
    if (!this.hasCreds || token.startsWith("mock_")) return [];
    return this.realFetchInbox(token, sinceISO);
  }

  protected abstract realFetchInbox(token: string, sinceISO: string): Promise<InboundMessage[]>;

  async reply(token: string, externalConversationId: string, body: string): Promise<void> {
    if (!this.hasCreds || token.startsWith("mock_")) {
      logger.info(
        { platform: this.platform, externalConversationId, body },
        "[mock] reply",
      );
      return;
    }
    return this.realReply(token, externalConversationId, body);
  }

  protected abstract realReply(
    token: string,
    externalConversationId: string,
    body: string,
  ): Promise<void>;
}
