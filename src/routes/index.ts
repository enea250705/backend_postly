import { Router } from "express";
import { authRouter } from "./auth.routes";
import { aiRouter } from "./ai.routes";
import { postsRouter } from "./posts.routes";
import { accountsRouter } from "./accounts.routes";
import { calendarRouter } from "./calendar.routes";
import { analyticsRouter } from "./analytics.routes";
import { growthRouter } from "./growth.routes";
import { inboxRouter } from "./inbox.routes";
import { monetizeRouter } from "./monetize.routes";
import { billingRouter } from "./billing.routes";
import { meRouter } from "./me.routes";
import { requireAuth } from "../middleware/auth";

export const router = Router();

router.use("/auth", authRouter);
router.use("/billing", billingRouter); // public plans + authed status

// authenticated below
router.use("/me", requireAuth, meRouter);
router.use("/ai", requireAuth, aiRouter);
router.use("/posts", requireAuth, postsRouter);
router.use("/platforms", requireAuth, accountsRouter);
router.use("/calendar", requireAuth, calendarRouter);
router.use("/analytics", requireAuth, analyticsRouter);
router.use("/growth", requireAuth, growthRouter);
router.use("/inbox", requireAuth, inboxRouter);
router.use("/monetize", requireAuth, monetizeRouter);
