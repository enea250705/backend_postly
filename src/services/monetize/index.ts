import { prisma } from "../../config/db";
import { generateLanding, suggestMonetization } from "../ai";
import { consumeCredit } from "../ai/credits";
import { NotFound } from "../../utils/errors";

export const suggestOffers = async (userId: string, count = 3) => {
  await consumeCredit(userId, "monetize", 2);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  // sum followers across accounts as a coarse signal
  const accounts = await prisma.socialAccount.findMany({
    where: { userId },
    include: { metrics: { orderBy: { capturedAt: "desc" }, take: 1 } },
  });
  const followers = accounts.reduce((s, a) => s + (a.metrics[0]?.followers ?? 0), 0);

  const out = await suggestMonetization({
    niche: user?.niche ?? "general",
    followerCount: followers || undefined,
    goals: user?.goals ?? undefined,
    count,
  });

  await prisma.monetizationIdea.createMany({
    data: out.offers.map((o) => ({
      userId,
      niche: user?.niche ?? "general",
      productType: o.productType,
      title: o.title,
      pitch: o.pitch,
      audience: o.audience,
      pricingHint: o.pricingHint,
    })),
  });

  return out.offers;
};

export const listOffers = (userId: string) =>
  prisma.monetizationIdea.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 30 });

export const generateLandingForOffer = async (userId: string, offerId: string) => {
  const offer = await prisma.monetizationIdea.findUnique({ where: { id: offerId } });
  if (!offer || offer.userId !== userId) throw NotFound("offer");
  await consumeCredit(userId, "landing");
  const landing = await generateLanding({
    productType: offer.productType,
    title: offer.title,
    pitch: offer.pitch,
    audience: offer.audience,
    pricingHint: offer.pricingHint ?? undefined,
  });
  await prisma.monetizationIdea.update({
    where: { id: offerId },
    data: { landingCopy: JSON.stringify(landing) },
  });
  return landing;
};
