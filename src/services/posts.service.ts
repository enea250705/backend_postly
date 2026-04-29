import type { Platform, ContentFormat, PostStatus } from "@prisma/client";
import { prisma } from "../config/db";
import { BadRequest, Forbidden, NotFound } from "../utils/errors";
import { getAdapter } from "./platforms";

export interface CreatePostInput {
  platform: Platform;
  format: ContentFormat;
  caption: string;
  hook?: string;
  cta?: string;
  hashtags?: string;
  mediaUrls?: string[];
  scheduledAt?: string;
  accountId?: string;
}

export const createPost = async (userId: string, input: CreatePostInput) => {
  if (!input.caption?.trim()) throw BadRequest("caption is required");
  const status: PostStatus = input.scheduledAt ? "SCHEDULED" : "DRAFT";
  return prisma.post.create({
    data: {
      userId,
      platform: input.platform,
      format: input.format,
      caption: input.caption,
      hook: input.hook,
      cta: input.cta,
      hashtags: input.hashtags,
      mediaUrls: input.mediaUrls ?? [],
      status,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      accountId: input.accountId,
      generatedBy: "user",
    },
  });
};

export const listPosts = (userId: string, params: { status?: PostStatus; platform?: Platform }) =>
  prisma.post.findMany({
    where: { userId, ...(params.status && { status: params.status }), ...(params.platform && { platform: params.platform }) },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { metrics: { take: 1, orderBy: { capturedAt: "desc" } } },
  });

export const updatePost = async (userId: string, id: string, patch: Partial<CreatePostInput>) => {
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post || post.userId !== userId) throw NotFound("post");
  if (post.status === "PUBLISHED") throw Forbidden("Cannot edit a published post");
  return prisma.post.update({
    where: { id },
    data: {
      caption: patch.caption,
      hook: patch.hook,
      cta: patch.cta,
      hashtags: patch.hashtags,
      mediaUrls: patch.mediaUrls,
      scheduledAt: patch.scheduledAt ? new Date(patch.scheduledAt) : undefined,
      status: patch.scheduledAt ? "SCHEDULED" : undefined,
    },
  });
};

export const schedulePost = async (userId: string, id: string, scheduledAt: string) => {
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post || post.userId !== userId) throw NotFound("post");
  return prisma.post.update({
    where: { id },
    data: { scheduledAt: new Date(scheduledAt), status: "SCHEDULED" },
  });
};

export const publishPostNow = async (userId: string, id: string) => {
  const post = await prisma.post.findUnique({
    where: { id },
    include: { account: true },
  });
  if (!post || post.userId !== userId) throw NotFound("post");
  if (!post.account) throw BadRequest("Post has no connected account");
  await prisma.post.update({ where: { id }, data: { status: "PUBLISHING" } });
  try {
    const adapter = getAdapter(post.platform);
    const r = await adapter.publish(post.account.accessToken, {
      caption: post.caption,
      hook: post.hook,
      cta: post.cta,
      hashtags: post.hashtags,
      mediaUrls: post.mediaUrls,
      format: post.format,
    });
    return prisma.post.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        externalPostId: r.externalPostId,
      },
    });
  } catch (err: any) {
    await prisma.post.update({
      where: { id },
      data: { status: "FAILED", failureReason: String(err?.message ?? err) },
    });
    throw err;
  }
};

export const deletePost = async (userId: string, id: string) => {
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post || post.userId !== userId) throw NotFound("post");
  await prisma.post.delete({ where: { id } });
};
