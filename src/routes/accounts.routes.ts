import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import { Platform } from "@prisma/client";
import { asyncHandler } from "../utils/async";
import * as accounts from "../services/accounts.service";

export const accountsRouter = Router();

accountsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await accounts.listAccounts(req.user!.sub));
  }),
);

accountsRouter.post(
  "/:platform/connect",
  asyncHandler(async (req, res) => {
    const platform = z.nativeEnum(Platform).parse(req.params.platform.toUpperCase());
    const { redirectUri } = z.object({ redirectUri: z.string().url() }).parse(req.body);
    const state = crypto.randomBytes(16).toString("hex");
    const url = accounts.startConnect(platform, redirectUri, state);
    res.json({ url, state });
  }),
);

accountsRouter.post(
  "/:platform/callback",
  asyncHandler(async (req, res) => {
    const platform = z.nativeEnum(Platform).parse(req.params.platform.toUpperCase());
    const body = z
      .object({ code: z.string(), redirectUri: z.string().url() })
      .parse(req.body);
    res.json(await accounts.completeConnect(req.user!.sub, platform, body.code, body.redirectUri));
  }),
);

accountsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await accounts.disconnectAccount(req.user!.sub, req.params.id);
    res.status(204).end();
  }),
);

accountsRouter.post(
  "/:id/refresh-stats",
  asyncHandler(async (req, res) => {
    res.json(await accounts.refreshAccountStats(req.user!.sub, req.params.id));
  }),
);
