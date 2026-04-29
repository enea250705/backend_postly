import { Platform } from "@prisma/client";
import { BasePlatformAdapter } from "./base";
import type { AccountStats, InboundMessage, PostStats, PublishInput, PublishResult } from "./types";

export class TwitterAdapter extends BasePlatformAdapter {
  platform = Platform.TWITTER;
  protected clientId = process.env.TWITTER_CLIENT_ID ?? "";
  protected clientSecret = process.env.TWITTER_CLIENT_SECRET ?? "";

  authUrl(redirectUri: string, state: string) {
    const u = new URL("https://twitter.com/i/oauth2/authorize");
    u.searchParams.set("response_type", "code");
    u.searchParams.set("client_id", this.clientId);
    u.searchParams.set("redirect_uri", redirectUri);
    u.searchParams.set("scope", "tweet.read tweet.write users.read offline.access dm.read dm.write");
    u.searchParams.set("state", state);
    u.searchParams.set("code_challenge", "challenge");
    u.searchParams.set("code_challenge_method", "plain");
    return u.toString();
  }

  protected async realConnect(code: string, redirectUri: string) {
    const res = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " + Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64"),
      },
      body: new URLSearchParams({
        code,
        grant_type: "authorization_code",
        client_id: this.clientId,
        redirect_uri: redirectUri,
        code_verifier: "challenge",
      }),
    });
    const t = (await res.json()) as any;
    const me = await fetch("https://api.twitter.com/2/users/me", {
      headers: { Authorization: `Bearer ${t.access_token}` },
    }).then((r) => r.json() as any);
    return {
      accessToken: t.access_token,
      refreshToken: t.refresh_token,
      expiresAt: new Date(Date.now() + (t.expires_in ?? 7200) * 1000),
      handle: me.data?.username ?? "unknown",
      externalId: me.data?.id ?? "",
      scopes: t.scope,
    };
  }

  protected async realRefresh(refreshToken: string) {
    const res = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization:
          "Basic " + Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64"),
      },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        grant_type: "refresh_token",
        client_id: this.clientId,
      }),
    }).then((r) => r.json() as any);
    return {
      accessToken: res.access_token,
      refreshToken: res.refresh_token ?? refreshToken,
      expiresAt: new Date(Date.now() + (res.expires_in ?? 7200) * 1000),
    };
  }

  protected async realPublish(token: string, input: PublishInput): Promise<PublishResult> {
    // For threads, post sequential tweets and chain reply_to.
    const tweetText = [input.hook, input.caption, input.cta]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 280);
    const r = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: tweetText }),
    }).then((r) => r.json() as any);
    return { externalPostId: r.data?.id, url: `https://twitter.com/i/web/status/${r.data?.id}` };
  }

  protected async realFetchAccountStats(token: string, externalId: string): Promise<AccountStats> {
    const r = await fetch(
      `https://api.twitter.com/2/users/${externalId}?user.fields=public_metrics`,
      { headers: { Authorization: `Bearer ${token}` } },
    ).then((r) => r.json() as any);
    const m = r.data?.public_metrics ?? {};
    return {
      followers: m.followers_count ?? 0,
      following: m.following_count ?? 0,
      posts: m.tweet_count ?? 0,
    };
  }

  protected async realFetchPostStats(token: string, externalPostId: string): Promise<PostStats> {
    const r = await fetch(
      `https://api.twitter.com/2/tweets/${externalPostId}?tweet.fields=public_metrics,non_public_metrics`,
      { headers: { Authorization: `Bearer ${token}` } },
    ).then((r) => r.json() as any);
    const pm = r.data?.public_metrics ?? {};
    const np = r.data?.non_public_metrics ?? {};
    return {
      views: np.impression_count ?? pm.impression_count ?? 0,
      likes: pm.like_count ?? 0,
      comments: pm.reply_count ?? 0,
      shares: pm.retweet_count ?? 0,
      saves: pm.bookmark_count ?? 0,
      reach: np.impression_count ?? 0,
    };
  }

  protected async realFetchInbox(_token: string, _sinceISO: string): Promise<InboundMessage[]> {
    return []; // mentions endpoint requires elevated access; stub for now
  }

  protected async realReply(
    token: string,
    externalConversationId: string,
    body: string,
  ): Promise<void> {
    await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: body.slice(0, 280),
        reply: { in_reply_to_tweet_id: externalConversationId },
      }),
    });
  }
}
