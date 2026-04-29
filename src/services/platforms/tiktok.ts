import { Platform } from "@prisma/client";
import { BasePlatformAdapter } from "./base";
import type { AccountStats, InboundMessage, PostStats, PublishInput, PublishResult } from "./types";

export class TikTokAdapter extends BasePlatformAdapter {
  platform = Platform.TIKTOK;
  protected clientId = process.env.TIKTOK_CLIENT_KEY ?? "";
  protected clientSecret = process.env.TIKTOK_CLIENT_SECRET ?? "";

  authUrl(redirectUri: string, state: string) {
    const u = new URL("https://www.tiktok.com/v2/auth/authorize/");
    u.searchParams.set("client_key", this.clientId);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("scope", "user.info.basic,video.list,video.publish,video.upload");
    u.searchParams.set("redirect_uri", redirectUri);
    u.searchParams.set("state", state);
    return u.toString();
  }

  protected async realConnect(code: string, redirectUri: string) {
    const t = (await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: this.clientId,
        client_secret: this.clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    }).then((r) => r.json())) as any;
    const me = (await fetch(
      "https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,display_name",
      { headers: { Authorization: `Bearer ${t.access_token}` } },
    ).then((r) => r.json())) as any;
    return {
      accessToken: t.access_token,
      refreshToken: t.refresh_token,
      expiresAt: new Date(Date.now() + (t.expires_in ?? 86400) * 1000),
      handle: me.data?.user?.display_name ?? "unknown",
      externalId: me.data?.user?.open_id ?? "",
      scopes: t.scope,
    };
  }

  protected async realRefresh(refreshToken: string) {
    const r = (await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: this.clientId,
        client_secret: this.clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    }).then((r) => r.json())) as any;
    return {
      accessToken: r.access_token,
      refreshToken: r.refresh_token,
      expiresAt: new Date(Date.now() + (r.expires_in ?? 86400) * 1000),
    };
  }

  protected async realPublish(token: string, input: PublishInput): Promise<PublishResult> {
    const init = (await fetch("https://open.tiktokapis.com/v2/post/publish/inbox/video/init/", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ source_info: { source: "PULL_FROM_URL", video_url: input.mediaUrls[0] } }),
    }).then((r) => r.json())) as any;
    return { externalPostId: init.data?.publish_id ?? "" };
  }

  protected async realFetchAccountStats(token: string, _externalId: string): Promise<AccountStats> {
    const r = (await fetch(
      "https://open.tiktokapis.com/v2/user/info/?fields=follower_count,following_count,video_count,likes_count",
      { headers: { Authorization: `Bearer ${token}` } },
    ).then((r) => r.json())) as any;
    const u = r.data?.user ?? {};
    return {
      followers: u.follower_count ?? 0,
      following: u.following_count ?? 0,
      posts: u.video_count ?? 0,
    };
  }

  protected async realFetchPostStats(token: string, externalPostId: string): Promise<PostStats> {
    const r = (await fetch(
      `https://open.tiktokapis.com/v2/video/query/?fields=view_count,like_count,comment_count,share_count`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ filters: { video_ids: [externalPostId] } }),
      },
    ).then((r) => r.json())) as any;
    const v = r.data?.videos?.[0] ?? {};
    return {
      views: v.view_count ?? 0,
      likes: v.like_count ?? 0,
      comments: v.comment_count ?? 0,
      shares: v.share_count ?? 0,
      saves: 0,
      reach: v.view_count ?? 0,
    };
  }

  protected async realFetchInbox(_t: string, _s: string): Promise<InboundMessage[]> {
    return [];
  }
  protected async realReply(): Promise<void> {
    // TikTok comment-reply API is partner-restricted; intentionally no-op
  }
}
