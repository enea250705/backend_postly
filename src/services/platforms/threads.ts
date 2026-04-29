import { Platform } from "@prisma/client";
import { BasePlatformAdapter } from "./base";
import type { AccountStats, InboundMessage, PostStats, PublishInput, PublishResult } from "./types";

export class ThreadsAdapter extends BasePlatformAdapter {
  platform = Platform.THREADS;
  protected clientId = process.env.THREADS_CLIENT_ID ?? "";
  protected clientSecret = process.env.THREADS_CLIENT_SECRET ?? "";

  authUrl(redirectUri: string, state: string) {
    const u = new URL("https://threads.net/oauth/authorize");
    u.searchParams.set("client_id", this.clientId);
    u.searchParams.set("redirect_uri", redirectUri);
    u.searchParams.set("response_type", "code");
    u.searchParams.set(
      "scope",
      "threads_basic,threads_content_publish,threads_manage_replies,threads_read_replies",
    );
    u.searchParams.set("state", state);
    return u.toString();
  }

  protected async realConnect(code: string, redirectUri: string) {
    const t = (await fetch("https://graph.threads.net/oauth/access_token", {
      method: "POST",
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
      }),
    }).then((r) => r.json())) as any;
    return {
      accessToken: t.access_token,
      externalId: t.user_id?.toString() ?? "",
      handle: "threads_user",
      expiresAt: new Date(Date.now() + 60 * 86400 * 1000),
      scopes: "threads_basic",
    };
  }
  protected async realRefresh(refreshToken: string) {
    return { accessToken: refreshToken, expiresAt: new Date(Date.now() + 60 * 86400 * 1000) };
  }
  protected async realPublish(token: string, input: PublishInput): Promise<PublishResult> {
    const userId = process.env.THREADS_USER_ID ?? "me";
    const text = [input.hook, input.caption, input.cta].filter(Boolean).join("\n\n").slice(0, 500);
    const c = (await fetch(`https://graph.threads.net/v1.0/${userId}/threads`, {
      method: "POST",
      body: new URLSearchParams({ media_type: "TEXT", text, access_token: token }),
    }).then((r) => r.json())) as any;
    const p = (await fetch(`https://graph.threads.net/v1.0/${userId}/threads_publish`, {
      method: "POST",
      body: new URLSearchParams({ creation_id: c.id, access_token: token }),
    }).then((r) => r.json())) as any;
    return { externalPostId: p.id ?? "" };
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
