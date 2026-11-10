import Link from "next/link";
import { CoverImage, DemoNotice, formatPublishedDate } from "./content-ui";

export interface ArticleCardData {
  slug: string;
  title: string;
  summary: string | null;
  type: "EDUCATION" | "GUIDE" | "RESEARCH" | "NEWS";
  tags: string[];
  category: string | null;
  sourceName: string | null;
  coverKey: string | null;
  coverAlt: string | null;
  readingMinutes: number;
  publishedAt: Date | null;
  isDemo: boolean;
}

const TYPE_LABELS: Record<ArticleCardData["type"], string> = {
  EDUCATION: "Education",
  GUIDE: "Guide",
  RESEARCH: "Research",
  NEWS: "Market news",
};

/** Card for education, guide, research and news lists. The title is the only link. */
export function ArticleCard({ article, href, headingLevel = 2 }: { article: ArticleCardData; href: string; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const date = formatPublishedDate(article.publishedAt);
  return (
    <article className="flex h-full flex-col gap-4">
      {article.coverKey ? <CoverImage coverKey={article.coverKey} alt={article.coverAlt} className="mb-1" /> : null}
      <p className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-accent-text">
        <span>{TYPE_LABELS[article.type]}</span>
        {article.type === "NEWS" && article.category ? <span className="text-ink-soft">· {article.category}</span> : null}
      </p>
      <Heading className="font-heading text-2xl leading-snug text-ink">
        <Link href={href} className="hover:text-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          {article.title}
        </Link>
      </Heading>
      {article.summary ? <p className="text-[15px] leading-relaxed text-ink-soft">{article.summary}</p> : null}
      <p className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-[12px] text-ink-soft">
        {date ? <time dateTime={article.publishedAt?.toISOString()}>{date}</time> : null}
        {article.type !== "NEWS" ? <span>{article.readingMinutes} min read</span> : null}
        {article.type === "NEWS" && article.sourceName ? <span>Source: {article.sourceName}</span> : null}
      </p>
      {article.isDemo ? <DemoNotice className="self-start" /> : null}
    </article>
  );
}
