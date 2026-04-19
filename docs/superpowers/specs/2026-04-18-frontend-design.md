---
date: 2026-04-18
status: draft
---

# Frontend — Design

## Context

The site has four sections: Home/About, Resume, Blog, Map. The content data layer spec
(2026-04-19) defines how content is authored, validated, and exposed as a typed API. This spec
defines the frontend that renders it: routes, layout shell, per-page designs, MDX pipeline,
theming, and accessibility.

Design philosophy lives in `design-aesthetic.md` at the repo root. This spec is the
operational translation of that philosophy into concrete components, tokens, and file
structure. Where the aesthetic doc is authoritative on feel, this spec is authoritative on
implementation.

Guiding principles carried forward:

- **Focus over completeness.** One piece of content commands attention at a time.
- **Minimalist and editorial.** Closer to a print publication than a typical personal site.
- **Whitespace is a design element.** Generous vertical rhythm; never crowded.
- **One accent color.** Warm, muted, used sparingly.

## Route map

Next.js 16 App Router. Pure static generation — every page is built at compile time from the
content data layer. No runtime data fetching.

```
app/
  layout.tsx              root layout: fonts, theme, floating nav, theme toggle
  theme.css               single source of truth for design tokens
  page.tsx                /           — home, renders about.mdx
  resume/page.tsx         /resume     — work + education + publications, stacked
  blog/
    page.tsx              /blog       — chronological list of posts
    [slug]/page.tsx       /blog/:slug — single post
    opengraph-image.tsx   programmatic per-post OG image
  map/page.tsx            /map        — SVG world map + pins
  not-found.tsx           404
  sitemap.ts              build-time sitemap from content
  robots.ts               build-time robots.txt
```

`generateStaticParams` is used on `blog/[slug]/page.tsx` to prebuild every non-draft post.

## Layout shell

The root layout (`app/layout.tsx`) renders once and persists across route transitions. It
holds:

- Font loaders (Alegreya, Lato, JetBrains Mono) via `next/font/google`, bound to CSS
  variables.
- The `<FloatingNav>` and `<ThemeToggle>` components — both client components, mounted once.
- A main content region (`<main>`) where each route's page renders.

Route transitions use the View Transitions API (supported in Next 16) with an opacity-only
fade. Nothing translates; only content cross-fades at `var(--duration-slow)` (400ms).
Disabled when `prefers-reduced-motion` is set.

## Theme tokens

All theme-adjustable values live in one file: `app/theme.css`. Changing a token changes the
whole site. Tokens are exposed as CSS custom properties on `<html>`, scoped by `data-theme`,
and surfaced to Tailwind v4 via its `@theme` block.

### Colors

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#F5F2EE` | `#1C1C1C` | page background |
| `--fg` | `#1A1A1A` | `#EDE8E0` | body text |
| `--fg-muted` | `#6B6660` | `#8F8A82` | 14px+ metadata and secondary text |
| `--border` | `#E3DED6` | `#2E2A26` | 1px dividers, map country fills |
| `--accent` | `#8A6F4F` | `#B8986E` | hover state, active nav item, map pins |

Muted text is only used at 14px+ (metadata, captions). It never carries body copy. One and
only one accent is used site-wide.

### Typography

Three fonts, loaded through `next/font/google` (self-hosted, zero layout shift):

- **Alegreya** — weights 400, 500, 700 + italics — `--font-serif`.
- **Lato** — weights 400, 700 — `--font-sans`.
- **JetBrains Mono** — weight 400 — `--font-mono`.

**Typography rule (authoritative):**

- **Lato** is used only for headings (`h1`, `h2`, `h3`) and true UI chrome: floating nav
  labels, bottom-bar buttons, theme toggle, small pill-style tags, status labels (e.g.
  `[in review]`).
- **Alegreya** is used for everything else — body prose, list items, dates, metadata lines,
  publication authors/titles/venues, blog-list rows, "Places mentioned" items, popover
  descriptions. The distinction between reading content and contextual metadata is carried
  by size, weight, and color — not by font.

Typographic scale (body 18px / line-height 1.7):

| Role | Size | Weight | Font |
|---|---|---|---|
| `h1` | 40px | 700 | Lato |
| `h2` | 28px | 700 | Lato |
| `h3` | 22px | 500 | Lato |
| body | 18px | 400 | Alegreya |
| small | 14px | 400 | Alegreya or Lato depending on role (see rule above) |

### Spacing and shapes

- Base unit: 4px. Tailwind v4's default scale already matches.
- Reading column max-width: `65ch` for prose (blog post body, about.mdx). `70ch` for resume.
  `80ch` for list-heavy layouts.
- Border radius: 2px universal. Borders: 1px `var(--border)`.

### Motion

- `--ease-standard: cubic-bezier(0.2, 0, 0, 1)`
- `--duration-fast: 120ms` — link hovers, button states
- `--duration-medium: 220ms` — nav expand, theme toggle
- `--duration-slow: 400ms` — page transition fades

All motion tokens respect `prefers-reduced-motion`: when enabled, transitions collapse to
`0ms` and state changes are instant.

## Floating nav + theme toggle

Component: `components/nav/FloatingNav.tsx` (client).

### Desktop (≥768px)

- Fixed to the left edge, vertically centered (`top: 50%; transform: translateY(-50%)`).
- No background, no border, no shadow at rest — just icons floating over content.
- Four items stacked vertically, 32px gap:
  - Home → `home` icon → `/`
  - Resume → `file-text` icon → `/resume`
  - Blog → `book-open` icon → `/blog`
  - Map → `map` icon → `/map`
- Icons from `lucide-react`, tree-shaken. 20px, stroke 1.5, color `var(--fg-muted)`.
- Active route: icon color becomes `var(--accent)`. `aria-current="page"` on the link.
- Hover on any item expands the whole bar: icons slide 8px right, labels fade in in Lato
  14px `var(--fg)`. Transition `var(--duration-medium) var(--ease-standard)` on `transform`
  and `opacity`. Leaving the bar collapses it.
- Keyboard focus expands the bar the same way hover does, for parity.

### Theme toggle

Component: `components/nav/ThemeToggle.tsx`.

- Bottom-left corner on desktop (`position: fixed; bottom: 24px; left: 24px`).
- Sun icon in light mode, moon icon in dark mode.
- Same size, color, and hover treatment as nav icons.
- On click: flips `data-theme` on `<html>` and writes to `localStorage`.
- On first render, a small inline script in `<head>` reads `localStorage`; if absent, falls
  back to `prefers-color-scheme`. This runs before paint to avoid a theme flash.
- Button has `aria-label` that reflects the next state ("Switch to dark mode" when in
  light, and vice versa).

### Mobile (<768px)

- Side nav becomes a fixed bottom bar: `position: fixed; bottom: 0; left: 0; right: 0;
  height: 56px`.
- Five items equally spaced: Home, Resume, Blog, Map, Theme toggle.
- Icons only — no hover expansion (no hover on mobile).
- Active route icon is `var(--accent)`.
- Thin `var(--border)` top edge; background `var(--bg)` at 85% opacity with
  `backdrop-filter: blur(8px)` so content shows through.
- Pages get `padding-bottom: 72px` on mobile so the bar doesn't cover content.

### Accessibility

- `<nav aria-label="Primary">` wraps the item list.
- Each item is an `<a>` with `aria-current="page"` when active.
- Focus ring: 2px `var(--accent)` outline, 2px offset, visible only for keyboard users
  (`:focus-visible`).

## Per-page designs

### Home (`/`)

Centered single column, max-width `60ch`. Renders `about.mdx` through the same MDX
pipeline as blog posts. No recent-posts list, no cards, no CTAs — just the prose. Generous
vertical padding, content vertically centered in the viewport on larger screens.

The floating nav and theme toggle are the only interactive elements.

### Blog index (`/blog`)

Single column, max-width `65ch`. A small h1 `Writing` at the top, then a plain
chronological list — newest first.

Each row:

```
Mar 15, 2026   ·   On Jazz and Numerical Methods
```

- Date: Alegreya 14px `var(--fg-muted)`.
- Title: Alegreya 20px `var(--fg)`.
- Whole row is a link; on hover, the title flips to `var(--accent)` at
  `var(--duration-fast)`.
- Rows separated by 20px of vertical space. No dividers. No tags, no descriptions, no
  pagination.
- Draft posts (visible only in `next dev`) get a small Lato `DRAFT` pill next to the date.

### Blog post (`/blog/[slug]`)

Single column, max-width `65ch`.

Header:

- Date line (Alegreya 14px `var(--fg-muted)`); if `updated` is present, a second line
  `Updated Mar 20, 2026`.
- Title (h1, Lato 40px 700 `var(--fg)`).

Body: the MDX output from the data layer (see MDX pipeline below).

Footer (separated from body by a 1px `var(--border)` hairline and 64px of top margin):

- Tags as small Lato uppercase pills (one of the few chrome uses of Lato for non-heading
  text). Non-interactive in v1.
- If `places[]` is present: an h3 `Places mentioned` (Lato), followed by a short Alegreya
  list. Each item links to `/map#<pin-id>` — the map page reads the hash on mount and
  opens that pin's popover.
- A single `← Back to writing` link (Lato 14px) to `/blog`.

### Resume (`/resume`)

Single column, max-width `70ch`. Three sections stacked: Work, Education, Publications.
Each section has an h2 (Lato). Entries within a section are reverse-chronological.

**Work entry** (`components/resume/WorkEntry.tsx`):

- `role` as an h3 (Lato 22px 500).
- A metadata line (Alegreya 14px `var(--fg-muted)`): `org` as a link if `org_url` is
  present, then ` · `, `location`, ` · `, date range (`Jan 2026 – Present` if `end` is
  `null`).
- `highlights[]` as a tight bulleted list in Alegreya 18px.
- If `blog_slugs` or `map_pin_ids` exist, a final line `Related:` followed by inline links
  (post titles and pin names, separated by middle dots).

**Education entry** (`components/resume/EducationEntry.tsx`):

- `degree` as an h3 (Lato).
- `institution` line in Alegreya.
- `minor`, `certificate`, `gpa`, `honors` as a wrapped inline list in Alegreya 14px
  `var(--fg-muted)`, separated by middle dots. Empty fields are omitted.
- Date range right-aligned in Alegreya 14px `var(--fg-muted)` opposite the degree.

**Publication entry** (`components/resume/PublicationEntry.tsx`):

- Authors line in Alegreya 14px `var(--fg)` (italics off).
- Title in Alegreya 18px italic. Wrapped in a link if `doi` or `url` is present (DOI
  preferred — resolved to `https://doi.org/<doi>`).
- `venue` and `year` on one line in Alegreya 14px `var(--fg-muted)`, rendered as
  `Venue name (2024)`.
- If `status` is not `published`, a Lato uppercase pill (`[in review]` / `[accepted]`)
  trails the title.
- Publications are not grouped by `kind` in v1; the Publications section is one flat
  reverse-chronological list.

Spacing: 32px between entries, 80px between sections.

### Map (`/map`)

Full-viewport SVG world map. No page heading or chrome competes with the map. The
floating nav overlays it at the usual left edge, preserving its "barely there" feel.

**Implementation** (`components/map/WorldMap.tsx`):

- A single pre-rendered SVG of the world in Equal Earth projection — country fills
  `var(--border)`, country borders `var(--fg-muted)` at 0.5px. Ships as a static asset.
- `d3-geo` is used only in `lib/projection.ts` to project each pin's `lat/lon` to SVG
  `x/y` using the same Equal Earth projection. No `d3-geo` JS ships to the browser at
  runtime — projection happens at build time; pins render as static `<circle>` nodes.
- Pins: 6px circles, fill `var(--accent)`, 2px `var(--bg)` stroke (so they stand off the
  map). Clickable.

**Popover** (`components/map/PinPopover.tsx`, client):

Clicking a pin opens a popover anchored above (or below, if near the top edge):

- Pin `name` as an h3 (Lato).
- `kind` as a small Lato uppercase pill (chrome).
- Date range (Alegreya 14px `var(--fg-muted)`) if present.
- `description` as Alegreya body text (multi-paragraph on newlines).
- `links[]` as a short list of external links.
- If `blog_slugs[]` is present, an h3 `Related writing` (Lato) and an Alegreya list of
  post titles linking to `/blog/<slug>`.

Popover behavior:

- Closes on outside click, on Escape, or on opening another pin's popover.
- Flips above/below based on available space.
- `aria-expanded` and `role="dialog"` with `aria-labelledby` pointing at the pin name.
  No focus trap — popovers are lightweight disclosures, not modals.

**Hash linking:** `/map#nyc` opens that pin's popover on mount. The SVG is shifted
horizontally (CSS `transform: translateX(...)`) so the pin is centered; no real pan/zoom
library. If the hash doesn't match a pin, no popover opens and the hash is cleared.

### 404 (`not-found.tsx`)

Same visual layout as Home: single centered column. Body reads `Nothing here.` in
Alegreya. Beneath, a Lato `← Home` link. Nothing else.

## MDX pipeline

Blog posts and `about.mdx` are compiled at build time using `next-mdx-remote/rsc`. This
spec extends the content data loader from the content data layer spec with a new
`lib/content/mdx.ts` module, and augments the `BlogPost` type with a `body: ReactNode`
field holding the compiled node. Consumer pages don't touch MDX directly:

```tsx
const post = getBlogPost(slug);
return <Post title={post.title} date={post.date} body={post.body} />;
```

`about.mdx` is loaded and compiled the same way via a new `getAboutPage()` export on the
content loader.

**Plugins** (applied in `lib/content/mdx.ts`):

- `remark-gfm` — tables, strikethrough, task lists.
- `remark-math` + `rehype-katex` — inline (`$…$`) and display (`$$…$$`) math. KaTeX CSS
  imported once in the root layout. KaTeX's default color is overridden to
  `color: inherit` so math follows the theme.
- `remark-footnotes` — native markdown footnote syntax; rendered as a numbered list at
  the end of the post.
- `rehype-shiki` — syntax highlighting at build time. Two themes (`github-light`,
  `github-dark`) swapped by CSS scoped to `data-theme`. Zero runtime JS for highlighting.

**Custom element overrides** (registered with the MDX renderer in
`components/mdx/index.ts`):

| Element | Override | Behavior |
|---|---|---|
| `img` | `components/mdx/Image.tsx` | Wraps `next/image`. Requires explicit `width` and `height`. Renders an Alegreya italic `<figcaption>` from the `alt` text, or from a `title` attribute when present. |
| `a` | `components/mdx/Link.tsx` | Internal links use `next/link`; external links add `target="_blank" rel="noopener"` and a small trailing up-right arrow glyph. |
| `pre` / `code` | `components/mdx/Code.tsx` | Consumes Shiki-highlighted HTML; adds a 1px `var(--border)` surround and `--font-mono`. |
| `blockquote` | `components/mdx/Blockquote.tsx` | Left rule in `var(--accent)`, italic body. |
| `PullQuote` | `components/mdx/PullQuote.tsx` | Explicit opt-in (`<PullQuote>…</PullQuote>`). Alegreya italic ~28px, centered, thin rules top and bottom. |

Tables get a plain treatment — 1px `var(--border)` hairlines between rows, no zebra
striping.

## Metadata / SEO

- Root `metadata` in `app/layout.tsx` sets a default title template
  (`%s — Senou Kounouho`) and site-wide description.
- Each route exports `generateMetadata`:
  - Blog post: `title: post.title`, `description: post.description`,
    `openGraph.publishedTime: post.date`, `openGraph.modifiedTime: post.updated` when
    present.
  - Blog index, Resume, Map: static titles and descriptions.
- OG images:
  - Blog posts: programmatic via `ImageResponse` in
    `app/blog/[slug]/opengraph-image.tsx` — renders post title and date in Alegreya over
    the warm off-white background at 1200×630.
  - Other routes: one default site-wide OG image (committed as a static asset).
- `sitemap.ts` and `robots.ts` generate from the content data layer at build time.

## Accessibility

- Landmarks: `<main>` on every page, `<nav aria-label="Primary">` in layout. No
  persistent footer.
- Color contrast: WCAG AA minimum. `--fg` on `--bg` meets 4.5:1 at body size; muted
  pairings meet 3:1 and are only used at 14px+.
- Keyboard: all interactive elements are `<a>` or `<button>`. Nav expands on focus as
  well as hover.
- Focus ring: 2px `var(--accent)` outline with 2px offset, visible only via
  `:focus-visible`.
- `prefers-reduced-motion`: collapses all transition durations to 0.
- MDX images require non-empty `alt` text — enforced at build time in the Image
  component.
- Map popovers are accessible disclosures, not modals: `aria-expanded`, `role="dialog"`,
  close on Escape, no focus trap.

## File structure

```
app/
  layout.tsx
  theme.css
  page.tsx                    /
  not-found.tsx
  resume/page.tsx
  blog/
    page.tsx
    [slug]/page.tsx
    opengraph-image.tsx
  map/page.tsx
  sitemap.ts
  robots.ts
components/
  nav/
    FloatingNav.tsx
    ThemeToggle.tsx
  mdx/
    Image.tsx
    Link.tsx
    Code.tsx
    Blockquote.tsx
    PullQuote.tsx
    index.ts                  MDX components map
  blog/
    PostListRow.tsx
    PostHeader.tsx
    PostFooter.tsx
  resume/
    WorkEntry.tsx
    EducationEntry.tsx
    PublicationEntry.tsx
  map/
    WorldMap.tsx
    PinPopover.tsx
lib/
  content/                    existing — from the content data layer spec
    mdx.ts                    new: MDX compile pipeline
  projection.ts               d3-geo helper for lat/lon → SVG x/y
public/
  world-equal-earth.svg       pre-rendered base map
  og-default.png              fallback OG image
```

## Testing

- Type-check and lint in CI: `tsc --noEmit`, `next lint`.
- A small Vitest suite covers pure utilities:
  - `lib/projection.ts` — projection math for a handful of known lat/lon → x/y pairs.
  - `lib/content/mdx.ts` — renders expected elements for sample markdown exercising
    math, footnotes, code, and the custom `PullQuote` component.
- No component snapshot tests. Visual review is the acceptance criterion.
- `next build` runs on every PR; the content data layer's validation catches
  schema/cross-ref regressions there.

## Out of scope (v1)

- Tag filtering or search on the blog index.
- Pagination on the blog index.
- Previous / next post links.
- Comments, reactions, analytics.
- RSS feed generation.
- Dedicated pin routes (`/map/[id]`) — hash linking covers sharing.
- Image galleries on map pins.
- Admin UI or CMS.
- Automated visual regression or cross-browser tests.

## Open questions

- Final accent tone (`#8A6F4F` light / `#B8986E` dark). Will likely want tuning once
  rendered against real Alegreya body copy.
- OG image layout — final composition to be refined once the first real blog post
  exists.
