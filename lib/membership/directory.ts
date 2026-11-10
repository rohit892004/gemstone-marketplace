/**
 * Directory and carousel ranking. Pure. The score is the rating on a 100-point scale (rating x 20) plus the tier's
 * ranking boost, which is also in points on that scale. A Premium boost of 10 is half a star; Elite 20 is one star.
 * Unrated sellers score from the boost alone. Ties go to more reviews, then to the id, so the order is stable.
 *
 * The sort keeps every field of the item it is given. In particular isDemo is never changed, so a demo seller keeps
 * its Demo label wherever the boost puts it.
 */

export interface RankableSeller {
  id: string;
  ratingAverage: number | null;
  reviewCount: number;
  rankingBoost: number;
}

export function rankScore(seller: Pick<RankableSeller, "ratingAverage" | "rankingBoost">): number {
  const rating = seller.ratingAverage ?? 0;
  return rating * 20 + seller.rankingBoost;
}

/** Returns a new array, highest score first. The input is not changed. */
export function rankSellers<T extends RankableSeller>(sellers: readonly T[]): T[] {
  return [...sellers].sort((a, b) => {
    const diff = rankScore(b) - rankScore(a);
    if (diff !== 0) return diff;
    if (b.reviewCount !== a.reviewCount) return b.reviewCount - a.reviewCount;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}
