import { prisma } from "../../config/db";
import { Forbidden } from "../../utils/errors";

const PLAN_LIMITS: Record<string, number> = {
  FREE: 10,
  CREATOR: 200,
  PRO: 100_000, // effectively unlimited
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const consumeCredit = async (userId: string, kind: string, weight = 1) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw Forbidden("User not found");

  // Reset weekly window
  if (Date.now() - user.aiCreditsReset.getTime() >= WEEK_MS) {
    await prisma.user.update({
      where: { id: userId },
      data: { aiCreditsUsed: 0, aiCreditsReset: new Date() },
    });
    user.aiCreditsUsed = 0;
  }

  const limit = PLAN_LIMITS[user.plan] ?? PLAN_LIMITS.FREE;
  if (user.aiCreditsUsed + weight > limit) {
    throw Forbidden(
      `Weekly AI quota reached for plan ${user.plan} (${limit}). Upgrade to continue.`,
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: { aiCreditsUsed: { increment: weight } },
  });

  return { remaining: Math.max(0, limit - user.aiCreditsUsed - weight), kind };
};

export const getCreditStatus = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  const limit = PLAN_LIMITS[user.plan] ?? PLAN_LIMITS.FREE;
  return {
    plan: user.plan,
    limit,
    used: user.aiCreditsUsed,
    remaining: Math.max(0, limit - user.aiCreditsUsed),
    resetAt: new Date(user.aiCreditsReset.getTime() + WEEK_MS),
  };
};
