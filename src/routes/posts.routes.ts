import { Router } from "express";
import { z } from "zod";
import { ContentFormat, Platform, PostStatus } from "@prisma/client";
import { asyncHandler } from "../utils/async";
import * as posts from "../services/posts.service";

export const postsRouter = Router();

postsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const status = req.query.status as PostStatus | undefined;
    const platform = req.query.platform as Platform | undefined;
    res.json(await posts.listPosts(req.user!.sub, { status, platform }));
  }),
);

const createSchema = z.object({
  platform: z.nativeEnum(Platform),
  format: z.nativeEnum(ContentFormat),
  caption: z.string().min(1),
  hook: z.string().optional(),
  cta: z.string().optional(),
  hashtags: z.string().optional(),
  mediaUrls: z.array(z.string().url()).optional(),
  scheduledAt: z.string().datetime().optional(),
  accountId: z.string().optional(),
});

postsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    res.status(201).json(await posts.createPost(req.user!.sub, body));
  }),
);

postsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const body = createSchema.partial().parse(req.body);
    res.json(await posts.updatePost(req.user!.sub, req.params.id, body));
  }),
);

postsRouter.post(
  "/:id/schedule",
  asyncHandler(async (req, res) => {
    const { scheduledAt } = z
      .object({ scheduledAt: z.string().datetime() })
      .parse(req.body);
    res.json(await posts.schedulePost(req.user!.sub, req.params.id, scheduledAt));
  }),
);

postsRouter.post(
  "/:id/publish",
  asyncHandler(async (req, res) => {
    res.json(await posts.publishPostNow(req.user!.sub, req.params.id));
  }),
);

postsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await posts.deletePost(req.user!.sub, req.params.id);
    res.status(204).end();
  }),
);
