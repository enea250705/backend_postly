import type { Platform } from "@prisma/client";
import { prisma } from "../config/db";
import { getAdapter } from "./platforms";
import { NotFound } from "../utils/errors";

export const startConnect = (platform: Platform, redirectUri: string, state: string) => {
  return getAdapter(platform).authUrl(redirectUri, state);
};

export const completeConnect = async (
  userId: string,
  platform: Platform,
  code: string,
  redirectUri: string,
) => {
  const result = await getAdapter(platform).connect(code, redirectUri);
  return prisma.socialAccount.upsert({
    where: {
      userId_platform_handle: { userId, platform, handle: result.handle },
    },
    update: {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      tokenExpires: result.expiresAt,
      scopes: result.scopes,
      externalId: result.externalId,
      isActive: true,
    },
    create: {
      userId,
      platform,
      handle: result.handle,
      externalId: result.externalId,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      tokenExpires: result.expiresAt,
      scopes: result.scopes,
    },
  });
};

export const listAccounts = (userId: string) =>
  prisma.socialAccount.findMany({
    where: { userId },
    include: { metrics: { take: 1, orderBy: { capturedAt: "desc" } } },
    orderBy: { connectedAt: "desc" },
  });

export const disconnectAccount = async (userId: string, id: string) => {
  const a = await prisma.socialAccount.findUnique({ where: { id } });
  if (!a || a.userId !== userId) throw NotFound("account");
  await prisma.socialAccount.update({ where: { id }, data: { isActive: false } });
};

export const refreshAccountStats = async (userId: string, id: string) => {
  const a = await prisma.socialAccount.findUnique({ where: { id } });
  if (!a || a.userId !== userId) throw NotFound("account");
  const stats = await getAdapter(a.platform).fetchAccountStats(a.accessToken, a.externalId ?? "");
  return prisma.accountMetric.create({
    data: {
      accountId: a.id,
      followers: stats.followers,
      following: stats.following,
      posts: stats.posts,
      engagementRate: stats.engagementRate,
    },
  });
};
