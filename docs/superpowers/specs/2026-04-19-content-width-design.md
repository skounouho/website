---
date: 2026-04-19
status: draft
---

# Unified Content Width & Spacing

## Context

Content widths and vertical spacing drift across pages. Five separate page components each inline their own `mx-auto max-w-[Xch] px-6 py-24` container, with three different reading widths (60ch on `/`, 65ch on `/blog` and `/blog/[slug]`, 70ch on `/resume`, 60ch on `/not-found`). Spacing values (`mt-20`, `mt-16`, `mb-12`, `mb-10`, `pt-10`, `my-12`, `my-10`, `my-6`, …) are chosen ad-hoc without a documented ladder. The floating side nav at `left-6` can visually crowd centered body text at narrow desktop widths (≈768–1024px), and `MdxImage` hardcodes a `sizes="…, 65ch"` hint that is wrong on the 60ch home page.

## Goals

- One reading width (65ch) for every long-form page.
- One `<PageContainer>` component that owns max-width, horizontal padding, vertical padding, and nav-gutter reservation. Every long-form page routes through it.
- Formalize the existing vertical rhythm (page / section / block) as CSS custom properties consumed across pages and prose.
- Floating nav label never overlaps body text at any desktop width.
- `MdxImage` `sizes` hint matches the unified container width on every page.
- Apply the Home page's desktop `md:pt-[20vh]` top offset to every page. (User preference: the vertical-centered feel of the landing page should be the default.)

## Non-goals

- Redesigning `FloatingNav` or `ThemeToggle` themselves.
- Map page layout — stays full-bleed.
- Mobile layout beyond what the existing bottom-bar nav already handles.
- A general typography or color refactor.

## Design

### 1. `<PageContainer>` component

New file: `components/layout/PageContainer.tsx`. Thin, presentational, server-safe. Wraps a `<div>` that applies:

```
mx-auto
max-w-[65ch]
px-6              /* mobile: 24px horizontal */
md:px-24          /* desktop: reserves gutter for floating nav + symmetric */
pt-24             /* mobile: 6rem top */
pb-[var(--space-page-y)]   /* 6rem bottom, tokenized */
md:pt-[20vh]      /* desktop: vertical-centered feel, matches Home page */
```

Props: `children` (required) and `className` (optional, merged via simple string concat; no `cn`/`clsx` dependency). No variants. `className` exists only for cases that need additional positioning (e.g., the 404 page needs `min-h-screen flex flex-col items-center justify-center`).

### 2. Spacing tokens

Add three tokens to `:root` in `app/theme.css`:

```css
--space-page-y: 6rem;    /* page top/bottom (mobile), and mobile+desktop bottom */
--space-section: 5rem;   /* gap between major page sections */
--space-block: 2.5rem;   /* gap between blocks inside a section */
```

Consumers migrate to these tokens via Tailwind arbitrary values (e.g. `mt-[var(--space-section)]`). Migration targets:

- `app/globals.css`
  - `.prose-site h2 { margin: ... }` — top → `var(--space-section)`
  - `.prose-site h3 { margin: ... }` — top → `var(--space-block)`
  - `.prose-site hr { margin: var(--space-section) 0 }`
- `app/resume/page.tsx`
  - Section `mt-20` → `mt-[var(--space-section)]`
  - Section heading `mb-10` → `mb-[var(--space-block)]`
- `app/blog/page.tsx`
  - `mb-12` → `mb-[var(--space-section)]`
- `components/blog/PostHeader.tsx`
  - `mb-10` → `mb-[var(--space-block)]`
- `components/blog/PostFooter.tsx`
  - `mt-16 pt-10` → `mt-[var(--space-section)] pt-[var(--space-block)]`

Values match current visual rhythm — this is a formalization pass, not a redesign.

### 3. Nav gutter reservation

Handled entirely by `md:px-24` on `PageContainer`. Symmetric — content remains visually centered with the viewport. At widths between `md` (768px) and ≈900px, the effective content width compresses below 65ch, which is acceptable (the 65ch cap is a *maximum*, not a target). Above ≈900px the cap is reached and the gutter grows organically.

No changes needed to `FloatingNav`, body, or main.

### 4. `MdxImage` sizes

Once all long-form pages are 65ch, the existing `sizes="(max-width: 768px) 100vw, 65ch"` is correct everywhere — no code change. The audit finding is resolved by unification.

### 5. Per-page migration

Replace inline container `<div>`s with `<PageContainer>`:

- `app/page.tsx` — container owns `pt-24 pb-24 md:pt-[20vh]`, so Home's inline custom padding is removed. Home becomes the simplest case.
- `app/blog/page.tsx` — swap container.
- `app/blog/[slug]/page.tsx` — swap container.
- `app/resume/page.tsx` — swap container + widen to 65ch (from 70ch).
- `app/not-found.tsx` — uses `PageContainer` with `className="min-h-screen flex flex-col items-center justify-center gap-6 text-center"` so the 404 can still vertically center its two-element body.

## File Structure

```
components/layout/
  PageContainer.tsx                          # NEW
app/
  theme.css                                  # MODIFY — add tokens
  globals.css                                # MODIFY — consume tokens in prose
  page.tsx                                   # MODIFY — use PageContainer
  blog/page.tsx                              # MODIFY
  blog/[slug]/page.tsx                       # MODIFY
  resume/page.tsx                            # MODIFY
  not-found.tsx                              # MODIFY
components/blog/
  PostHeader.tsx                             # MODIFY — tokens
  PostFooter.tsx                             # MODIFY — tokens
docs/superpowers/
  specs/2026-04-19-content-width-design.md   # this file
  plans/2026-04-19-content-width.md          # (written next)
```

## Verification

The vitest config only matches `lib/**/__tests__/`. No component tests exist; adding a test harness is out of scope. Verification uses existing CI checks plus manual browser inspection:

- `npm run lint` — no new warnings.
- `npm run typecheck` — no new type errors.
- `npm run test` — 74 tests still passing.
- `npm run build` — production build succeeds.
- Manual: open `/`, `/blog`, `/blog/2026-03-15-on-jazz`, `/resume`, `/map`, and a 404 URL at two desktop widths (≈900px and ≈1440px). Confirm (a) consistent reading width, (b) no nav label overlap with body text, (c) `md:pt-[20vh]` top offset applied uniformly.

## Risks

- **Applying `md:pt-[20vh]` to every page**: longer pages (blog posts with many sections, resume with three sections) start with substantial whitespace above the first heading. Accepted per user direction — it's the intended feel.
- **Resume at 65ch**: the 2-column education grid (`grid-cols-[1fr_auto]`) was sized for 70ch. At 65ch the date column will sit ~3–4 characters closer to the degree title. Still readable; not regressing.
- **`md:px-24` on narrow `md` widths**: between 768–900px, content compresses below 65ch. Acceptable — 65ch is a max, not a target.
