/**
 * Related content ordering. Pure: the service fetches candidates, this decides their order.
 * Score: two points per shared tag, plus one for the same type. Ties go to the newest, then to id.
 */

export interface RelatedCandidate {
  id: string;
  type: string;
  tags: string[];
  publishedAt: Date | null;
}

export function relatedScore(article: { type: string; tags: string[] }, candidate: RelatedCandidate): number {
  const mine = new Set(article.tags);
  const shared = candidate.tags.filter((tag) => mine.has(tag)).length;
  return shared * 2 + (candidate.type === article.type ? 1 : 0);
}

export function orderRelated<T extends RelatedCandidate>(
  article: { id: string; type: string; tags: string[] },
  candidates: readonly T[],
  limit = 3,
): T[] {
  return candidates
    .filter((candidate) => candidate.id !== article.id)
    .map((candidate) => ({ candidate, score: relatedScore(article, candidate) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const ta = a.candidate.publishedAt?.getTime() ?? 0;
      const tb = b.candidate.publishedAt?.getTime() ?? 0;
      if (tb !== ta) return tb - ta;
      if (a.candidate.id === b.candidate.id) return 0;
      return a.candidate.id < b.candidate.id ? -1 : 1;
    })
    .slice(0, limit)
    .map((row) => row.candidate);
}
