import { recordAudit } from "@/lib/audit/audit";
import { AuditAction } from "@/lib/audit/actions";
import { prisma } from "@/lib/db/client";
import { markdownToPlainText, readingMinutes, renderMarkdown } from "./markdown";
import {
  canTransition,
  type ContentStatusName,
  type ContentTypeName,
  isPubliclyVisible,
  publishProblems,
  type PublishProblem,
  scheduleProblem,
  slugify,
  uniqueSlug,
} from "./status";

/**
 * Editorial content service: articles (education, guides, research, news) and reference library pages.
 * Rules live in ./status.ts; this file applies them with conditional writes and records audit entries.
 * Public reads go through the visibility helpers here, so nothing else needs to remember the rules.
 */

export class ContentError extends Error {
  constructor(
    message: string,
    readonly problems: PublishProblem[] = [],
  ) {
    super(message);
    this.name = "ContentError";
  }
}

export interface ArticleInput {
  type: ContentTypeName;
  title: string;
  summary?: string | null;
  body: string;
  tags?: string[];
  category?: string | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
  coverKey?: string | null;
  coverAlt?: string | null;
  metaDescription?: string | null;
  isDemo?: boolean;
}

function cleanTags(tags: readonly string[] | undefined): string[] {
  const set = new Set<string>();
  for (const raw of tags ?? []) {
    const tag = raw.trim().toLowerCase().replace(/[^a-z0-9 -]/g, "").replace(/\s+/g, "-").slice(0, 32);
    if (tag) set.add(tag);
    if (set.size >= 10) break;
  }
  return [...set];
}

function articleData(input: ArticleInput) {
  return {
    type: input.type,
    title: input.title.trim(),
    summary: input.summary?.trim() || null,
    body: input.body,
    tags: cleanTags(input.tags),
    category: input.category?.trim() || null,
    sourceName: input.sourceName?.trim() || null,
    sourceUrl: input.sourceUrl?.trim() || null,
    coverKey: input.coverKey ?? null,
    coverAlt: input.coverAlt?.trim() || null,
    metaDescription: input.metaDescription?.trim() || null,
    readingMinutes: readingMinutes(input.body),
    isDemo: input.isDemo ?? false,
  };
}

async function uniqueArticleSlug(title: string): Promise<string> {
  const base = slugify(title, "article");
  const taken = await prisma.article.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } });
  return uniqueSlug(base, new Set(taken.map((row) => row.slug)));
}

/** Creates a DRAFT. Status changes go through changeArticleStatus. */
export async function createArticle(input: ArticleInput, actorId: string): Promise<{ id: string; slug: string }> {
  const slug = await uniqueArticleSlug(input.title);
  const article = await prisma.article.create({
    data: { ...articleData(input), slug, status: "DRAFT", authorId: actorId },
    select: { id: true, slug: true },
  });
  await recordAudit({ action: AuditAction.CONTENT_CREATED, actorId, entityType: "Article", entityId: article.id, meta: { type: input.type } });
  return article;
}

/** Edits content fields. Never changes the status, the slug or the author. */
export async function updateArticle(id: string, input: ArticleInput, actorId: string): Promise<void> {
  const current = await prisma.article.findUnique({ where: { id }, select: { status: true, type: true } });
  if (!current) throw new ContentError("This item no longer exists.");
  await prisma.article.update({ where: { id }, data: articleData(input) });
  await recordAudit({ action: AuditAction.CONTENT_UPDATED, actorId, entityType: "Article", entityId: id, meta: { status: current.status } });
}

/**
 * Moves content to a new status. Checks the transition, the publish requirements and the schedule time, then
 * writes with a condition on the status it read, so two admins cannot both win.
 */
export async function changeArticleStatus(
  id: string,
  to: ContentStatusName,
  actorId: string | null,
  options: { scheduledFor?: Date | null; now?: Date } = {},
): Promise<void> {
  const now = options.now ?? new Date();
  const current = await prisma.article.findUnique({ where: { id } });
  if (!current) throw new ContentError("This item no longer exists.");
  const from = current.status as ContentStatusName;
  if (!canTransition(from, to)) throw new ContentError(`Cannot move from ${from.toLowerCase()} to ${to.toLowerCase()}.`);

  const problems: PublishProblem[] = [];
  if (to === "PUBLISHED" || to === "SCHEDULED") {
    problems.push(
      ...publishProblems({
        type: current.type as ContentTypeName,
        title: current.title,
        body: current.body,
        summary: current.summary,
        sourceName: current.sourceName,
        sourceUrl: current.sourceUrl,
        metaDescription: current.metaDescription,
      }),
    );
  }
  if (to === "SCHEDULED") {
    const when = scheduleProblem(options.scheduledFor ?? null, now);
    if (when) problems.push(when);
  }
  if (problems.length > 0) throw new ContentError(problems[0]!.message, problems);

  const data: Record<string, unknown> = { status: to };
  if (to === "PUBLISHED") data.publishedAt = now;
  if (to === "SCHEDULED") data.scheduledFor = options.scheduledFor;
  if (to === "ARCHIVED") data.archivedAt = now;
  if (to === "DRAFT") data.scheduledFor = null;

  const result = await prisma.article.updateMany({ where: { id, status: from }, data });
  if (result.count === 0) throw new ContentError("This item was changed by someone else. Reload and try again.");

  const action =
    to === "PUBLISHED"
      ? AuditAction.CONTENT_PUBLISHED
      : to === "ARCHIVED"
        ? AuditAction.CONTENT_ARCHIVED
        : from === "PUBLISHED" && to === "DRAFT"
          ? AuditAction.CONTENT_UNPUBLISHED
          : AuditAction.CONTENT_UPDATED;
  await recordAudit({
    action,
    actorId,
    entityType: "Article",
    entityId: id,
    meta: { from, to, scheduled: to === "SCHEDULED" ? (options.scheduledFor ?? now).toISOString() : null },
  });
}

/**
 * Publishes every SCHEDULED article whose time has passed. Called by the worker. Each article is changed with
 * a condition on SCHEDULED, so running twice never publishes twice. Returns the number published.
 */
export async function publishDueArticles(now: Date = new Date()): Promise<number> {
  const due = await prisma.article.findMany({
    where: { status: "SCHEDULED", scheduledFor: { lte: now } },
    select: { id: true },
  });
  let published = 0;
  for (const row of due) {
    const result = await prisma.article.updateMany({
      where: { id: row.id, status: "SCHEDULED" },
      data: { status: "PUBLISHED", publishedAt: now, scheduledFor: null },
    });
    if (result.count === 1) {
      published += 1;
      await recordAudit({ action: AuditAction.CONTENT_PUBLISHED, actorId: null, entityType: "Article", entityId: row.id, meta: { scheduled: true } });
    }
  }
  return published;
}

/** Public public-visibility filter for articles. Use it in every public query. */
export function publicArticleWhere(now: Date) {
  return { status: "PUBLISHED" as const, publishedAt: { lte: now } };
}

export interface ArticleListFilter {
  type?: ContentTypeName;
  tag?: string;
  category?: string;
  q?: string;
  skip?: number;
  take?: number;
  now?: Date;
}

/** Published articles, newest first. Search matches title, summary and body text. */
export async function listPublicArticles(filter: ArticleListFilter = {}) {
  const now = filter.now ?? new Date();
  const q = filter.q?.trim();
  const where = {
    ...publicArticleWhere(now),
    ...(filter.type ? { type: filter.type } : {}),
    ...(filter.tag ? { tags: { has: filter.tag.toLowerCase() } } : {}),
    ...(filter.category ? { category: filter.category } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { summary: { contains: q, mode: "insensitive" as const } },
            { body: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.article.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      skip: filter.skip ?? 0,
      take: filter.take ?? 12,
    }),
    prisma.article.count({ where }),
  ]);
  return { items, total };
}

/** A public article with its rendered body. Null when it is not visible now. */
export async function findPublicArticle(slug: string, now: Date = new Date()) {
  const article = await prisma.article.findUnique({ where: { slug } });
  if (!article || !isPubliclyVisible(article.status as ContentStatusName, article.publishedAt, now)) return null;
  return { ...article, html: renderMarkdown(article.body) };
}

/** Up to `limit` other published articles that share a tag or type, most recent first. */
export async function relatedArticles(article: { id: string; type: string; tags: string[] }, limit = 3, now: Date = new Date()) {
  return prisma.article.findMany({
    where: {
      ...publicArticleWhere(now),
      id: { not: article.id },
      OR: [{ type: article.type as ContentTypeName }, ...(article.tags.length ? [{ tags: { hasSome: article.tags } }] : [])],
    },
    orderBy: [{ publishedAt: "desc" }],
    take: limit,
  });
}

/** Reference library: public pages, in the admin's order. */
export async function listPublicReferenceEntries() {
  return prisma.referenceEntry.findMany({ where: { status: "PUBLISHED" }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
}

export async function findPublicReferenceEntry(slug: string, now: Date = new Date()) {
  const entry = await prisma.referenceEntry.findUnique({ where: { slug } });
  if (!entry || !isPubliclyVisible(entry.status as ContentStatusName, entry.publishedAt, now)) return null;
  const sections = {
    properties: renderMarkdown(entry.properties),
    origins: renderMarkdown(entry.origins),
    treatments: renderMarkdown(entry.treatments),
    qualityGuide: renderMarkdown(entry.qualityGuide),
    care: renderMarkdown(entry.care),
    priceFactors: renderMarkdown(entry.priceFactors),
  };
  return { ...entry, sections, plainSummary: markdownToPlainText(entry.summary) };
}
