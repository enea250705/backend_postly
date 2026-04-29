import { Platform } from "@prisma/client";
import { BasePlatformAdapter } from "./base";
import type { AccountStats, InboundMessage, PostStats, PublishInput, PublishResult } from "./types";

// Instagram Graph API (via Facebook Login for Business)
export class InstagramAdapter extends BasePlatformAdapter {
  platform = Platform.INSTAGRAM;
  protected clientId = process.env.INSTAGRAM_CLIENT_ID ?? "";
  protected clientSecret = process.env.INSTAGRAM_CLIENT_SECRET ?? "";

  authUrl(redirectUri: string, state: string) {
    const u = new URL("https://www.facebook.com/v19.0/dialog/oauth");
    u.searchParams.set("client_id", this.clientId);
    u.searchParams.set("redirect_uri", redirectUri);
    u.searchParams.set("state", state);
    u.searchParams.set(
      "scope",
      "instagram_basic,instagram_content_publish,instagram_manage_comments,instagram_manage_messages,pages_show_list,pages_read_engagement",
    );
    return u.toString();
  }

  protected async realConnect(code: string, redirectUri: string) {
    const t = (await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${this.clientId}&client_secret=${this.clientSecret}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`,
    ).then((r) => r.json())) as any;
    const accounts = (await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?access_token=${t.access_token}`,
    ).then((r) => r.json())) as any;
    const igPage = accounts?.data?.[0];
    return {
      accessToken: t.access_token,
      expiresAt: new Date(Date.now() + (t.expires_in ?? 5184000) * 1000),
      handle: igPage?.name ?? "unknown",
      externalId: igPage?.id ?? "",
      scopes: "ig_basic,publish",
    };
  }

  protected async realRefresh(refreshToken: string) {
    return {
      accessToken: refreshToken,
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    };
  }

  protected async realPublish(token: string, input: PublishInput): Promise<PublishResult> {
    // Two-step: create container, then publish.
    const igUserId = process.env.INSTAGRAM_BUSINESS_ID ?? "me";
    const caption = [input.hook, input.caption, input.cta, input.hashtags]
      .filter(Boolean)
      .join("\n\n");
    const params = new URLSearchParams({
      image_url: input.mediaUrls[0] ?? "",
      caption,
      access_token: token,
    });
    const container = (await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media`, {
      method: "POST",
      body: params,
    }).then((r) => r.json())) as any;
    const publish = (await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media_publish`, {
      method: "POST",
      body: new URLSearchParams({ creation_id: container.id, access_token: token }),
    }).then((r) => r.json())) as any;
    return { externalPostId: publish.id };
  }

  protected async realFetchAccountStats(token: string, externalId: string): Promise<AccountStats> {
    const r = (await fetch(
      `https://graph.facebook.com/v19.0/${externalId}?fields=followers_count,follows_count,media_count&access_token=${token}`,
    ).then((r) => r.json())) as any;
    return {
      followers: r.followers_count ?? 0,
      following: r.follows_count ?? 0,
      posts: r.media_count ?? 0,
    };
  }

  protected async realFetchPostStats(token: string, externalPostId: string): Promise<PostStats> {
    const r = (await fetch(
      `https://graph.facebook.com/v19.0/${externalPostId}/insights?metric=impressions,reach,engagement,saved&access_token=${token}`,
    ).then((r) => r.json())) as any;
    const m = (name: string) => r.data?.find((x: any) => x.name === name)?.values?.[0]?.value ?? 0;
    return {
      views: m("impressions"),
      likes: 0,
      comments: 0,
      shares: 0,
      saves: m("saved"),
      reach: m("reach"),
    };
  }

  protected async realFetchInbox(_t: string, _s: string): Promise<InboundMessage[]> {
    return [];
  }
  protected async realReply(token: string, externalConversationId: string, body: string) {
    await fetch(`https://graph.facebook.com/v19.0/${externalConversationId}/replies`, {
      method: "POST",
      body: new URLSearchParams({ message: body, access_token: token }),
    });
  }
}
