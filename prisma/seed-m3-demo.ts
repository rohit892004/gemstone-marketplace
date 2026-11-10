import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@/app/generated/prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { assertDemoAllowed } from "@/lib/demo/guard";
import { MASK } from "@/lib/messaging/moderation";

/**
 * M3 demo data: demo buyers, enquiry and general conversations, a masked phone number in the flagged
 * queue, an offer (PENDING), a quotation (SENT), two open requirements and one requirement response.
 *
 * Every row is labelled Demo: Conversation.isDemo, Requirement.isDemo, and message text begins with
 * "Demo". Buyer emails use example.com (reserved). Nothing here is real.
 *
 * Writes with Prisma directly, not through the messaging or notification services, so it does not
 * depend on them. It runs after seedDemo() (prisma/seed-demo.ts), which creates the demo sellers and
 * listings this seed attaches to. It calls assertDemoAllowed() first, and refuses in production.
 */

export const M3_DEMO_EMAIL_DOMAIN = "example.com";
const DEMO_BUYER_EMAILS = [1, 2, 3].map((n) => `demo-buyer-${n}@${M3_DEMO_EMAIL_DOMAIN}`);

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

interface Listing {
  id: string;
  title: string;
  priceMinor: bigint | null;
  currency: string;
  sellerUserId: string;
}

/** Amount used for demo offers and quotations: the listing price, or a fixed demo amount. */
function demoAmount(listing: Listing): bigint {
  return listing.priceMinor ?? BigInt(50_000_000);
}

/** Pair keys match lib/messaging/service.ts so a demo conversation looks like a real one. */
function generalPairKey(a: string, b: string): string {
  const [x, y] = [a, b].sort();
  return `gen:${x}:${y}`;
}

export async function seedM3Demo(prisma: PrismaClient, now = new Date()): Promise<void> {
  assertDemoAllowed();

  // 1. Clear earlier M3 demo rows. Conversations cascade to messages, offers, quotations, flags and
  //    participants; requirements cascade to responses. Only demo-flagged rows and the demo buyers go.
  await prisma.conversation.deleteMany({ where: { isDemo: true } });
  await prisma.requirement.deleteMany({ where: { isDemo: true } });
  await prisma.user.deleteMany({ where: { email: { in: DEMO_BUYER_EMAILS } } });

  // 2. Inputs from the earlier demo seed.
  const sellers = await prisma.sellerProfile.findMany({
    where: { isDemo: true, approvalStatus: "APPROVED" },
    orderBy: { slug: "asc" },
    select: { userId: true },
  });
  if (sellers.length < 2) {
    throw new Error('Demo sellers are missing. Run "npm run db:seed:demo", which runs this seed after the sellers.');
  }
  const listingRows = await prisma.gemstone.findMany({
    where: { isDemo: true, status: "PUBLISHED", availability: "AVAILABLE" },
    orderBy: { slug: "asc" },
    take: 3,
    select: {
      id: true,
      title: true,
      priceMinor: true,
      currency: true,
      seller: { select: { userId: true } },
    },
  });
  if (listingRows.length < 3) {
    throw new Error('Three available demo listings are needed. Run "npm run db:seed:demo" first.');
  }
  const [listingA, listingB, listingC] = listingRows.map<Listing>((row) => ({
    id: row.id,
    title: row.title,
    priceMinor: row.priceMinor,
    currency: row.currency,
    sellerUserId: row.seller.userId,
  }));
  const categories = await prisma.category.findMany({
    where: { slug: { in: ["sapphire", "emerald"] } },
    select: { id: true, slug: true },
  });
  const categoryId = (slug: string) => categories.find((c) => c.slug === slug)?.id ?? null;

  // 3. Demo buyers. Passwords are random and unusable unless DEMO_BUYER_PASSWORD is set (dev only; this seed
  // refuses to run in production, so the variable is never read there).
  const demoBuyerPassword = process.env.DEMO_BUYER_PASSWORD?.trim();
  const buyerIds: string[] = [];
  for (const [index, email] of DEMO_BUYER_EMAILS.entries()) {
    const name = `Demo buyer ${index + 1}`;
    const user = await prisma.user.create({
      data: {
        email,
        name,
        role: "BUYER",
        status: "ACTIVE",
        emailVerifiedAt: now,
        passwordHash: await hashPassword(demoBuyerPassword || randomBytes(32).toString("hex")),
        // Buyer 1 has one contact-detail strike from the masked message below (a warning, not a restriction).
        contactStrikes: index === 0 ? 1 : 0,
        buyerProfile: { create: { name, country: "India", interests: ["Sapphire", "Emerald"] } },
      },
      select: { id: true },
    });
    buyerIds.push(user.id);
  }
  const [buyer1, buyer2, buyer3] = buyerIds;

  const addMessage = (data: {
    conversationId: string;
    senderId: string;
    body: string;
    createdAt: Date;
    kind?: "TEXT" | "OFFER" | "QUOTATION";
    flagged?: boolean;
  }) => prisma.message.create({ data: { kind: "TEXT", ...data }, select: { id: true } });

  const createConversation = (data: {
    kind: "ENQUIRY" | "GENERAL" | "REQUIREMENT";
    pairKey: string;
    startedById: string;
    participantIds: string[];
    gemstoneId?: string;
    requirementId?: string;
    lastMessageAt: Date;
  }) =>
    prisma.conversation.create({
      data: {
        kind: data.kind,
        pairKey: data.pairKey,
        startedById: data.startedById,
        gemstoneId: data.gemstoneId,
        requirementId: data.requirementId,
        isDemo: true,
        lastMessageAt: data.lastMessageAt,
        participants: { create: data.participantIds.map((userId) => ({ userId })) },
      },
      select: { id: true },
    });

  const base = new Date(now.getTime() - 2 * DAY);
  const at = (minutes: number) => new Date(base.getTime() + minutes * MINUTE);

  // 4. Enquiry on listing A from buyer 1, with a masked phone number (goes to the flagged queue).
  const convA = await createConversation({
    kind: "ENQUIRY",
    pairKey: `enq:${listingA.id}:${buyer1}`,
    startedById: buyer1,
    participantIds: [buyer1, listingA.sellerUserId],
    gemstoneId: listingA.id,
    lastMessageAt: at(40),
  });
  await addMessage({
    conversationId: convA.id,
    senderId: buyer1,
    body: "Demo message: Is this stone still available? I would like to see the certificate.",
    createdAt: at(0),
  });
  await addMessage({
    conversationId: convA.id,
    senderId: listingA.sellerUserId,
    body: "Demo reply: Yes, it is available. Sample conversation for testing only.",
    createdAt: at(20),
  });
  const maskedMessage = await addMessage({
    conversationId: convA.id,
    senderId: buyer1,
    body: `Demo message: You can reach me on ${MASK} after six.`,
    createdAt: at(40),
    flagged: true,
  });
  await prisma.moderationFlag.create({
    data: {
      conversationId: convA.id,
      messageId: maskedMessage.id,
      senderId: buyer1,
      source: "MESSAGE",
      kinds: ["PHONE"],
      status: "OPEN",
    },
  });

  // 5. Enquiry on listing B from buyer 2, ending with a PENDING offer.
  const convB = await createConversation({
    kind: "ENQUIRY",
    pairKey: `enq:${listingB.id}:${buyer2}`,
    startedById: buyer2,
    participantIds: [buyer2, listingB.sellerUserId],
    gemstoneId: listingB.id,
    lastMessageAt: at(60),
  });
  await addMessage({
    conversationId: convB.id,
    senderId: buyer2,
    body: "Demo message: Would you consider a lower price for a bulk order?",
    createdAt: at(0),
  });
  await addMessage({
    conversationId: convB.id,
    senderId: listingB.sellerUserId,
    body: "Demo reply: Please send an offer and we will review it.",
    createdAt: at(30),
  });
  const offerMessage = await addMessage({
    conversationId: convB.id,
    senderId: buyer2,
    kind: "OFFER",
    body: "Demo offer: an offer was sent. Sample data only.",
    createdAt: at(60),
  });
  await prisma.offer.create({
    data: {
      conversationId: convB.id,
      messageId: offerMessage.id,
      proposerId: buyer2,
      amountMinor: (demoAmount(listingB) * BigInt(90)) / BigInt(100),
      currency: listingB.currency,
      note: "Demo offer note: sample only. No payment is taken on this platform.",
      status: "PENDING",
    },
  });

  // 6. Enquiry on listing C from buyer 1, ending with a SENT quotation.
  const convC = await createConversation({
    kind: "ENQUIRY",
    pairKey: `enq:${listingC.id}:${buyer1}`,
    startedById: buyer1,
    participantIds: [buyer1, listingC.sellerUserId],
    gemstoneId: listingC.id,
    lastMessageAt: at(45),
  });
  await addMessage({
    conversationId: convC.id,
    senderId: buyer1,
    body: "Demo message: Could you quote for two stones of this size?",
    createdAt: at(0),
  });
  const quoteMessage = await addMessage({
    conversationId: convC.id,
    senderId: listingC.sellerUserId,
    kind: "QUOTATION",
    body: "Demo quotation sent. Sample data only.",
    createdAt: at(45),
  });
  await prisma.quotation.create({
    data: {
      conversationId: convC.id,
      messageId: quoteMessage.id,
      sellerId: listingC.sellerUserId,
      gemstoneId: listingC.id,
      itemTitle: listingC.title,
      quantity: 2,
      amountMinor: demoAmount(listingC) * BigInt(2),
      currency: listingC.currency,
      validUntil: new Date(now.getTime() + 14 * DAY),
      terms: "Demo terms: sample only. This is not a real quotation.",
      status: "SENT",
    },
  });

  // 7. General conversation between buyer 3 and the second demo seller.
  const generalSeller = sellers[1].userId;
  const convGeneral = await createConversation({
    kind: "GENERAL",
    pairKey: generalPairKey(buyer3, generalSeller),
    startedById: buyer3,
    participantIds: [buyer3, generalSeller],
    lastMessageAt: at(60),
  });
  await addMessage({
    conversationId: convGeneral.id,
    senderId: buyer3,
    body: "Demo message: Do you take custom orders for a matched pair?",
    createdAt: at(0),
  });
  await addMessage({
    conversationId: convGeneral.id,
    senderId: generalSeller,
    body: "Demo reply: Yes. Send your size and budget and we will reply.",
    createdAt: at(60),
  });

  // 8. Two open requirements. Buyer 2 wants sapphire, buyer 3 wants emerald.
  const requirementSapphire = await prisma.requirement.create({
    data: {
      buyerId: buyer2,
      categoryId: categoryId("sapphire"),
      gemstoneType: "Sapphire",
      shape: "Oval",
      caratMin: "1.000",
      caratMax: "3.000",
      budgetMinMinor: BigInt(50_000_000),
      budgetMaxMinor: BigInt(150_000_000),
      currency: "INR",
      certificateNeeded: true,
      originPreference: "Ceylon",
      quantity: 1,
      deadline: new Date(now.getTime() + 30 * DAY),
      notes: "Demo requirement: sample only. Please reply with photos and a certificate.",
      status: "OPEN",
      isDemo: true,
    },
    select: { id: true },
  });
  await prisma.requirement.create({
    data: {
      buyerId: buyer3,
      categoryId: categoryId("emerald"),
      gemstoneType: "Emerald",
      shape: "Cushion",
      caratMin: "2.000",
      caratMax: "4.000",
      budgetMinMinor: BigInt(80_000_000),
      budgetMaxMinor: BigInt(200_000_000),
      currency: "INR",
      certificateNeeded: false,
      quantity: 2,
      deadline: new Date(now.getTime() + 45 * DAY),
      notes: "Demo requirement: sample only.",
      status: "OPEN",
      isDemo: true,
    },
  });

  // 9. One seller response to the sapphire requirement, which opens a requirement conversation.
  const respondingSeller = sellers[0].userId;
  const convRequirement = await createConversation({
    kind: "REQUIREMENT",
    pairKey: `req:${requirementSapphire.id}:${respondingSeller}`,
    startedById: respondingSeller,
    participantIds: [buyer2, respondingSeller],
    requirementId: requirementSapphire.id,
    lastMessageAt: at(180),
  });
  await addMessage({
    conversationId: convRequirement.id,
    senderId: respondingSeller,
    body: "Demo reply to your requirement: we may have a matching stone. Sample conversation only.",
    createdAt: at(180),
  });
  await prisma.requirementResponse.create({
    data: {
      requirementId: requirementSapphire.id,
      sellerId: respondingSeller,
      conversationId: convRequirement.id,
    },
  });

  // 10. A few unread in-app notifications for the demo buyers, so the bell has a count.
  await prisma.notification.createMany({
    data: [
      {
        userId: buyer1,
        type: "quotation.received",
        payload: {
          title: "Demo: New quotation",
          body: "A seller sent you a quotation. Open the conversation to see it.",
          href: `/conversations/${convC.id}`,
        },
      },
      {
        userId: buyer2,
        type: "requirement.response",
        payload: {
          title: "Demo: New response to your requirement",
          body: "A seller has responded to your requirement. Open the conversation to read the reply.",
          href: `/conversations/${convRequirement.id}`,
        },
      },
    ],
  });

  console.log(
    "M3 demo seed complete: 3 buyers, 4 conversations (3 enquiries, 1 general) plus 1 requirement conversation, " +
      "1 flagged message, 1 PENDING offer, 1 SENT quotation, 2 open requirements.",
  );
}
