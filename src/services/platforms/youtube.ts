import { Platform } from "@prisma/client";
import { BasePlatformAdapter } from "./base";
import type { AccountStats, InboundMessage, PostStats, PublishInput, PublishResult } from "./types";

export class YouTubeAdapter extends BasePlatformAdapter {
  platform = Platform.YOUTUBE;
  protected clientId = process.env.YOUTUBE_CLIENT_ID ?? "";
  protected clientSecret = process.env.YOUTUBE_CLIENT_SECRET ?? "";

  authUrl(redirectUri: string, state: string) {
    const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    u.searchParams.set("client_id", this.clientId);
    u.searchParams.set("redirect_uri", redirectUri);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("access_type", "offline");
    u.searchParams.set("prompt", "consent");
    u.searchParams.set(
      "scope",
      "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.force-ssl",
    );
    u.searchParams.set("state", state);
    return u.toString();
  }

  protected async realConnect(code: string, redirectUri: string) {
    const t = (await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    }).then((r) => r.json())) as any;
    const ch = (await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
      { headers: { Authorization: `Bearer ${t.access_token}` } },
    ).then((r) => r.json())) as any;
    const c = ch.items?.[0];
    return {
      accessToken: t.access_token,
      refreshToken: t.refresh_token,
      expiresAt: new Date(Date.now() + (t.expires_in ?? 3600) * 1000),
      handle: c?.snippet?.title ?? "unknown",
      externalId: c?.id ?? "",
      scopes: t.scope,
    };
  }

  protected async realRefresh(refreshToken: string) {
    const r = (await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: "refresh_token",
      }),
    }).then((r) => r.json())) as any;
    return {
      accessToken: r.access_token,
      refreshToken,
      expiresAt: new Date(Date.now() + (r.expires_in ?? 3600) * 1000),
    };
  }

  protected async realPublish(_token: string, _input: PublishInput): Promise<PublishResult> {
    // Real upload uses resumable multipart; out of scope to embed full binary here.
    // Production would: 1) initiate resumable session, 2) PUT video bytes, 3) return videoId.
    throw new Error("YouTube upload requires resumable upload pipeline (configure in storage service)");
  }

  protected async realFetchAccountStats(token: string, externalId: string): Promise<AccountStats> {
    const r = (await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${externalId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    ).then((r) => r.json())) as any;
    const s = r.items?.[0]?.statistics ?? {};
    return {
      followers: Number(s.subscriberCount ?? 0),
      following: 0,
      posts: Number(s.videoCount ?? 0),
    };
  }

  protected async realFetchPostStats(token: string, externalPostId: string): Promise<PostStats> {
    const r = (await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${externalPostId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    ).then((r) => r.json())) as any;
    const s = r.items?.[0]?.statistics ?? {};
    return {
      views: Number(s.viewCount ?? 0),
      likes: Number(s.likeCount ?? 0),
      comments: Number(s.commentCount ?? 0),
      shares: 0,
      saves: 0,
      reach: Number(s.viewCount ?? 0),
    };
  }

  protected async realFetchInbox(token: string, _s: string): Promise<InboundMessage[]> {
    const r = (await fetch(
      "https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&mine=true&maxResults=20",
      { headers: { Authorization: `Bearer ${token}` } },
    ).then((r) => r.json())) as any;
    return (r.items ?? []).map((it: any) => ({
      externalId: it.id,
      participant: it.snippet?.topLevelComment?.snippet?.authorDisplayName ?? "unknown",
      body: it.snippet?.topLevelComment?.snippet?.textDisplay ?? "",
      kind: "COMMENT" as const,
    }));
  }

  protected async realReply(token: string, externalConversationId: string, body: string) {
    await fetch("https://www.googleapis.com/youtube/v3/comments?part=snippet", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        snippet: { parentId: externalConversationId, textOriginal: body },
      }),
    });
  }
}
