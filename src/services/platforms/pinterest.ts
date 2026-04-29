import { Platform } from "@prisma/client";
import { BasePlatformAdapter } from "./base";
import type { AccountStats, InboundMessage, PostStats, PublishInput, PublishResult } from "./types";

export class PinterestAdapter extends BasePlatformAdapter {
  platform = Platform.PINTEREST;
  protected clientId = process.env.PINTEREST_CLIENT_ID ?? "";
  protected clientSecret = process.env.PINTEREST_CLIENT_SECRET ?? "";

  authUrl(redirectUri: string, state: string) {
    const u = new URL("https://www.pinterest.com/oauth/");
    u.searchParams.set("client_id", this.clientId);
    u.searchParams.set("redirect_uri", redirectUri);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("scope", "boards:read,pins:read,pins:write,user_accounts:read");
    u.searchParams.set("state", state);
    return u.toString();
  }
  protected async realConnect(code: string, redirectUri: string) {
    const t = (await fetch("https://api.pinterest.com/v5/oauth/token", {
      method: "POST",
      headers: {
        Authorization:
          "Basic " + Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    }).then((r) => r.json())) as any;
    const me = (await fetch("https://api.pinterest.com/v5/user_account", {
      headers: { Authorization: `Bearer ${t.access_token}` },
    }).then((r) => r.json())) as any;
    return {
      accessToken: t.access_token,
      refreshToken: t.refresh_token,
      expiresAt: new Date(Date.now() + (t.expires_in ?? 30 * 86400) * 1000),
      handle: me.username ?? "unknown",
      externalId: me.username ?? "",
      scopes: t.scope,
    };
  }
  protected async realRefresh(refreshToken: string) {
    const r = (await fetch("https://api.pinterest.com/v5/oauth/token", {
      method: "POST",
      headers: {
        Authorization:
          "Basic " + Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
    }).then((r) => r.json())) as any;
    return {
      accessToken: r.access_token,
      refreshToken: r.refresh_token ?? refreshToken,
      expiresAt: new Date(Date.now() + (r.expires_in ?? 30 * 86400) * 1000),
    };
  }
  protected async realPublish(token: string, input: PublishInput): Promise<PublishResult> {
    const r = (await fetch("https://api.pinterest.com/v5/pins", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        title: input.hook?.slice(0, 100) ?? "",
        description: input.caption.slice(0, 500),
        board_id: process.env.PINTEREST_BOARD_ID ?? "",
        media_source: { source_type: "image_url", url: input.mediaUrls[0] ?? "" },
      }),
    }).then((r) => r.json())) as any;
    return { externalPostId: r.id ?? "" };
  }
  protected async realFetchAccountStats(): Promise<AccountStats> {
    return { followers: 0, following: 0, posts: 0 };
  }
  protected async realFetchPostStats(token: string, externalPostId: string): Promise<PostStats> {
    const r = (await fetch(
      `https://api.pinterest.com/v5/pins/${externalPostId}/analytics?metric_types=IMPRESSION,SAVE,PIN_CLICK&start_date=2024-01-01&end_date=2026-12-31`,
      { headers: { Authorization: `Bearer ${token}` } },
    ).then((r) => r.json())) as any;
    return {
      views: r?.IMPRESSION?.summary_metrics?.IMPRESSION ?? 0,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: r?.SAVE?.summary_metrics?.SAVE ?? 0,
      reach: r?.IMPRESSION?.summary_metrics?.IMPRESSION ?? 0,
      clickThrough: r?.PIN_CLICK?.summary_metrics?.PIN_CLICK ?? 0,
    };
  }
  protected async realFetchInbox(): Promise<InboundMessage[]> {
    return [];
  }
  protected async realReply(): Promise<void> {}
}
