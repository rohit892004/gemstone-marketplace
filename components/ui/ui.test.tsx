import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Inbox } from "lucide-react";
import { Badge, DemoTag } from "./badge";
import { Button, ButtonLink, buttonClasses } from "./button";
import { Card, StatTile } from "./card";
import { Tabs } from "./tabs";
import { EmptyState } from "./empty-state";
import { Photo } from "./photo";
import { ProductCard } from "./product-card";
import { SellerCard } from "./seller-card";
import { DataTable } from "./data-table";
import { Field, Input } from "./field";
import { PageHeader } from "./page-header";
import { cx } from "./cx";

describe("ui primitives", () => {
  it("joins class names and drops falsy parts", () => {
    expect(cx("a", false, null, undefined, "b")).toBe("a b");
  });

  it("gives primary, gold and secondary buttons distinct styles", () => {
    expect(buttonClasses({ variant: "primary" })).toContain("bg-brand");
    expect(buttonClasses({ variant: "gold" })).toContain("bg-champagne");
    expect(buttonClasses({ variant: "secondary" })).toContain("border-brand");
  });

  it("renders a button with type=button by default", () => {
    expect(renderToStaticMarkup(<Button>Save</Button>)).toContain('type="button"');
  });

  it("renders a ButtonLink as a link with the button classes", () => {
    const html = renderToStaticMarkup(<ButtonLink href="/valuation">Request</ButtonLink>);
    expect(html).toContain('href="/valuation"');
    expect(html).toContain("bg-brand");
  });

  it("marks the active tab with aria-current and keeps every tab a link", () => {
    const html = renderToStaticMarkup(
      <Tabs
        label="Dashboard sections"
        items={[
          { href: "/seller/listings", label: "Listings", active: true, count: 4 },
          { href: "/seller/inbox", label: "Inbox" },
        ]}
      />,
    );
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('href="/seller/inbox"');
    expect(html).toContain('aria-label="Dashboard sections"');
  });

  it("badges and demo tags carry text, not colour alone", () => {
    expect(renderToStaticMarkup(<Badge tone="verified">Verified</Badge>)).toContain("Verified");
    expect(renderToStaticMarkup(<DemoTag />)).toContain("Demo");
  });

  it("empty states show a title, body and a next action, with no illustration", () => {
    const html = renderToStaticMarkup(
      <EmptyState title="No enquiries yet" body="Enquiries from buyers appear here." icon={Inbox} action={<a href="/seller/listings">Add a listing</a>} />,
    );
    expect(html).toContain("No enquiries yet");
    expect(html).toContain("Add a listing");
    expect(html).not.toContain("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"100%\"");
  });

  it("photos never render invisible: the image is in the markup with alt text and lazy loading", () => {
    const html = renderToStaticMarkup(<Photo src="/design-preview/luxury/stone-1.webp" alt="Pigeon blood ruby" />);
    expect(html).toContain('alt="Pigeon blood ruby"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain("aspect-[4/5]");
  });

  it("a photo with no source shows a labelled panel, or is hidden when decorative", () => {
    expect(renderToStaticMarkup(<Photo src="" alt="Ruby banner" />)).toContain('role="img"');
    const decorative = renderToStaticMarkup(<Photo src="" alt="" />);
    expect(decorative).toContain('aria-hidden="true"');
    expect(decorative).not.toContain('role="img"');
  });

  it("product cards link to the listing and keep the corner control outside the link", () => {
    const html = renderToStaticMarkup(
      <ProductCard
        href="/gemstones/demo-01"
        name="Pigeon blood Ruby, 1.23 ct"
        spec="1.23 ct · oval · Mozambique"
        price="₹70,200"
        photo={{ src: "/x.webp", alt: "Ruby, detail view" }}
        verified
        demo
        corner={<button type="button">Save</button>}
      />,
    );
    expect(html).toContain('href="/gemstones/demo-01"');
    expect(html).toContain("Verified");
    expect(html).toContain("Demo");
    expect(html).toContain("<button");
  });

  it("seller cards show initials when there is no logo", () => {
    const html = renderToStaticMarkup(<SellerCard href="/sellers/x" name="Himalaya Gem House" place="Jaipur" specialties="Sapphire" />);
    expect(html).toContain("HG");
  });

  it("data tables show the empty text when there are no rows", () => {
    const html = renderToStaticMarkup(
      <DataTable caption="Listings" columns={[{ key: "n", header: "Name", cell: (r: { n: string }) => r.n }]} rows={[]} getRowKey={(r) => r.n} empty="No listings yet" />,
    );
    expect(html).toContain("No listings yet");
    expect(html).toContain("<caption");
  });

  it("form fields connect the label to the control", () => {
    const html = renderToStaticMarkup(
      <Field id="carat" label="Carat weight" hint="Two decimal places">
        <Input id="carat" name="carat" />
      </Field>,
    );
    expect(html).toContain('for="carat"');
    expect(html).toContain("Two decimal places");
  });

  it("stat tiles and page headers render their text", () => {
    expect(renderToStaticMarkup(<StatTile label="Enquiries" value="46" />)).toContain("46");
    expect(renderToStaticMarkup(<PageHeader eyebrow="Catalogue" title="Gemstones" />)).toContain("<h1");
    expect(renderToStaticMarkup(<Card>Body</Card>)).toContain("Body");
  });
});
