import { Router } from "express";
import { z } from "zod";
import { ConversationKind, Platform } from "@prisma/client";
import { asyncHandler } from "../utils/async";
import * as inbox from "../services/inbox";

export const inboxRouter = Router();

inboxRouter.get(
  "/rules",
  asyncHandler(async (req, res) => {
    res.json(await inbox.listRules(req.user!.sub));
  }),
);

const ruleSchema = z.object({
  platform: z.nativeEnum(Platform).optional(),
  matchType: z.enum(["keyword", "intent", "any"]),
  match: z.string(),
  responseTpl: z.string(),
  funnelLink: z.string().url().optional(),
  enabled: z.boolean().optional(),
});

inboxRouter.post(
  "/rules",
  asyncHandler(async (req, res) => {
    const body = ruleSchema.parse(req.body);
    res.status(201).json(await inbox.upsertRule(req.user!.sub, body));
  }),
);

inboxRouter.delete(
  "/rules/:id",
  asyncHandler(async (req, res) => {
    await inbox.removeRule(req.user!.sub, req.params.id);
    res.status(204).end();
  }),
);

const inboundSchema = z.object({
  platform: z.nativeEnum(Platform),
  kind: z.nativeEnum(ConversationKind),
  externalId: z.string(),
  participant: z.string(),
  body: z.string(),
});

// Manual entry point — adapters wired via webhook would call this internally.
inboxRouter.post(
  "/inbound",
  asyncHandler(async (req, res) => {
    const body = inboundSchema.parse(req.body);
    res.json(await inbox.processInbound({ userId: req.user!.sub, ...body }));
  }),
);

inboxRouter.get(
  "/conversations",
  asyncHandler(async (req, res) => {
    res.json(await inbox.listConversations(req.user!.sub));
  }),
);
