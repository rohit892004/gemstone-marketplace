import { Suspense } from "react";
import { ActionForm, type ActionField } from "@/components/admin/action-form";
import { PageHeader } from "@/components/ui/page-header";
import { requirePageRole } from "@/lib/auth/require-role";
import { HOMEPAGE_BLOCK_KEYS, loadHomepageBlocks, type HomepageBlockKey } from "@/lib/homepage/blocks";
import { saveHomepageBlock } from "./actions";

export const metadata = { title: "Homepage editor", robots: { index: false, follow: false } };

const BLOCK_TITLES: Record<HomepageBlockKey, string> = {
  hero: "Hero (headline and buttons)",
  categoriesHeading: "Category grid heading",
  valuationTeaser: "Valuation teaser",
  educationTeaser: "Education teaser",
  newsTeaser: "Market news teaser",
  newsletterTeaser: "Newsletter teaser",
};

const BLOCK_FIELDS: Record<HomepageBlockKey, ActionField[]> = {
  hero: [
    { name: "headline", label: "Headline", kind: "textarea", required: true, maxLength: 300 },
    { name: "subheadline", label: "Subheadline", kind: "textarea", required: true, maxLength: 300 },
    { name: "primaryCtaLabel", label: "Primary button label", required: true, maxLength: 300 },
    { name: "primaryCtaHref", label: "Primary button link", help: "Relative path, e.g. /gemstones", required: true, maxLength: 300 },
    { name: "secondaryCtaLabel", label: "Secondary button label", required: true, maxLength: 300 },
    { name: "secondaryCtaHref", label: "Secondary button link", help: "Relative path, e.g. /valuation", required: true, maxLength: 300 },
  ],
  categoriesHeading: [
    { name: "heading", label: "Heading", required: true, maxLength: 300 },
    { name: "intro", label: "Intro (optional)", kind: "textarea", maxLength: 300 },
  ],
  valuationTeaser: teaserFields(),
  educationTeaser: teaserFields(),
  newsTeaser: teaserFields(),
  newsletterTeaser: [
    { name: "heading", label: "Heading", required: true, maxLength: 300 },
    { name: "body", label: "Body", kind: "textarea", required: true, maxLength: 300 },
  ],
};

function teaserFields(): ActionField[] {
  return [
    { name: "heading", label: "Heading", required: true, maxLength: 300 },
    { name: "body", label: "Body", kind: "textarea", required: true, maxLength: 300 },
    { name: "ctaLabel", label: "Button label", required: true, maxLength: 300 },
    { name: "ctaHref", label: "Button link", help: "Relative path, e.g. /learn", required: true, maxLength: 300 },
  ];
}

export default function AdminHomepagePage() {
  return (
    <Suspense fallback={null}>
      <BlockEditors />
    </Suspense>
  );
}

async function BlockEditors() {
  await requirePageRole(["ADMIN"]);
  const blocks = await loadHomepageBlocks();

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Site"
        title="Homepage"
        lead="Edit the text shown on the homepage. Text is shown as plain text. Links must be relative paths starting with /. Each block is saved on its own."
      />
      <div className="space-y-6">
        {HOMEPAGE_BLOCK_KEYS.map((key) => {
          const content = blocks[key] as unknown as Record<string, string>;
          const fields = BLOCK_FIELDS[key].map((field) => ({ ...field, defaultValue: content[field.name] ?? "" }));
          return (
            <ActionForm
              key={key}
              action={saveHomepageBlock}
              hidden={{ blockKey: key }}
              title={BLOCK_TITLES[key]}
              submitLabel="Save block"
              fields={fields}
            />
          );
        })}
      </div>
    </div>
  );
}
