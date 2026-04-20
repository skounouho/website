# Unified Content Width & Spacing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace five per-page container divs with one `<PageContainer>` component that enforces a single reading width (65ch), formalized vertical rhythm, and a nav-gutter reservation.

**Architecture:** A single server-safe wrapper component in `components/layout/`. Spacing tokens in `app/theme.css` consumed via Tailwind arbitrary values (`mt-[var(--space-section)]`). Container uses `md:px-24` for symmetric horizontal padding — no changes to `FloatingNav`. The Home page's `md:pt-[20vh]` top offset becomes the default for all pages.

**Tech Stack:** Next.js App Router, Tailwind CSS v4, CSS custom properties, TypeScript.

**Testing note:** The repo's vitest config only targets `lib/**/__tests__/` and has no jsdom/React-testing-library setup. Verification runs existing automated checks (`lint`, `typecheck`, `test`, `build`) after every task, and a final manual browser check at the end.

---

## File Structure

```
components/layout/
  PageContainer.tsx                          # NEW
app/
  theme.css                                  # MODIFY — add tokens
  globals.css                                # MODIFY — prose rules use tokens
  page.tsx                                   # MODIFY
  blog/page.tsx                              # MODIFY
  blog/[slug]/page.tsx                       # MODIFY
  resume/page.tsx                            # MODIFY
  not-found.tsx                              # MODIFY
components/blog/
  PostHeader.tsx                             # MODIFY — token margins
  PostFooter.tsx                             # MODIFY — token margins
```

Spec: `docs/superpowers/specs/2026-04-19-content-width-design.md` (already committed).

---

## Task 1: Add spacing tokens + consume in prose rules

**Files:**
- Modify: `app/theme.css`
- Modify: `app/globals.css`

- [ ] **Step 1: Add tokens to `:root` block in `app/theme.css`**

Open `app/theme.css`. In the `:root, [data-theme="light"]` block, after the `--font-mono` line and before `--ease-standard`, add three spacing tokens. The final `:root` block should read:

```css
:root,
[data-theme="light"] {
  --bg: #f5f2ee;
  --fg: #1a1a1a;
  --fg-muted: #6b6660;
  --border: #e3ded6;
  --accent: #8a6f4f;

  --font-serif: "Alegreya Variable", Georgia, serif;
  --font-sans: "Lato", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, Menlo, monospace;

  --space-page-y: 6rem;
  --space-section: 5rem;
  --space-block: 2.5rem;

  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --duration-fast: 120ms;
  --duration-medium: 220ms;
  --duration-slow: 400ms;
}
```

No change to the `[data-theme="dark"]` block — tokens are theme-agnostic.

- [ ] **Step 2: Consume tokens in `app/globals.css` prose rules**

In `app/globals.css`, update three selectors:

```css
.prose-site h2 {
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 24px;
  line-height: 1.25;
  margin: var(--space-section) 0 1rem;
}
.prose-site h3 {
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 20px;
  line-height: 1.3;
  margin: var(--space-block) 0 0.75rem;
}
.prose-site hr {
  border: 0;
  border-top: 1px solid var(--border);
  margin: var(--space-section) 0;
}
```

The old values were `margin: 2.5rem 0 1rem` (h2), `margin: 2rem 0 0.75rem` (h3), `margin: 3rem 0` (hr). This is a small rhythm change — h2 now breaks at 5rem instead of 2.5rem (larger), h3 breaks at 2.5rem instead of 2rem (slightly larger), hr at 5rem instead of 3rem (larger). Accepted per the spec — these values align with page-level section/block rhythm.

- [ ] **Step 3: Verify CSS parses**

Run: `npm run build`
Expected: build succeeds. No CSS parse errors in the output.

- [ ] **Step 4: Commit**

```bash
git add app/theme.css app/globals.css
git commit -m "style(tokens): add page/section/block spacing scale"
```

---

## Task 2: Create `<PageContainer>` component

**Files:**
- Create: `components/layout/PageContainer.tsx`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p components/layout
```

- [ ] **Step 2: Write the component**

Create `components/layout/PageContainer.tsx` with this exact content:

```tsx
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
}

/**
 * Single source of truth for long-form page layout: reading width, horizontal
 * gutter (reserves space for the floating nav at md+), and vertical rhythm.
 * Every page that holds prose, resume entries, or lists of links should use
 * this. The map page (full-bleed) opts out.
 */
export function PageContainer({ children, className }: Props) {
  const base =
    "mx-auto max-w-[65ch] px-6 md:px-24 " +
    "pt-[var(--space-page-y)] pb-[var(--space-page-y)] md:pt-[20vh]";
  return <div className={className ? `${base} ${className}` : base}>{children}</div>;
}
```

Notes:
- No `cn`/`clsx` — simple string concat. The `className` prop exists only so `/not-found` can layer on its `min-h-screen flex …` positioning; that's the only consumer that needs it.
- Server-safe: no `"use client"`, no hooks.
- `md:px-24` is 6rem — enough to clear the floating nav's expanded label at every desktop width. Symmetric, so content stays visually centered with the viewport.
- `pt-[var(--space-page-y)]` resolves to 6rem on mobile; `md:pt-[20vh]` overrides at the `md` breakpoint for the vertical-centered landing feel.

- [ ] **Step 3: Verify it compiles**

Run: `npm run typecheck`
Expected: exits 0.

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add components/layout/PageContainer.tsx
git commit -m "feat(layout): add PageContainer component"
```

---

## Task 3: Migrate Home page

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace the inline container**

Replace the entire content of `app/page.tsx` with:

```tsx
import { getAboutPage } from "@/lib/content";
import { renderMdx } from "@/lib/content/mdx";
import { PageContainer } from "@/components/layout/PageContainer";

export default function Home() {
  const about = getAboutPage();
  return (
    <PageContainer>
      <article className="prose-site w-full">{renderMdx(about.body)}</article>
    </PageContainer>
  );
}
```

The old container was `<div className="mx-auto max-w-[60ch] px-6 pt-24 pb-24 md:pt-[20vh]">`. Width moves from 60ch to 65ch; vertical padding is now tokenized via `PageContainer`.

- [ ] **Step 2: Verify**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: all pass (74 tests).

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "refactor(home): use PageContainer (65ch)"
```

---

## Task 4: Migrate blog index

**Files:**
- Modify: `app/blog/page.tsx`

- [ ] **Step 1: Replace the container and migrate the heading margin to a token**

Replace the entire content of `app/blog/page.tsx` with:

```tsx
import type { Metadata } from "next";
import { getBlogPosts } from "@/lib/content";
import { PostListRow } from "@/components/blog/PostListRow";
import { PageContainer } from "@/components/layout/PageContainer";

export const metadata: Metadata = {
  title: "Writing",
  description: "Essays and notes by Senou Kounouho.",
};

export default function BlogIndex() {
  const posts = [...getBlogPosts()].sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
  );

  return (
    <PageContainer>
      <h1 className="font-sans mb-[var(--space-section)] text-[36px] font-bold">
        Writing
      </h1>
      <ul className="flex flex-col gap-3">
        {posts.map((post) => (
          <PostListRow key={post.slug} post={post} />
        ))}
      </ul>
    </PageContainer>
  );
}
```

The old heading used `mb-12` (3rem); switching to `--space-section` (5rem) gives more breathing room before the post list, consistent with resume section heads.

- [ ] **Step 2: Verify**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add app/blog/page.tsx
git commit -m "refactor(blog): use PageContainer + spacing tokens"
```

---

## Task 5: Migrate blog post page + PostHeader + PostFooter

**Files:**
- Modify: `app/blog/[slug]/page.tsx`
- Modify: `components/blog/PostHeader.tsx`
- Modify: `components/blog/PostFooter.tsx`

- [ ] **Step 1: Migrate `app/blog/[slug]/page.tsx`**

Replace the entire content with:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBlogPost, getBlogPosts, getPin } from "@/lib/content";
import { renderMdx } from "@/lib/content/mdx";
import { PostHeader } from "@/components/blog/PostHeader";
import { PostFooter } from "@/components/blog/PostFooter";
import { PageContainer } from "@/components/layout/PageContainer";

export function generateStaticParams() {
  return getBlogPosts()
    .filter((p) => !p.draft)
    .map((p) => ({ slug: p.slug }));
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const post = getBlogPost(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.date,
      modifiedTime: post.updated,
    },
  };
}

export default async function BlogPostPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  const places = post.places
    .map((id) => getPin(id))
    .filter((p): p is NonNullable<typeof p> => p !== null);

  return (
    <PageContainer>
      <article>
        <PostHeader post={post} />
        <div className="prose-site">{renderMdx(post.body)}</div>
        <PostFooter post={post} places={places} />
      </article>
    </PageContainer>
  );
}
```

- [ ] **Step 2: Migrate `components/blog/PostHeader.tsx`**

Replace the `<header>` line's `className` from `"mb-10"` to `"mb-[var(--space-block)]"`. The full file:

```tsx
import type { BlogPost } from "@/lib/content";
import { formatPostDate } from "@/lib/format";

export function PostHeader({ post }: { post: BlogPost }) {
  return (
    <header className="mb-[var(--space-block)]">
      <div className="font-serif text-sm" style={{ color: "var(--fg-muted)" }}>
        {formatPostDate(post.date)}
      </div>
      {post.updated ? (
        <div className="font-serif text-sm" style={{ color: "var(--fg-muted)" }}>
          Updated {formatPostDate(post.updated)}
        </div>
      ) : null}
      <h1
        className="font-sans mt-3 text-[36px] font-bold leading-[1.15]"
        style={{ color: "var(--fg)" }}
      >
        {post.title}
      </h1>
    </header>
  );
}
```

- [ ] **Step 3: Migrate `components/blog/PostFooter.tsx`**

Change the `<footer>` `className` from `"mt-16 border-t pt-10"` to `"mt-[var(--space-section)] border-t pt-[var(--space-block)]"`. The full file:

```tsx
import Link from "next/link";
import type { BlogPost, MapPin } from "@/lib/content";

export function PostFooter({
  post,
  places,
}: {
  post: BlogPost;
  places: MapPin[];
}) {
  return (
    <footer className="mt-[var(--space-section)] border-t pt-[var(--space-block)]" style={{ borderColor: "var(--border)" }}>
      {post.tags.length > 0 ? (
        <ul className="mb-6 flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <li
              key={tag}
              className="font-sans border px-2 py-1 text-[11px] uppercase tracking-wider"
              style={{
                borderColor: "var(--border)",
                color: "var(--fg-muted)",
              }}
            >
              {tag}
            </li>
          ))}
        </ul>
      ) : null}

      {places.length > 0 ? (
        <div className="mb-8">
          <h3 className="font-sans mb-2 text-[20px] font-bold">
            Places mentioned
          </h3>
          <ul className="font-serif flex flex-col gap-1">
            {places.map((pin) => (
              <li key={pin.id}>
                <Link href={`/map#${pin.id}`}>{pin.name}</Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Link href="/blog" className="font-sans text-sm">
        ← Back to writing
      </Link>
    </footer>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add app/blog/\[slug\]/page.tsx components/blog/PostHeader.tsx components/blog/PostFooter.tsx
git commit -m "refactor(blog-post): use PageContainer + spacing tokens"
```

---

## Task 6: Migrate resume

**Files:**
- Modify: `app/resume/page.tsx`

- [ ] **Step 1: Replace the container and migrate section spacing**

Replace the entire content of `app/resume/page.tsx` with:

```tsx
import type { Metadata } from "next";
import {
  getBlogPosts,
  getEducation,
  getPins,
  getPublications,
  getWork,
} from "@/lib/content";
import { WorkEntry } from "@/components/resume/WorkEntry";
import { EducationEntry } from "@/components/resume/EducationEntry";
import { PublicationEntry } from "@/components/resume/PublicationEntry";
import { PageContainer } from "@/components/layout/PageContainer";

export const metadata: Metadata = {
  title: "Resume",
  description: "Work, education, and publications.",
};

function byStartDesc<T extends { start: string }>(a: T, b: T): number {
  return a.start < b.start ? 1 : a.start > b.start ? -1 : 0;
}

export default function ResumePage() {
  const work = [...getWork()].sort(byStartDesc);
  const education = [...getEducation()].sort(byStartDesc);
  const publications = [...getPublications()].sort(
    (a, b) => (b.year ?? Infinity) - (a.year ?? Infinity),
  );
  const posts = getBlogPosts();
  const pins = getPins();

  return (
    <PageContainer>
      <section>
        <h2 className="font-sans mb-[var(--space-block)] text-[24px] font-bold">
          Work
        </h2>
        <div className="space-y-10">
          {work.map((entry) => (
            <WorkEntry key={entry.id} entry={entry} posts={posts} pins={pins} />
          ))}
        </div>
      </section>

      <section className="mt-[var(--space-section)]">
        <h2 className="font-sans mb-[var(--space-block)] text-[24px] font-bold">
          Education
        </h2>
        <div className="space-y-10">
          {education.map((entry) => (
            <EducationEntry key={entry.id} entry={entry} />
          ))}
        </div>
      </section>

      <section className="mt-[var(--space-section)]">
        <h2 className="font-sans mb-[var(--space-block)] text-[24px] font-bold">
          Publications
        </h2>
        <div className="space-y-10">
          {publications.map((entry) => (
            <PublicationEntry key={entry.id} entry={entry} />
          ))}
        </div>
      </section>
    </PageContainer>
  );
}
```

Changes: width 70ch → 65ch (via `PageContainer`), `mt-20` → `mt-[var(--space-section)]`, `mb-10` → `mb-[var(--space-block)]`. Section headings and section-to-section gaps are unchanged visually (5rem = 80px ≈ the old 5rem; 2.5rem = 40px ≈ the old 2.5rem).

- [ ] **Step 2: Verify**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add app/resume/page.tsx
git commit -m "refactor(resume): use PageContainer (65ch) + spacing tokens"
```

---

## Task 7: Migrate 404 page

**Files:**
- Modify: `app/not-found.tsx`

- [ ] **Step 1: Replace the inline container with PageContainer + className override**

Replace the entire content of `app/not-found.tsx` with:

```tsx
import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";

export default function NotFound() {
  return (
    <PageContainer className="min-h-screen flex flex-col items-center justify-center gap-6 text-center">
      <p className="font-sans">Nothing here.</p>
      <Link href="/" className="font-sans text-sm">
        ← Home
      </Link>
    </PageContainer>
  );
}
```

The old container merged `min-h-screen flex flex-col items-center justify-center gap-6 text-center` with the width/padding. Width is now 65ch (was 60ch). `min-h-screen` + `flex` still vertically-centers the "Nothing here." text — the `md:pt-[20vh]` from `PageContainer` is additive padding, not a layout-mode change, so the flex center still works.

- [ ] **Step 2: Verify**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add app/not-found.tsx
git commit -m "refactor(404): use PageContainer"
```

---

## Task 8: Full verification + build

**Files:** none.

- [ ] **Step 1: Run the full automated check pipeline**

Run: `npm run lint && npm run typecheck && npm run test && npm run build`
Expected: all four exit 0. The vitest run should still report 74 passing tests. The Next build should succeed and print the route manifest.

- [ ] **Step 2: Start the dev server and visual-check every page**

Run in one terminal: `npm run dev`

In the browser, visit each route at two desktop viewport widths (~900px and ~1440px):

- `/` — About prose, top of content should sit at ~20vh on desktop, reading width capped at 65ch. Nav label on hover must not overlap body text.
- `/blog` — Writing index. "Writing" heading has generous bottom margin (5rem). Reading column centered.
- `/blog/2026-03-15-on-jazz` — Post header → body → footer. Footer border-top sits below body with clear separation.
- `/resume` — Three sections (Work, Education, Publications) with consistent 5rem gaps between. Education 2-col grid (degree / dates) still readable at 65ch.
- `/map` — Unchanged; full-bleed confirmed.
- `/nothing-here-404` — "Nothing here." vertically centered.

Also hover the nav on every page at the ~900px width. At no point should the expanded label touch body text.

- [ ] **Step 3: Nothing to commit** (no code changes in this task)

If any visual check fails, open a follow-up task — don't hack `PageContainer` into a special case.

---

## Self-review notes

**Spec coverage:**
- Goal: single 65ch reading width → Tasks 3, 4, 5, 6, 7 (every consumer migrated).
- Goal: one `<PageContainer>` component → Task 2.
- Goal: spacing tokens formalizing rhythm → Task 1 (definition + prose consumption) + Tasks 4–6 (page-level consumption).
- Goal: nav never overlaps body → `md:px-24` inside `PageContainer` (Task 2), verified in Task 8.
- Goal: `MdxImage` sizes correct → no code change needed (resolved by unification); noted in spec §4.
- Goal: `md:pt-[20vh]` applied everywhere → Task 2 builds it into `PageContainer`; every consumer inherits.

**Placeholder scan:** none.

**Type consistency:** `PageContainer` props `{ children, className? }` are consistent across Tasks 2, 3, 4, 5, 6, 7.
