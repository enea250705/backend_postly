import { prisma } from "../../config/db";
import { classifyIntent, writeReply } from "../ai";
import { consumeCredit } from "../ai/credits";
import { getAdapter } from "../platforms";
import { ConversationKind, Platform } from "@prisma/client";

export const upsertRule = async (
  userId: string,
  data: {
    platform?: Platform;
    matchType: string;
    match: string;
    responseTpl: string;
    funnelLink?: string;
    enabled?: boolean;
  },
) =>
  prisma.inboxRule.create({
    data: { userId, ...data, enabled: data.enabled ?? true },
  });

export const listRules = (userId: string) =>
  prisma.inboxRule.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });

export const removeRule = (userId: string, id: string) =>
  prisma.inboxRule.deleteMany({ where: { id, userId } });

// Process a single inbound message: classify, optionally auto-reply.
export const processInbound = async (params: {
  userId: string;
  platform: Platform;
  kind: ConversationKind;
  externalId: string;
  participant: string;
  body: string;
}) => {
  // record/update conversation
  const convo = await prisma.conversation.upsert({
    where: { id: `${params.platform}-${params.externalId}` }, // synthetic
    update: { lastMessage: params.body, updatedAt: new Date() },
    create: {
      id: `${params.platform}-${params.externalId}`,
      userId: params.userId,
      platform: params.platform,
      kind: params.kind,
      externalId: params.externalId,
      participant: params.participant,
      lastMessage: params.body,
    },
  });

  await prisma.message.create({
    data: { conversationId: convo.id, fromUser: false, body: params.body },
  });

  // classify
  await consumeCredit(params.userId, "intent");
  const cls = await classifyIntent(params.body);
  await prisma.conversation.update({
    where: { id: convo.id },
    data: { lastIntent: cls.intent, funnelStage: cls.funnelStage },
  });

  if (!cls.shouldAutoReply) return { conversation: convo, intent: cls, replied: false };

  // find a matching rule (intent first, then keyword, then "any")
  const rules = await prisma.inboxRule.findMany({
    where: { userId: params.userId, enabled: true, OR: [{ platform: params.platform }, { platform: null }] },
  });
  const intentRule = rules.find((r) => r.matchType === "intent" && r.match === cls.intent);
  const keywordRule = rules.find(
    (r) => r.matchType === "keyword" && params.body.toLowerCase().includes(r.match.toLowerCase()),
  );
  const anyRule = rules.find((r) => r.matchType === "any");
  const rule = intentRule ?? keywordRule ?? anyRule;
  if (!rule) return { conversation: convo, intent: cls, replied: false };

  // Generate the actual reply (uses tone + niche from user)
  const user = await prisma.user.findUnique({ where: { id: params.userId } });
  const reply = await writeReply({
    message: params.body,
    intent: cls.intent,
    tone: user?.tone ?? "friendly",
    niche: user?.niche ?? "general",
    funnelLink: rule.funnelLink ?? null,
    kind: params.kind,
  });

  // Send via adapter
  const account = await prisma.socialAccount.findFirst({
    where: { userId: params.userId, platform: params.platform, isActive: true },
  });
  if (account) {
    await getAdapter(params.platform).reply(account.accessToken, params.externalId, reply.reply);
  }

  await prisma.conversation.update({ where: { id: convo.id }, data: { autoReplied: true } });
  await prisma.message.create({
    data: { conversationId: convo.id, fromUser: true, body: reply.reply, intent: cls.intent },
  });

  return { conversation: convo, intent: cls, replied: true, reply: reply.reply };
};

export const listConversations = (userId: string) =>
  prisma.conversation.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
