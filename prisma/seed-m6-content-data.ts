/**
 * M6 demo content, as plain data. Every title or summary starts with "Demo", every row is isDemo, and the text is
 * original. News sources are fictional (example.com links, "Demo source" names). Nothing here is a real report,
 * price or lab result. Pure: no database access, so tests can check it directly.
 */

export type DemoArticleType = "EDUCATION" | "GUIDE" | "RESEARCH" | "NEWS";

export interface DemoArticle {
  type: DemoArticleType;
  title: string;
  summary: string;
  tags: string[];
  body: string;
  status: "PUBLISHED" | "SCHEDULED";
  /** Published this many days before the seed ran. */
  publishedDaysAgo?: number;
  /** Scheduled this many days after the seed ran. */
  scheduledInDays?: number;
  metaDescription?: string;
  category?: string;
  sourceName?: string;
  sourceUrl?: string;
  /** Demo photo file in prisma/demo-photos used as the article cover (JPEG output). */
  coverFile: string;
  coverAlt: string;
}

export const DEMO_NEWS_SOURCE = "Demo source: Gemstone Wire (demo)";

export const M6_DEMO_ARTICLES: DemoArticle[] = [
  {
    type: "EDUCATION",
    title: "Demo: Reading a gemstone lab report",
    coverFile: "diamond-01.jpg",
    coverAlt: "Demo cover image: close-up of a diamond",
    summary: "Demo guide. What the main sections of a laboratory report mean, and which questions to ask the seller.",
    tags: ["grading", "reports", "beginners"],
    status: "PUBLISHED",
    publishedDaysAgo: 40,
    metaDescription: "Demo guide to reading a gemstone laboratory report, section by section.",
    body: `## Why a report matters

A laboratory report records what the lab observed when it examined one stone. It does not give a price, and it does not promise that a stone is better than another. Read it as a description.

## The sections to look at first

- **Identity:** the species and variety named by the lab.
- **Dimensions and weight:** measured in millimetres and carats. Check they match the stone you are buying.
- **Origin opinion:** labs often separate a proven origin from an opinion. An opinion is still useful, but it is less certain.
- **Treatments:** heating, filling or coating should be stated. A clear statement is a good sign.

## Questions to ask a seller

Ask whether the report number matches the stone, whether the report is current, and whether the seller has any other reports for the same stone. If a report is missing a section, ask why.

## What a report cannot tell you

A report cannot say whether a price is fair. For that, compare similar stones in the catalogue and use an indicative valuation.`,
  },
  {
    type: "EDUCATION",
    title: "Demo: Treatments explained in plain language",
    coverFile: "emerald-02.jpg",
    coverAlt: "Demo cover image: close-up of an emerald",
    summary: "Demo primer on heating, filling and other common treatments, and why disclosure matters for price.",
    tags: ["treatments", "disclosure", "beginners"],
    status: "PUBLISHED",
    publishedDaysAgo: 33,
    metaDescription: "Demo primer on common gemstone treatments and how disclosure affects value.",
    body: `## What a treatment is

A treatment changes a stone's appearance or durability after it leaves the ground. Many stones have been treated for a long time, and treatment alone does not make a stone a poor choice. What matters is that the treatment is disclosed and priced correctly.

## Common treatments

- **Heating:** widely used on some corundum and other coloured stones to improve colour or clarity.
- **Filling:** a clear material is introduced into surface-reaching fractures. Emeralds are the best-known example.
- **Coating and diffusion:** surface layers or diffused colour. These are usually easier to damage and should be priced lower.

## How to talk about treatments

Ask the seller to state every treatment in writing, and to say whether the stone was checked by a laboratory. A stone that is described as untreated should come with a report that supports the claim.

## Why it changes the price

Two stones with the same size and colour can have very different prices if one is untreated. Disclosure keeps the comparison fair.`,
  },
  {
    type: "EDUCATION",
    title: "Demo: Caring for coloured stones at home",
    coverFile: "ruby-03.jpg",
    coverAlt: "Demo cover image: close-up of a ruby",
    summary: "Demo care guide. Simple cleaning, storage and handling habits that protect most coloured stones.",
    tags: ["care", "cleaning", "storage"],
    status: "PUBLISHED",
    publishedDaysAgo: 25,
    metaDescription: "Demo care guide for cleaning and storing coloured gemstones safely.",
    body: `## Start with the species

Hardness and sensitivity differ widely. Diamond and sapphire are very hard. Emerald, tourmaline and opal need more care. If you are unsure, ask the seller before using any cleaning method.

## A safe routine

1. Use lukewarm water with a drop of mild, non-biological soap.
2. Brush gently with a soft toothbrush, paying attention to the back of the setting.
3. Rinse and dry with a lint-free cloth.

## Things to avoid

- Harsh chemicals, bleach and abrasive powders.
- Sudden temperature changes, such as moving a warm stone into cold water.
- Ultrasonic and steam cleaners on stones with fillings, fractures or known sensitivity.

## Storage

Keep each stone in a separate soft pouch. Harder stones can scratch softer ones, so separate storage prevents damage.`,
  },
  {
    type: "GUIDE",
    title: "Demo: A buyer's checklist before you pay",
    coverFile: "diamond-02.jpg",
    coverAlt: "Demo cover image: close-up of diamonds",
    summary: "Demo checklist for the last ten minutes before paying for a coloured stone or a diamond.",
    tags: ["buying", "checklist"],
    status: "PUBLISHED",
    publishedDaysAgo: 18,
    metaDescription: "Demo checklist to run through before paying for a gemstone.",
    body: `## Before you pay

Work through this list. None of the steps is difficult, and each one protects you from a common problem.

1. **Confirm the species and variety** in writing.
2. **Check the weight and measurements** against the report or the listing.
3. **Read the treatment statement** and ask for it to be repeated in the invoice.
4. **Ask about returns**, including who pays for return shipping and insurance.
5. **Keep the listing and chat history** until the stone has arrived and you are satisfied.

## Red flags

- A price far below similar stones, with no explanation.
- A refusal to share a report or photographs of the actual stone.
- Pressure to pay outside the platform.

## After delivery

Check the stone against the report under daylight and note anything that does not match. Report differences within the time stated in the sale terms.`,
  },
  {
    type: "GUIDE",
    title: "Demo: How to compare two listings fairly",
    coverFile: "sapphire-01.jpg",
    coverAlt: "Demo cover image: close-up of a sapphire",
    summary: "Demo guide. Compare like with like by weight, colour, clarity, treatment and documents.",
    tags: ["buying", "comparison", "listings"],
    status: "PUBLISHED",
    publishedDaysAgo: 12,
    metaDescription: "Demo guide to comparing two gemstone listings on equal terms.",
    body: `## Put the stones side by side

Two listings can look similar and still differ in ways that matter. Compare these points in the same order every time:

- **Weight:** a larger stone usually costs more per carat as well as in total, so compare price per carat and total price.
- **Colour and clarity:** use the words in each report, and look at photographs or video taken in daylight.
- **Cut and proportions:** a well-cut stone can look larger and more vivid than a poorly cut one of the same weight.
- **Treatment:** stones with the same appearance can have different treatments and prices.
- **Documents:** a current report from a recognised laboratory is worth more than a description alone.

## Use the reference library

Each reference page explains the factors that move the price for that stone. Use it to decide which differences are worth paying for.`,
  },
  {
    type: "GUIDE",
    title: "Demo: Preparing a stone for a valuation request",
    coverFile: "diamond-03.jpg",
    coverAlt: "Demo cover image: diamond jewellery",
    summary: "Demo guide. What to gather, photograph and write down before you request an indicative valuation.",
    tags: ["valuation", "preparation"],
    status: "PUBLISHED",
    publishedDaysAgo: 6,
    metaDescription: "Demo guide to preparing a gemstone for an indicative valuation request.",
    body: `## Gather what you have

Collect any report, receipt, appraisal or invoice. Note where and when you bought the stone, and anything you know about its treatment.

## Take clear photographs

Use natural daylight on a plain background. Photograph the front, the back and any inscription or setting marks. A ruler or coin in one photo gives scale.

## Describe the stone

Write the species, approximate weight, measurements, colour and any damage you can see. Say clearly what you do not know.

## What happens next

An indicative valuation is an estimate based on the details you give and the reference prices we hold. A specialist may ask for more information. The estimate is not a laboratory report.`,
  },
  {
    type: "RESEARCH",
    title: "Demo: Why carat weight moves prices faster than colour",
    coverFile: "diamond-04.jpg",
    coverAlt: "Demo cover image: close-up of a diamond",
    summary: "Demo research note on a simple way to think about price steps. Illustrative, with no market statistics.",
    tags: ["pricing", "research", "carat"],
    status: "PUBLISHED",
    publishedDaysAgo: 9,
    metaDescription: "Demo research note on how carat weight and colour interact in gemstone pricing.",
    body: `## The question

Buyers often ask whether size or colour matters more. The honest answer depends on the stone, but there is a useful way to think about it.

## A simple model

Carat weight creates price steps. Crossing a round weight, such as one carat, often changes the price per carat noticeably, because fewer stones of that size are found. Colour changes the price more gradually within a weight band.

## What this means for buyers

- If two stones have similar colour, the one just below a round weight may offer better value.
- If colour is the priority, a slightly smaller stone in a stronger colour can be the better purchase.

## Limits of this note

This note describes a method. It does not quote prices, and each market moves for its own reasons. Use it to structure your comparison, not as a forecast.`,
  },
  {
    type: "RESEARCH",
    title: "Demo: A simple method for tracking coloured stone prices",
    coverFile: "ruby-02.jpg",
    coverAlt: "Demo cover image: close-up of a ruby",
    summary: "Demo research note. A repeatable way to record asking prices so that trends become visible over time.",
    tags: ["pricing", "research", "method"],
    status: "SCHEDULED",
    scheduledInDays: 14,
    metaDescription: "Demo research note on tracking coloured gemstone asking prices over time.",
    body: `## Why track prices

Single prices tell you little. A series of prices, recorded the same way, shows direction and how quickly it changes.

## A repeatable method

1. Pick one species and one weight band, for example 1 to 2 carats.
2. Record the asking price per carat, the treatment statement and the date.
3. Record only listings that show a current report.
4. Repeat the same check on the same day each week.

## Reading the record

Look for changes that persist for several weeks. A single week's movement can reflect one unusual listing.

## Next steps

This is a demo method. A future edition will show how to store the records and compare them across species.`,
  },
  {
    type: "NEWS",
    category: "Market",
    title: "Demo: Sapphire parcel prices steady after a quiet quarter",
    coverFile: "sapphire-03.jpg",
    coverAlt: "Demo cover image: close-up of a sapphire",
    summary: "Demo news item. Dealers report steady asking prices for mid-sized sapphire parcels.",
    tags: ["sapphire", "prices"],
    status: "PUBLISHED",
    publishedDaysAgo: 3,
    sourceName: DEMO_NEWS_SOURCE,
    sourceUrl: "https://example.com/demo-news-1",
    metaDescription: "Demo market news: sapphire parcel prices steady.",
    body: `Demo news, written for testing. Fictional dealers in a fictional market report that asking prices for mid-sized sapphire parcels held steady over the past quarter. Buyers were selective, and most activity was in stones with full documentation. This item is not real market data.`,
  },
  {
    type: "NEWS",
    category: "Trade",
    title: "Demo: New trade fair dates announced for the coming season",
    coverFile: "workshop-01.jpg",
    coverAlt: "Demo cover image: gem workshop",
    summary: "Demo news item. A fictional trade fair publishes dates for exhibitor registration.",
    tags: ["events", "trade"],
    status: "PUBLISHED",
    publishedDaysAgo: 7,
    sourceName: DEMO_NEWS_SOURCE,
    sourceUrl: "https://example.com/demo-news-2",
    metaDescription: "Demo market news: a fictional trade fair publishes its dates.",
    body: `Demo news, written for testing. A fictional organiser has published dates for the coming season, with registration opening in the next few weeks. Details are placeholders and do not describe a real event.`,
  },
  {
    type: "NEWS",
    category: "Mining",
    title: "Demo: Small-scale mine reports better recovery at one site",
    coverFile: "loose-dark-01.jpg",
    coverAlt: "Demo cover image: loose gemstones on a dark background",
    summary: "Demo news item. A fictional small mine says a new washing step improved recovery.",
    tags: ["mining", "supply"],
    status: "PUBLISHED",
    publishedDaysAgo: 11,
    sourceName: DEMO_NEWS_SOURCE,
    sourceUrl: "https://example.com/demo-news-3",
    metaDescription: "Demo market news: a fictional mine reports better recovery.",
    body: `Demo news, written for testing. A fictional small-scale operation says a change to its washing process has improved the recovery of coloured crystals. The operator did not publish figures. This is not a real mine.`,
  },
  {
    type: "NEWS",
    category: "Certification",
    title: "Demo: Lab adds a new report format for coloured stones",
    coverFile: "workshop-03.jpg",
    coverAlt: "Demo cover image: gem workshop",
    summary: "Demo news item. A fictional laboratory introduces a report layout with clearer treatment notes.",
    tags: ["reports", "certification"],
    status: "PUBLISHED",
    publishedDaysAgo: 16,
    sourceName: DEMO_NEWS_SOURCE,
    sourceUrl: "https://example.com/demo-news-4",
    metaDescription: "Demo market news: a fictional laboratory adds a new report format.",
    body: `Demo news, written for testing. A fictional laboratory has added a report layout that places treatment notes on the first page. Its director said the change makes comparison easier for buyers. The laboratory is not real.`,
  },
  {
    type: "NEWS",
    category: "Policy",
    title: "Demo: Draft guidance on disclosing gemstone treatments",
    coverFile: "loose-dark-02.jpg",
    coverAlt: "Demo cover image: loose gemstones on a dark background",
    summary: "Demo news item. A fictional trade body consults on wording for treatment disclosure.",
    tags: ["disclosure", "policy"],
    status: "PUBLISHED",
    publishedDaysAgo: 21,
    sourceName: DEMO_NEWS_SOURCE,
    sourceUrl: "https://example.com/demo-news-5",
    metaDescription: "Demo market news: a fictional trade body consults on treatment disclosure.",
    body: `Demo news, written for testing. A fictional trade body has opened a consultation on standard wording for treatment disclosure. Comments were invited from dealers, laboratories and buyers. The body is not real.`,
  },
];

export interface DemoReference {
  name: string;
  categorySlug: string;
  summary: string;
  hardness: string;
  properties: string;
  origins: string;
  treatments: string;
  qualityGuide: string;
  care: string;
  priceFactors: string;
  metaDescription: string;
  sortOrder: number;
}

export const M6_DEMO_REFERENCE: DemoReference[] = [
  {
    name: "Diamond",
    categorySlug: "diamond",
    summary: "Demo entry. Diamond is the hardest natural material and is graded on carat, colour, clarity and cut.",
    hardness: "10 on the Mohs scale",
    properties: "Diamond is pure carbon with a very high refractive index and strong dispersion. Its hardness makes it resistant to scratching, but it can still chip along its cleavage planes if struck.",
    origins: "Demo note: historic sources include India. Modern production comes from several countries, including Botswana, Canada, Russia and South Africa.",
    treatments: "Demo note: laboratory-grown diamonds are chemically the same as mined stones. Colour treatment and fracture filling exist and must be disclosed.",
    qualityGuide: "Grade with a recognised laboratory report. Look at the four Cs together: carat, colour, clarity and cut. Cut has the largest effect on brilliance.",
    care: "Clean with lukewarm water, mild soap and a soft brush. Ultrasonic cleaning is usually safe for an unfractured stone, but ask a jeweller first if the setting is delicate.",
    priceFactors: "Carat weight creates price steps. Colour and clarity grades change price in bands. Cut quality, certification and the origin and treatment statement also matter.",
    metaDescription: "Demo reference page for diamond: properties, origins, treatments, quality and price factors.",
    sortOrder: 10,
  },
  {
    name: "Ruby",
    categorySlug: "ruby",
    summary: "Demo entry. Ruby is the red variety of corundum, valued for vivid, even colour.",
    hardness: "9 on the Mohs scale",
    properties: "Ruby is corundum (aluminium oxide) coloured red by chromium. Inclusions are common and can help identify natural stones.",
    origins: "Demo note: rubies are mined in several countries, including Myanmar, Mozambique and Madagascar. Origin is judged by a laboratory and is an opinion unless proven.",
    treatments: "Demo note: heating is very common and is usually accepted when disclosed. Lead-glass filling of fractures is a separate, more serious treatment.",
    qualityGuide: "Colour matters most. Look for a strong, even red with good saturation. Clarity and cut follow. Ask for a report that states heating and any filling.",
    care: "Ruby is durable. Warm soapy water and a soft brush are enough. Avoid harsh chemicals and sudden temperature changes, especially for stones with fractures.",
    priceFactors: "Colour quality is the main driver. Untreated stones, larger weights, clean clarity and proven origin can each add to the price.",
    metaDescription: "Demo reference page for ruby: properties, origins, treatments, quality and price factors.",
    sortOrder: 20,
  },
  {
    name: "Sapphire",
    categorySlug: "sapphire",
    summary: "Demo entry. Sapphire is corundum in many colours, most often blue.",
    hardness: "9 on the Mohs scale",
    properties: "Sapphire is corundum coloured by trace elements such as iron and titanium. Blue is the best-known colour, but fancy sapphires come in many hues.",
    origins: "Demo note: sapphires come from Sri Lanka, Madagascar, Thailand, Australia and other sources. Origin claims should be backed by a laboratory opinion.",
    treatments: "Demo note: heating is very common. Diffusion treatments, which add colour near the surface, must be disclosed and are priced lower.",
    qualityGuide: "Look at colour first: a clear, medium-to-deep tone with good saturation. Then check clarity and cut. Ask whether the stone is heated or unheated.",
    care: "Sapphire is durable. Warm soapy water and a soft brush are enough. Take care with diffused stones, which can be damaged by harsh cleaning.",
    priceFactors: "Colour, weight, clarity, origin and the treatment statement are the main factors. Unheated stones of good colour command the highest prices.",
    metaDescription: "Demo reference page for sapphire: properties, origins, treatments, quality and price factors.",
    sortOrder: 30,
  },
  {
    name: "Emerald",
    categorySlug: "emerald",
    summary: "Demo entry. Emerald is the green variety of beryl, prized for colour and typically included.",
    hardness: "7.5 to 8 on the Mohs scale",
    properties: "Emerald is beryllium aluminium silicate coloured green by chromium or vanadium. Inclusions and fractures are normal, and they affect durability more than appearance.",
    origins: "Demo note: emeralds come from Colombia, Zambia, Brazil and other sources. Origin is an opinion unless a laboratory has tested the stone.",
    treatments: "Demo note: oil or resin filling of fractures is very common. Disclose the treatment and avoid cleaning methods that can damage the filler.",
    qualityGuide: "Colour is the most important factor, followed by clarity. Because most emeralds are included, a stone with few visible inclusions is unusual and should be documented.",
    care: "Clean only with lukewarm water and mild soap. Avoid ultrasonic and steam cleaners, heat, and harsh chemicals, which can damage fillings.",
    priceFactors: "Colour quality, clarity, the extent of filling, origin and carat weight all affect price. Undisclosed filling is the most common cause of disappointment.",
    metaDescription: "Demo reference page for emerald: properties, origins, treatments, quality and price factors.",
    sortOrder: 40,
  },
  {
    name: "Spinel",
    categorySlug: "spinel",
    summary: "Demo entry. Spinel is a durable stone that comes in red, pink, blue and other colours.",
    hardness: "8 on the Mohs scale",
    properties: "Spinel is magnesium aluminium oxide. It is hard and fairly durable, and it can look very similar to ruby or sapphire without testing.",
    origins: "Demo note: spinel is found in Myanmar, Sri Lanka, Tajikistan and other countries. Labels may describe a stone as a ruby or sapphire by mistake, so check the report.",
    treatments: "Demo note: spinel is usually untreated. Ask the seller to confirm this in writing and to disclose any treatment that is found.",
    qualityGuide: "Look for a clean, lively colour and good clarity. A laboratory report is the best way to confirm the species.",
    care: "Spinel is durable. Warm soapy water and a soft brush are enough. Avoid harsh chemicals and knocks to the edges.",
    priceFactors: "Colour, clarity, weight and origin drive price. Vivid red and pink stones of larger size can be expensive.",
    metaDescription: "Demo reference page for spinel: properties, origins, treatments, quality and price factors.",
    sortOrder: 50,
  },
  {
    name: "Tourmaline",
    categorySlug: "tourmaline",
    summary: "Demo entry. Tourmaline is a family of gemstones in a wide range of colours, including bi-colour stones.",
    hardness: "7 to 7.5 on the Mohs scale",
    properties: "Tourmaline is a complex boron silicate. It is strongly pleochroic, which means its colour can look different from different directions.",
    origins: "Demo note: tourmaline comes from Brazil, Nigeria, Afghanistan, Mozambique and Madagascar, among others.",
    treatments: "Demo note: heating is sometimes used to improve colour. Ask for the treatment to be stated, and check whether the colour is stable.",
    qualityGuide: "Look for an even, saturated colour and good clarity. Bi-colour and parti-coloured stones should show a clear, attractive transition between colours.",
    care: "Tourmaline can be brittle along certain directions. Clean gently, avoid sudden temperature changes and store stones separately.",
    priceFactors: "Colour, clarity, weight and the rarity of the variety drive price. Paraiba-type colours and large clean stones command premiums.",
    metaDescription: "Demo reference page for tourmaline: properties, origins, treatments, quality and price factors.",
    sortOrder: 60,
  },
  {
    name: "Other coloured stones",
    categorySlug: "other-coloured-stones",
    summary: "Demo entry. A guide to the wider group of coloured stones, such as garnet, topaz and aquamarine.",
    hardness: "Varies by species, from about 6.5 to 8.5 on the Mohs scale",
    properties: "This group covers many species with very different hardness and sensitivity. Identify the species first, because care and value depend on it.",
    origins: "Demo note: origins vary widely by species. Ask for a laboratory opinion when origin affects the price.",
    treatments: "Demo note: heating, irradiation and coating are used on several species. Disclose all treatments in writing.",
    qualityGuide: "Judge colour, clarity and cut for the specific species. Compare against other stones of the same species, not against a different gemstone.",
    care: "Check the hardness of the species before cleaning. Softer stones need gentle care, and some should never be cleaned in ultrasonic equipment.",
    priceFactors: "Species rarity, colour, clarity, weight and treatment are the main factors. Some species are common, while others are scarce and command high prices.",
    metaDescription: "Demo reference page for other coloured stones: properties, origins, treatments, quality and price factors.",
    sortOrder: 70,
  },
];

export const M6_DEMO_REFERENCE_CATEGORY_SLUGS = M6_DEMO_REFERENCE.map((entry) => entry.categorySlug);
