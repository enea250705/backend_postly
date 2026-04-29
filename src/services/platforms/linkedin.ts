import { Platform } from "@prisma/client";
import { BasePlatformAdapter } from "./base";
import type { AccountStats, InboundMessage, PostStats, PublishInput, PublishResult } from "./types";

export class LinkedInAdapter extends BasePlatformAdapter {
  platform = Platform.LINKEDIN;
  protected clientId = process.env.LINKEDIN_CLIENT_ID ?? "";
  protected clientSecret = process.env.LINKEDIN_CLIENT_SECRET ?? "";

  authUrl(redirectUri: string, state: string) {
    const u = new URL("https://www.linkedin.com/oauth/v2/authorization");
    u.searchParams.set("response_type", "code");
    u.searchParams.set("client_id", this.clientId);
    u.searchParams.set("redirect_uri", redirectUri);
    u.searchParams.set("state", state);
    u.searchParams.set("scope", "openid profile email w_member_social r_liteprofile");
    return u.toString();
  }

  protected async realConnect(code: string, redirectUri: string) {
    const t = (await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    }).then((r) => r.json())) as any;
    const me = (await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${t.access_token}` },
    }).then((r) => r.json())) as any;
    return {
      accessToken: t.access_token,
      expiresAt: new Date(Date.now() + (t.expires_in ?? 60 * 86400) * 1000),
      handle: me.name ?? "unknown",
      externalId: me.sub ?? "",
      scopes: t.scope,
    };
  }

  protected async realRefresh(refreshToken: string) {
    return { accessToken: refreshToken, expiresAt: new Date(Date.now() + 60 * 86400 * 1000) };
  }

  protected async realPublish(token: string, input: PublishInput): Promise<PublishResult> {
    const author = `urn:li:person:${process.env.LINKEDIN_PERSON_URN ?? ""}`;
    const text = [input.hook, input.caption, input.cta].filter(Boolean).join("\n\n");
    const r = (await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        author,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text },
            shareMediaCategory: "NONE",
          },
        },
        visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
      }),
    }).then((r) => r.json())) as any;
    return { externalPostId: r.id ?? "" };
  }

  protected async realFetchAccountStats(): Promise<AccountStats> {
    return { followers: 0, following: 0, posts: 0 };
  }
  protected async realFetchPostStats(): Promise<PostStats> {
    return { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, reach: 0 };
  }
  protected async realFetchInbox(): Promise<InboundMessage[]> {
    return [];
  }
  protected async realReply(): Promise<void> {}
}
