"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/require-role";
import { buildCoverKey, coverExtensionFor } from "@/lib/content/cover";
import { MARKDOWN_MAX_CHARS, MarkdownTooLongError, renderMarkdown } from "@/lib/content/markdown";
import { NEWS_CATEGORIES } from "@/lib/content/listing";
import { REFERENCE_META_MAX } from "@/lib/content/reference-sections";
import {
  type ArticleInput,
  ContentError,
  changeArticleStatus,
  changeReferenceEntryStatus,
  createArticle,
  createReferenceEntry,
  type ReferenceEntryInput,
  setArticleCover,
  updateArticle,
  updateReferenceEntry,
} from "@/lib/content/service";
import { CONTENT_STATUSES, type ContentStatusName, CONTENT_TYPES, isHttpsUrl, META_DESCRIPTION_MAX, SUMMARY_MAX } from "@/lib/content/status";
import { prisma } from "@/lib/db/client";
import { getStorageProvider } from "@/lib/storage/storage";
import { uploadErrorMessage, validateUpload } from "@/lib/storage/upload-validation";

/**
 * Admin CMS server actions. Every action calls requireRole(["ADMIN"]) first. Rules (publish checks, transitions,
 * schedule times) live in lib/content and are applied by the service; these actions parse and validate form input,
 * then call the service and turn ContentError into form messages.
 */

export interface FieldProblem {
  field: string;
  message: string;
}

export type ContentActionState =
  | null
  | { ok: true; message: string }
  | { ok: false; error: string; problems?: FieldProblem[] };

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function fail(error: string, problems?: FieldProblem[]): ContentActionState {
  return { ok: false, error, problems };
}

function refreshPublic(): void {
  for (const path of ["/", "/education", "/news", "/reference", "/sitemap.xml"]) revalidatePath(path);
}

function contentErrorState(error: unknown): ContentActionState {
  if (error instanceof ContentError) return fail(error.message, error.problems.map((p) => ({ field: p.field, message: p.message })));
  if (error instanceof MarkdownTooLongError) return fail(`Keep each section under ${MARKDOWN_MAX_CHARS} characters.`);
  throw error;
}

/** Reads and checks the article fields shared by create and update. */
function readArticleInput(formData: FormData): { input: ArticleInput } | { error: ContentActionState } {
  const type = text(formData, "type");
  if (!(CONTENT_TYPES as readonly string[]).includes(type)) return { error: fail("Choose a content type.", [{ field: "type", message: "Choose a content type." }]) };
  const title = text(formData, "title").trim();
  const body = text(formData, "body");
  const summary = text(formData, "summary").trim();
  const metaDescription = text(formData, "metaDescription").trim();
  const sourceUrl = text(formData, "sourceUrl").trim();
  const category = text(formData, "category").trim();

  const problems: FieldProblem[] = [];
  if (title === "") problems.push({ field: "title", message: "Add a title." });
  if (title.length > 200) problems.push({ field: "title", message: "Keep the title under 200 characters." });
  if (body.length > MARKDOWN_MAX_CHARS) problems.push({ field: "body", message: `Keep the content under ${MARKDOWN_MAX_CHARS} characters.` });
  if (summary.length > SUMMARY_MAX) problems.push({ field: "summary", message: `Keep the summary under ${SUMMARY_MAX} characters.` });
  if (metaDescription.length > META_DESCRIPTION_MAX) {
    problems.push({ field: "metaDescription", message: `Keep the search description under ${META_DESCRIPTION_MAX} characters.` });
  }
  // Source links are shown as links on the public site, so only https is ever stored.
  if (sourceUrl !== "" && !isHttpsUrl(sourceUrl)) problems.push({ field: "sourceUrl", message: "Use a full https:// link." });
  if (type === "NEWS" && category !== "" && !(NEWS_CATEGORIES as readonly string[]).includes(category)) {
    problems.push({ field: "category", message: "Choose a news category from the list." });
  }
  if (problems.length > 0) return { error: fail(problems[0]!.message, problems) };

  const tags = text(formData, "tags")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  return {
    input: {
      type: type as ArticleInput["type"],
      title,
      summary: summary || null,
      body,
      tags,
      category: type === "NEWS" ? category || null : null,
      sourceName: type === "NEWS" ? text(formData, "sourceName").trim() || null : null,
      sourceUrl: type === "NEWS" ? sourceUrl || null : null,
      coverAlt: text(formData, "coverAlt").trim() || null,
      metaDescription: metaDescription || null,
    },
  };
}

/** Creates an article (no id) or saves the content of an existing one. Never changes the status. */
export async function saveArticle(_prev: ContentActionState, formData: FormData): Promise<ContentActionState> {
  const admin = await requireRole(["ADMIN"]);
  const parsed = readArticleInput(formData);
  if ("error" in parsed) return parsed.error;
  const id = text(formData, "id");
  try {
    if (id === "") {
      const created = await createArticle(parsed.input, admin.id);
      refreshPublic();
      redirect(`/admin/content/${created.id}?saved=1`);
    }
    const current = await prisma.article.findUnique({ where: { id }, select: { isDemo: true } });
    if (!current) return fail("This item no longer exists.");
    await updateArticle(id, { ...parsed.input, isDemo: current.isDemo }, admin.id);
    refreshPublic();
    return { ok: true, message: "Saved. The status is unchanged." };
  } catch (error) {
    return contentErrorState(error);
  }
}

/** Moves an article to a new status: draft, scheduled (future time), published or archived. */
export async function changeArticleStatusAction(_prev: ContentActionState, formData: FormData): Promise<ContentActionState> {
  const admin = await requireRole(["ADMIN"]);
  const id = text(formData, "id");
  const to = text(formData, "to");
  if (!(CONTENT_STATUSES as readonly string[]).includes(to)) return fail("Choose a status.");
  let scheduledFor: Date | null = null;
  if (to === "SCHEDULED") {
    const iso = text(formData, "scheduledForIso");
    scheduledFor = iso ? new Date(iso) : null;
    if (scheduledFor && Number.isNaN(scheduledFor.getTime())) scheduledFor = null;
  }
  try {
    await changeArticleStatus(id, to as ContentStatusName, admin.id, { scheduledFor });
  } catch (error) {
    return contentErrorState(error);
  }
  refreshPublic();
  return { ok: true, message: statusMessage(to) };
}

function statusMessage(to: string): string {
  switch (to) {
    case "PUBLISHED":
      return "Published. It is now visible on the site.";
    case "SCHEDULED":
      return "Scheduled. It will publish at the chosen time.";
    case "ARCHIVED":
      return "Archived. It is hidden from the site.";
    default:
      return "Moved to draft. It is hidden from the site.";
  }
}

/** Uploads or removes an article's cover image. Only JPEG and PNG are accepted; the bytes are sniffed. */
export async function updateCoverAction(_prev: ContentActionState, formData: FormData): Promise<ContentActionState> {
  const admin = await requireRole(["ADMIN"]);
  const id = text(formData, "id");
  const article = await prisma.article.findUnique({ where: { id }, select: { id: true, coverAlt: true } });
  if (!article) return fail("This item no longer exists.");
  const storage = getStorageProvider();

  if (text(formData, "intent") === "remove") {
    const { previousKey } = await setArticleCover(id, null, null, admin.id);
    if (previousKey) await storage.delete(previousKey).catch(() => undefined);
    refreshPublic();
    return { ok: true, message: "Cover removed." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Choose a JPEG or PNG image.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const checked = validateUpload(bytes);
  if (!checked.ok) return fail(uploadErrorMessage(checked.reason));
  const ext = coverExtensionFor(checked.mimeType);
  if (!ext) return fail("Covers must be a JPEG or PNG image.");

  const key = buildCoverKey(id, ext, randomBytes(8).toString("hex"));
  await storage.put(key, bytes);
  try {
    const { previousKey } = await setArticleCover(id, key, article.coverAlt, admin.id);
    if (previousKey) await storage.delete(previousKey).catch(() => undefined);
  } catch (error) {
    await storage.delete(key).catch(() => undefined);
    return contentErrorState(error);
  }
  refreshPublic();
  return { ok: true, message: "Cover saved. Add alt text in the content form, then save." };
}

/** Markdown preview for the live editor. Same renderer as the public site. */
export async function previewMarkdown(source: string): Promise<{ html: string } | { error: string }> {
  await requireRole(["ADMIN"]);
  if (typeof source !== "string") return { error: "Nothing to preview." };
  if (source.length > MARKDOWN_MAX_CHARS) return { error: `Preview is limited to ${MARKDOWN_MAX_CHARS} characters.` };
  return { html: renderMarkdown(source) };
}

/** Reads and checks the gemstone reference fields. */
function readReferenceInput(formData: FormData): { input: ReferenceEntryInput } | { error: ContentActionState } {
  const input: ReferenceEntryInput = {
    name: text(formData, "name").trim(),
    categorySlug: text(formData, "categorySlug").trim(),
    summary: text(formData, "summary").trim(),
    hardness: text(formData, "hardness").trim() || null,
    properties: text(formData, "properties"),
    origins: text(formData, "origins"),
    treatments: text(formData, "treatments"),
    qualityGuide: text(formData, "qualityGuide"),
    care: text(formData, "care"),
    priceFactors: text(formData, "priceFactors"),
    metaDescription: text(formData, "metaDescription").trim() || null,
    sortOrder: Math.min(Math.max(Number.parseInt(text(formData, "sortOrder"), 10) || 0, 0), 1000),
  };
  if (input.name === "") return { error: fail("Add the gemstone name.", [{ field: "name", message: "Add the gemstone name." }]) };
  if (input.summary.length > SUMMARY_MAX) return { error: fail(`Keep the summary under ${SUMMARY_MAX} characters.`, [{ field: "summary", message: "Too long." }]) };
  if ((input.metaDescription ?? "").length > REFERENCE_META_MAX) {
    return { error: fail(`Keep the search description under ${REFERENCE_META_MAX} characters.`) };
  }
  return { input };
}

export async function saveReferenceEntry(_prev: ContentActionState, formData: FormData): Promise<ContentActionState> {
  const admin = await requireRole(["ADMIN"]);
  const parsed = readReferenceInput(formData);
  if ("error" in parsed) return parsed.error;
  const id = text(formData, "id");
  try {
    if (id === "") {
      const created = await createReferenceEntry(parsed.input, admin.id);
      refreshPublic();
      redirect(`/admin/content/reference/${created.id}?saved=1`);
    }
    const current = await prisma.referenceEntry.findUnique({ where: { id }, select: { isDemo: true } });
    if (!current) return fail("This page no longer exists.");
    await updateReferenceEntry(id, { ...parsed.input, isDemo: current.isDemo }, admin.id);
    refreshPublic();
    return { ok: true, message: "Saved. The status is unchanged." };
  } catch (error) {
    return contentErrorState(error);
  }
}

export async function changeReferenceStatusAction(_prev: ContentActionState, formData: FormData): Promise<ContentActionState> {
  const admin = await requireRole(["ADMIN"]);
  const id = text(formData, "id");
  const to = text(formData, "to");
  if (to !== "DRAFT" && to !== "PUBLISHED" && to !== "ARCHIVED") return fail("Choose a status.");
  try {
    await changeReferenceEntryStatus(id, to, admin.id);
  } catch (error) {
    return contentErrorState(error);
  }
  refreshPublic();
  return { ok: true, message: statusMessage(to) };
}
