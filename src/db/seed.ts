import bcrypt from "bcryptjs";
import { prisma } from "../config/db";

async function main() {
  const passwordHash = await bcrypt.hash("demodemo", 12);
  const demo = await prisma.user.upsert({
    where: { email: "demo@postly.app" },
    update: {},
    create: {
      email: "demo@postly.app",
      passwordHash,
      displayName: "Demo Creator",
      niche: "fitness",
      tone: "energetic",
      goals: "grow to 10k followers in 90 days",
      plan: "PRO",
    },
  });

  await prisma.growthInsight.createMany({
    data: [
      {
        userId: demo.id,
        kind: "best-time",
        title: "Best window today: 18:00–19:00 UTC",
        body: "Your last 4 posts in this window averaged 3.2× the engagement of your weekly mean.",
        confidence: 0.86,
      },
      {
        userId: demo.id,
        kind: "next-post",
        title: "Try a transformation hook for fitness Reels",
        body: "Hooks framed as 'I tried X for 30 days and Y happened' outperform listicle hooks by 41% in your niche.",
        confidence: 0.78,
      },
    ],
  });

  // eslint-disable-next-line no-console
  console.log("Seeded demo user:", demo.email, "/ password: demodemo");
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
