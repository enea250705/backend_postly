import { Platform } from "@prisma/client";
import { BasePlatformAdapter } from "./base";
import type { AccountStats, InboundMessage, PostStats, PublishInput, PublishResult } from "./types";

export class FacebookAdapter extends BasePlatformAdapter {
  platform = Platform.FACEBOOK;
  protected clientId = process.env.FACEBOOK_CLIENT_ID ?? "";
  protected clientSecret = process.env.FACEBOOK_CLIENT_SECRET ?? "";

  authUrl(redirectUri: string, state: string) {
    const u = new URL("https://www.facebook.com/v19.0/dialog/oauth");
    u.searchParams.set("client_id", this.clientId);
    u.searchParams.set("redirect_uri", redirectUri);
    u.searchParams.set("state", state);
    u.searchParams.set(
      "scope",
      "pages_manage_posts,pages_read_engagement,pages_show_list,pages_messaging",
    );
    return u.toString();
  }

  protected async realConnect(code: string, redirectUri: string) {
    const t = (await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${this.clientId}&client_secret=${this.clientSecret}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`,
    ).then((r) => r.json())) as any;
    const pages = (await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?access_token=${t.access_token}`,
    ).then((r) => r.json())) as any;
    const page = pages.data?.[0];
    return {
      accessToken: page?.access_token ?? t.access_token,
      expiresAt: new Date(Date.now() + (t.expires_in ?? 5184000) * 1000),
      handle: page?.name ?? "unknown",
      externalId: page?.id ?? "",
      scopes: "pages_manage_posts",
    };
  }
  protected async realRefresh(refreshToken: string) {
    return { accessToken: refreshToken, expiresAt: new Date(Date.now() + 60 * 86400 * 1000) };
  }
  protected async realPublish(token: string, input: PublishInput): Promise<PublishResult> {
    const pageId = process.env.FACEBOOK_PAGE_ID ?? "me";
    const message = [input.hook, input.caption, input.cta].filter(Boolean).join("\n\n");
    const r = (await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed`, {
      method: "POST",
      body: new URLSearchParams({ message, access_token: token }),
    }).then((r) => r.json())) as any;
    return { externalPostId: r.id ?? "" };
  }
  protected async realFetchAccountStats(token: string, externalId: string): Promise<AccountStats> {
    const r = (await fetch(
      `https://graph.facebook.com/v19.0/${externalId}?fields=fan_count&access_token=${token}`,
    ).then((r) => r.json())) as any;
    return { followers: r.fan_count ?? 0, following: 0, posts: 0 };
  }
  protected async realFetchPostStats(token: string, externalPostId: string): Promise<PostStats> {
    const r = (await fetch(
      `https://graph.facebook.com/v19.0/${externalPostId}/insights?metric=post_impressions,post_engaged_users&access_token=${token}`,
    ).then((r) => r.json())) as any;
    const m = (n: string) => r.data?.find((x: any) => x.name === n)?.values?.[0]?.value ?? 0;
    return {
      views: m("post_impressions"),
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      reach: m("post_engaged_users"),
    };
  }
  protected async realFetchInbox(): Promise<InboundMessage[]> {
    return [];
  }
  protected async realReply(token: string, externalConversationId: string, body: string) {
    await fetch(`https://graph.facebook.com/v19.0/${externalConversationId}/comments`, {
      method: "POST",
      body: new URLSearchParams({ message: body, access_token: token }),
    });
  }
}
