# Home / Resume Restructure — Design

Date: 2026-04-19
Branch: `feature/home-resume-sections`

## Goals

1. Split Work entries into **Work & Internships** (paid) and **Teaching & Other**, so paid roles carry positional priority on the page.
2. Split Publications into **Published Papers** (journal/preprint) and **Conferences** (presentations), with in-review papers living in the Papers section.
3. Merge the About page and the Resume page into a single Home page at `/` — About first, resume sections immediately below — and drop the `/resume` route.

Priority in all three cases is **positional only** (paid / published entries come first). No visual weight change between sub-sections — all section headings share the existing h2 scale, in keeping with the "one content focus at a time" design aesthetic.

## Content & Schema Changes

### `workEntrySchema` — new required `category` field

Add to `lib/content/schemas.ts`:

```ts
export const workCategory = z.enum(["paid", "teaching-other"]);

export const workEntrySchema = yearMonthRange({
  // ...existing fields...
  category: workCategory,
});
```

Tag each entry in `content/resume/work.yaml`:

| id | category |
|----|----------|
| `akara-markets` | `paid` |
| `argonne-cobra` | `paid` |
| `duke-uqcm-lab` | `paid` |
| `sandia-cint-2024` | `paid` |
| `sandia-cint-2023` | `paid` |
| `duke-housecs59-fall25` | `teaching-other` |
| `duke-me336-ta` | `teaching-other` |
| `duke-housecs59-spr24` | `teaching-other` |
| `duke-cs201-ta` | `teaching-other` |
| `duke-randolph-ra` | `teaching-other` |
| `duke-chronicle` | `teaching-other` |

### Publications — no schema change

- "Papers" section = entries where `kind` is `journal` or `preprint`.
- "Conferences" section = entries where `kind` is `presentation`.
- Render `(in review)` next to the venue in `PublicationEntry` when `status === "in-review"`, styled in the muted UI tone.

### Publications sort

Replace the existing `Infinity` fallback so in-review papers sort as current year:

```ts
const currentYear = new Date().getFullYear();
publications.sort(
  (a, b) => (b.year ?? currentYear) - (a.year ?? currentYear),
);
```

Applied within each of the two publication sub-sections independently.

### About MDX trim

`content/about.mdx` — last line currently reads:

> For the details, see the [resume](/resume). For where the work happened, see the [map](/map).

Drop the resume pointer (now directly below); keep the map pointer:

> For where the work happened, see the [map](/map).

## Routing

- **Delete** `app/resume/page.tsx` and the `app/resume/` directory.
- **Rewrite** `app/page.tsx` to render the combined page.
- Any internal link to `/resume` becomes `/#resume`. Expected hits: blog cross-links (grep first), not automatic — audit and update.
- `app/sitemap.ts` / `app/robots.ts` — remove `/resume` entry from the sitemap output.

## Home Page Layout

Pseudo-structure:

```tsx
<PageContainer>
  <section id="about" aria-labelledby="about-heading">
    <article className="prose-site w-full">{renderMdx(about.body)}</article>
  </section>

  <hr className="..." />  {/* thin low-contrast divider, design-aesthetic conformant */}

  <div id="resume">
    <section id="work"><h2>Work & Internships</h2>{paidWork.map(...)}</section>
    <section id="teaching" className="mt-[var(--space-section)]">
      <h2>Teaching & Other</h2>{teachingOther.map(...)}
    </section>
    <section id="education" className="mt-[var(--space-section)]">
      <h2>Education</h2>{education.map(...)}
    </section>
    <section id="papers" className="mt-[var(--space-section)]">
      <h2>Published Papers</h2>{papers.map(...)}
    </section>
    <section id="conferences" className="mt-[var(--space-section)]">
      <h2>Conferences</h2>{conferences.map(...)}
    </section>
  </div>
</PageContainer>
```

Notes:
- The `#resume` anchor sits on the wrapping `<div>` so nav-click to `/#resume` lands on the "Work & Internships" heading.
- Headings reuse the existing `font-sans mb-[var(--space-block)] text-[24px] font-bold` treatment from the old resume page.
- Section spacing reuses the `--space-section` / `--space-block` tokens already in the app.
- Within Work/Teaching/Conferences, entries sort by `start` (or `year`) descending. Within Papers, use the `year ?? currentYear` rule.

## Navigation

`components/nav/FloatingNav.tsx` — items become:

```ts
const items: NavItem[] = [
  { href: "/#about",  label: "Home",   Icon: Home },
  { href: "/#resume", label: "Resume", Icon: FileText },
  { href: "/blog",    label: "Blog",   Icon: BookOpen },
  { href: "/map",     label: "Map",    Icon: Map },
];
```

**Active-state logic** (replaces `isActive`):

- On path `/`:
  - Home active when hash is empty or `#about`.
  - Resume active when hash is `#resume`, `#work`, `#teaching`, `#education`, `#papers`, or `#conferences`.
- On any other path: active when the item's pathname prefix matches (same as today).

Active state needs the client-side hash, so `FloatingNav` (already `"use client"`) reads `window.location.hash` and listens for `hashchange`. Initial render on the server has no hash — render with Home active by default when `pathname === "/"` to avoid hydration flicker; sync on mount.

The existing `e.currentTarget.blur()` in the click handler stays as-is — same-page anchor clicks still need the nav to collapse after the scroll.

No scroll-spy (active-section-while-scrolling) in this change — out of scope.

## Tests

- **Schema test** (`lib/__tests__/` — new or extend existing): `workEntrySchema` requires `category` and rejects non-enum values; `work.yaml` fixtures all carry the field.
- **Content loader test**: `getWork()` returns entries with the new `category` field intact.
- **Page-level test** (new, uses React Testing Library or Vitest + RTL as the project already does): rendering `app/page.tsx` emits sections in order: `#about`, `#work`, `#teaching`, `#education`, `#papers`, `#conferences`, each with the expected h2 text.
- **Sitemap test** (if it exists): `/resume` no longer appears.
- **Publications sort test**: in-review entries land above prior-year entries; published entries sort by year-desc.
- Remove / update any existing test that imports or asserts against `app/resume/page.tsx`.

## Out of Scope

- Mobile-specific adjustments beyond what the existing bottom-bar already supports. Nav items just get new hrefs; mobile rendering inherits.
- Scroll-spy for per-section active state in the nav.
- Visual differentiation (size, weight, color) between sub-sections.
- Reordering entries manually beyond the date-desc default.
- Moving / renaming the `content/resume/*.yaml` files to reflect the new sub-section taxonomy. The schema `category` field carries the split; filenames stay.

## Risks & Mitigations

- **Hydration flicker on nav active state** — mitigated by rendering Home as active by default on `/` and syncing hash on mount.
- **Stale cross-links to `/resume`** — audit blog posts and MDX for `](/resume)` before merging; rewrite to `/#resume`.
- **Schema migration** — adding a required `category` field is a breaking change for existing YAML. Mitigated by updating `work.yaml` in the same commit; no external consumers.
