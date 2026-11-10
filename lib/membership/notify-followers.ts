import { prisma } from "@/lib/db/client";
import { NOTIFICATION_TYPES, notify } from "@/lib/notifications/service";

/**
 * Tells a seller's followers about a newly published listing. Called only on the transition to PUBLISHED, never on an
 * edit to a listing that is already published. Text is fixed: no listing text, no seller text, no contact details.
 * notify() respects each follower's preferences. Never throws, so a notification problem cannot undo a publish.
 *
 * Cap: at most FOLLOWER_NOTIFY_CAP followers are notified per publish (the oldest follows first). A seller with more
 * followers than the cap gets the notice from the first 500 only; this keeps one publish from sending an unbounded
 * number of messages inside a request.
 */
export const FOLLOWER_NOTIFY_CAP = 500;
const BATCH_SIZE = 25;

export const FOLLOW_NOTICE = {
  title: "New listing from a seller you follow",
  body: "A seller you follow has published a new gemstone listing on Gemstone Selections.",
} as const;

export async function notifyFollowersOfNewListing(input: { sellerId: string; listingSlug: string }): Promise<number> {
  try {
    const followers = await prisma.follow.findMany({
      where: { sellerId: input.sellerId, follower: { status: "ACTIVE" } },
      select: { followerId: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: FOLLOWER_NOTIFY_CAP,
    });
    const href = `/gemstones/${input.listingSlug}`;
    for (let i = 0; i < followers.length; i += BATCH_SIZE) {
      const batch = followers.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map((f) =>
          notify({
            userId: f.followerId,
            type: NOTIFICATION_TYPES.FOLLOWED_NEW_LISTING,
            title: FOLLOW_NOTICE.title,
            body: FOLLOW_NOTICE.body,
            href,
          }),
        ),
      );
    }
    return followers.length;
  } catch (error) {
    console.error("[membership] follower notice failed", input.sellerId, error);
    return 0;
  }
}
