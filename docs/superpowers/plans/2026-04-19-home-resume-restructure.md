# Home / Resume Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split Work into paid / teaching-other, split Publications into papers / conferences, merge About + Resume onto `/`, and remove `/resume`.

**Architecture:** Add a required `category` field to `workEntrySchema` and tag every work entry. Extract partition/sort logic into a new `lib/content/resume-sections.ts` module so it can be unit-tested against the real `lib/**/__tests__/` path. Delete the `/resume` route and rewrite `app/page.tsx` to render the combined page with section anchors. Update `FloatingNav` to use hash-based anchors and a client-side hash reader for active state.

**Tech Stack:** Next.js 16 App Router, TypeScript, Zod, Vitest (node env, `lib/**/__tests__/` only — no jsdom/RTL).

**Testing note (spec amendment):** The spec mentions a React Testing Library page-level test. `vitest.config.ts` runs node-only against `lib/**/__tests__/`. To avoid scope creep, this plan moves the page-level assertion into unit tests on helper functions in `lib/content/resume-sections.ts`, and verifies the full page via `npm run build` + a manual dev-server browser check in Task 5.

Spec: `docs/superpowers/specs/2026-04-19-home-resume-restructure-design.md` (already committed).

---

## File Structure

```
lib/content/
  schemas.ts                                           # MODIFY — workCategory enum + required field
  resume-sections.ts                                   # NEW — partition/sort helpers
  __fixtures__/resume-valid/work.yaml                  # MODIFY — add category field
  __fixtures__/resume-dup-id/work.yaml                 # MODIFY — add category field
  __tests__/schemas.test.ts                            # MODIFY — category tests
  __tests__/resume-sections.test.ts                    # NEW — helper tests

content/
  resume/work.yaml                                     # MODIFY — category on all 11 entries
  about.mdx                                            # MODIFY — drop /resume pointer

app/
  page.tsx                                             # MODIFY — combined home
  resume/page.tsx                                      # DELETE
  resume/                                              # DELETE (empty after page.tsx removal)
  sitemap.ts                                           # MODIFY — drop /resume entry

components/nav/
  FloatingNav.tsx                                      # MODIFY — hash anchors + client-side active state
```

---

## Task 1: Add `category` field to work schema

**Files:**
- Modify: `lib/content/schemas.ts`
- Modify: `lib/content/__tests__/schemas.test.ts`
- Modify: `lib/content/__fixtures__/resume-valid/work.yaml`
- Modify: `lib/content/__fixtures__/resume-dup-id/work.yaml`
- Modify: `content/resume/work.yaml`

- [ ] **Step 1: Add failing schema tests**

Open `lib/content/__tests__/schemas.test.ts`. Replace the `describe("workEntrySchema", ...)` block with:

```ts
describe("workEntrySchema", () => {
  const base = {
    id: "akara",
    org: "Akara",
    role: "Head of Product",
    location: "NYC",
    start: "2026-01",
    end: null,
    highlights: ["Did a thing."],
    category: "paid",
  };

  it("accepts null end", () => {
    expect(workEntrySchema.parse(base).end).toBeNull();
  });

  it("requires at least one highlight", () => {
    expect(() =>
      workEntrySchema.parse({ ...base, highlights: [] }),
    ).toThrow();
  });

  it("rejects end < start when both present", () => {
    expect(() => workEntrySchema.parse({ ...base, end: "2025-12" })).toThrow(
      /end/,
    );
  });

  it("accepts end === start", () => {
    expect(() =>
      workEntrySchema.parse({ ...base, end: "2026-01" }),
    ).not.toThrow();
  });

  it("rejects bad id (must be kebab-case)", () => {
    expect(() =>
      workEntrySchema.parse({ ...base, id: "Akara Markets" }),
    ).toThrow();
  });

  it("requires category", () => {
    const { category: _c, ...rest } = base;
    void _c;
    expect(() => workEntrySchema.parse(rest)).toThrow(/category/);
  });

  it("rejects unknown category values", () => {
    expect(() =>
      workEntrySchema.parse({ ...base, category: "volunteer" }),
    ).toThrow();
  });

  it("accepts category 'paid'", () => {
    expect(workEntrySchema.parse({ ...base, category: "paid" }).category).toBe(
      "paid",
    );
  });

  it("accepts category 'teaching-other'", () => {
    expect(
      workEntrySchema.parse({ ...base, category: "teaching-other" }).category,
    ).toBe("teaching-other");
  });
});
```

- [ ] **Step 2: Run tests to verify the category tests fail**

Run: `npm test -- schemas`
Expected: The three new category tests fail (schema still missing the field). Other tests may also fail because the shared `base` now has `category` and the old schema is `.strict()` (fails on unknown keys).

- [ ] **Step 3: Add `workCategory` enum and field to schema**

Open `lib/content/schemas.ts`. Just above `export const workEntrySchema = yearMonthRange({`, add:

```ts
export const workCategory = z.enum(["paid", "teaching-other"]);
export type WorkCategory = z.infer<typeof workCategory>;
```

Then inside the `workEntrySchema` object, add the field — place it after `highlights` and before `blog_slugs`:

```ts
export const workEntrySchema = yearMonthRange({
  id: kebabCase,
  org: z.string().min(1),
  role: z.string().min(1),
  subtitle: z.string().min(1).optional(),
  location: z.string().min(1),
  start: yearMonth,
  end: yearMonthOrNull,
  org_url: url.optional(),
  highlights: z.array(z.string().min(1)).min(1),
  category: workCategory,
  blog_slugs: z.array(kebabCase).default([]),
  map_pin_ids: z.array(kebabCase).default([]),
});
```

- [ ] **Step 4: Update the valid fixture**

Open `lib/content/__fixtures__/resume-valid/work.yaml`. Add a `category` line:

```yaml
- id: akara
  org: Akara Markets
  role: Head of Product
  location: New York City, NY
  start: "2026-01"
  end: null
  highlights:
    - Shipped v1 of the trading UI.
  category: paid
  blog_slugs: []
  map_pin_ids: [nyc]
```

- [ ] **Step 5: Update the dup-id fixture**

Open `lib/content/__fixtures__/resume-dup-id/work.yaml`. Add `category: paid` to both entries:

```yaml
- id: dup
  org: A
  role: X
  location: L
  start: "2026-01"
  end: null
  highlights: [h]
  category: paid
- id: dup
  org: B
  role: Y
  location: M
  start: "2026-02"
  end: null
  highlights: [h2]
  category: paid
```

- [ ] **Step 6: Update real content — `content/resume/work.yaml`**

Open `content/resume/work.yaml`. Add a `category` line to every entry. Place it immediately after `highlights:` (and before `blog_slugs:`).

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

Example for the first entry:

```yaml
- id: akara-markets
  org: Akara Markets
  role: Technical Co-Founder & Head of Product
  location: New York City, NY
  start: "2026-01"
  end: null
  org_url: https://akaramarkets.com
  highlights:
    - "Co-founder of a startup delivering courtside intelligence for sports prediction markets and betting; co-own architecture, development, and deployment of web and iOS products from 0 to 1."
    - "Built a shared-codebase React / React Native app (web + iOS) with a Python backend for real-time sports data ingestion and sub-second delivery under live-game latency requirements."
    - "Built GitHub Actions CI/CD workflows running AI-assisted code review and a full E2E test suite."
    - "Built a design-to-production pipeline (Google Stitch → v0 → Claude Code) automating the full loop from UI mockup to working frontend and backend code."
  category: paid
  blog_slugs: []
  map_pin_ids: [nyc]
```

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: All tests pass, including the new category tests and the `real-content` test (which loads `content/resume/work.yaml`).

- [ ] **Step 8: Typecheck**

Run: `npm run typecheck`
Expected: Exit code 0. The new `category` field is now part of the `WorkEntry` type and consumers like `WorkEntry.tsx` don't reference it, so nothing breaks.

- [ ] **Step 9: Commit**

```bash
git add lib/content/schemas.ts lib/content/__tests__/schemas.test.ts \
        lib/content/__fixtures__/resume-valid/work.yaml \
        lib/content/__fixtures__/resume-dup-id/work.yaml \
        content/resume/work.yaml
git commit -m "feat(resume): add category field to work entries"
```

---

## Task 2: Resume-section helper module

**Files:**
- Create: `lib/content/resume-sections.ts`
- Create: `lib/content/__tests__/resume-sections.test.ts`

- [ ] **Step 1: Write failing tests**

Create `lib/content/__tests__/resume-sections.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { Publication, WorkEntry } from "../schemas";
import {
  partitionWorkByCategory,
  partitionPublicationsByKind,
  sortWorkByStartDesc,
  sortPublicationsByYearDesc,
} from "../resume-sections";

const work = (over: Partial<WorkEntry>): WorkEntry => ({
  id: "x",
  org: "Org",
  role: "Role",
  location: "L",
  start: "2020-01",
  end: null,
  highlights: ["h"],
  category: "paid",
  blog_slugs: [],
  map_pin_ids: [],
  ...over,
});

const pub = (over: Partial<Publication>): Publication => ({
  id: "p",
  title: "T",
  authors: ["A"],
  venue: "V",
  year: 2024,
  kind: "journal",
  status: "published",
  blog_slugs: [],
  ...over,
});

describe("partitionWorkByCategory", () => {
  it("splits entries into paid and teachingOther buckets", () => {
    const entries = [
      work({ id: "a", category: "paid" }),
      work({ id: "b", category: "teaching-other" }),
      work({ id: "c", category: "paid" }),
    ];
    const { paid, teachingOther } = partitionWorkByCategory(entries);
    expect(paid.map((e) => e.id)).toEqual(["a", "c"]);
    expect(teachingOther.map((e) => e.id)).toEqual(["b"]);
  });

  it("returns empty arrays when no entries", () => {
    expect(partitionWorkByCategory([])).toEqual({ paid: [], teachingOther: [] });
  });
});

describe("partitionPublicationsByKind", () => {
  it("splits journal/preprint into papers and presentation into conferences", () => {
    const entries = [
      pub({ id: "j", kind: "journal" }),
      pub({ id: "pr", kind: "preprint" }),
      pub({ id: "c", kind: "presentation" }),
    ];
    const { papers, conferences } = partitionPublicationsByKind(entries);
    expect(papers.map((e) => e.id)).toEqual(["j", "pr"]);
    expect(conferences.map((e) => e.id)).toEqual(["c"]);
  });
});

describe("sortWorkByStartDesc", () => {
  it("returns a new array sorted newest-first by start", () => {
    const entries = [
      work({ id: "old", start: "2020-01" }),
      work({ id: "new", start: "2026-01" }),
      work({ id: "mid", start: "2023-05" }),
    ];
    const result = sortWorkByStartDesc(entries);
    expect(result.map((e) => e.id)).toEqual(["new", "mid", "old"]);
    expect(result).not.toBe(entries);
  });
});

describe("sortPublicationsByYearDesc", () => {
  it("sorts by year desc using currentYear as fallback for missing year", () => {
    const entries = [
      pub({ id: "2024", year: 2024 }),
      pub({ id: "inreview", year: undefined, status: "in-review" }),
      pub({ id: "2025", year: 2025 }),
    ];
    const result = sortPublicationsByYearDesc(entries, 2026);
    expect(result.map((e) => e.id)).toEqual(["inreview", "2025", "2024"]);
  });

  it("is stable-ish for equal effective years (keeps relative input order)", () => {
    const entries = [
      pub({ id: "a", year: undefined, status: "in-review" }),
      pub({ id: "b", year: undefined, status: "in-review" }),
      pub({ id: "c", year: 2026 }),
    ];
    const result = sortPublicationsByYearDesc(entries, 2026);
    expect(result.map((e) => e.id)).toEqual(["a", "b", "c"]);
  });

  it("returns a new array (does not mutate input)", () => {
    const entries = [pub({ id: "a", year: 2024 })];
    const result = sortPublicationsByYearDesc(entries, 2026);
    expect(result).not.toBe(entries);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- resume-sections`
Expected: FAIL — "Cannot find module '../resume-sections'".

- [ ] **Step 3: Implement the helpers**

Create `lib/content/resume-sections.ts`:

```ts
import type { Publication, WorkEntry } from "./schemas";

export function partitionWorkByCategory(work: readonly WorkEntry[]): {
  paid: WorkEntry[];
  teachingOther: WorkEntry[];
} {
  const paid: WorkEntry[] = [];
  const teachingOther: WorkEntry[] = [];
  for (const entry of work) {
    if (entry.category === "paid") paid.push(entry);
    else teachingOther.push(entry);
  }
  return { paid, teachingOther };
}

export function partitionPublicationsByKind(
  pubs: readonly Publication[],
): { papers: Publication[]; conferences: Publication[] } {
  const papers: Publication[] = [];
  const conferences: Publication[] = [];
  for (const p of pubs) {
    if (p.kind === "presentation") conferences.push(p);
    else papers.push(p);
  }
  return { papers, conferences };
}

export function sortWorkByStartDesc<T extends { start: string }>(
  entries: readonly T[],
): T[] {
  return [...entries].sort((a, b) =>
    a.start < b.start ? 1 : a.start > b.start ? -1 : 0,
  );
}

export function sortPublicationsByYearDesc(
  pubs: readonly Publication[],
  currentYear: number,
): Publication[] {
  return [...pubs].sort(
    (a, b) => (b.year ?? currentYear) - (a.year ?? currentYear),
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- resume-sections`
Expected: All 7 tests pass.

- [ ] **Step 5: Run full suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: All tests pass, typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add lib/content/resume-sections.ts lib/content/__tests__/resume-sections.test.ts
git commit -m "feat(content): partition/sort helpers for resume sections"
```

---

## Task 3: Rewrite `app/page.tsx` as combined home, delete `/resume`, update sitemap + about

**Files:**
- Modify: `app/page.tsx`
- Delete: `app/resume/page.tsx`
- Modify: `app/sitemap.ts`
- Modify: `content/about.mdx`

- [ ] **Step 1: Rewrite `app/page.tsx`**

Overwrite `app/page.tsx` with:

```tsx
import type { Metadata } from "next";
import {
  getAboutPage,
  getBlogPosts,
  getEducation,
  getPins,
  getPublications,
  getWork,
} from "@/lib/content";
import {
  partitionPublicationsByKind,
  partitionWorkByCategory,
  sortPublicationsByYearDesc,
  sortWorkByStartDesc,
} from "@/lib/content/resume-sections";
import { renderMdx } from "@/lib/content/mdx";
import { WorkEntry } from "@/components/resume/WorkEntry";
import { EducationEntry } from "@/components/resume/EducationEntry";
import { PublicationEntry } from "@/components/resume/PublicationEntry";
import { PageContainer } from "@/components/layout/PageContainer";

export const metadata: Metadata = {
  title: "Senou Kounouho",
  description: "About, work, education, and publications.",
};

export default function Home() {
  const about = getAboutPage();
  const { paid, teachingOther } = partitionWorkByCategory(getWork());
  const paidWork = sortWorkByStartDesc(paid);
  const teachingWork = sortWorkByStartDesc(teachingOther);
  const education = sortWorkByStartDesc(getEducation());
  const { papers, conferences } = partitionPublicationsByKind(getPublications());
  const currentYear = new Date().getFullYear();
  const sortedPapers = sortPublicationsByYearDesc(papers, currentYear);
  const sortedConferences = sortPublicationsByYearDesc(conferences, currentYear);
  const posts = getBlogPosts();
  const pins = getPins();

  const sectionHeading =
    "font-sans mb-[var(--space-block)] text-[24px] font-bold";

  return (
    <PageContainer>
      <section id="about" aria-labelledby="about-heading">
        <h1 id="about-heading" className="sr-only">
          About
        </h1>
        <article className="prose-site w-full">{renderMdx(about.body)}</article>
      </section>

      <hr
        className="mt-[var(--space-section)] border-0"
        style={{ borderTop: "1px solid var(--border)" }}
        aria-hidden="true"
      />

      <div id="resume" className="mt-[var(--space-section)]">
        <section id="work">
          <h2 className={sectionHeading}>Work &amp; Internships</h2>
          <div className="space-y-10">
            {paidWork.map((entry) => (
              <WorkEntry key={entry.id} entry={entry} posts={posts} pins={pins} />
            ))}
          </div>
        </section>

        <section id="teaching" className="mt-[var(--space-section)]">
          <h2 className={sectionHeading}>Teaching &amp; Other</h2>
          <div className="space-y-10">
            {teachingWork.map((entry) => (
              <WorkEntry key={entry.id} entry={entry} posts={posts} pins={pins} />
            ))}
          </div>
        </section>

        <section id="education" className="mt-[var(--space-section)]">
          <h2 className={sectionHeading}>Education</h2>
          <div className="space-y-10">
            {education.map((entry) => (
              <EducationEntry key={entry.id} entry={entry} />
            ))}
          </div>
        </section>

        <section id="papers" className="mt-[var(--space-section)]">
          <h2 className={sectionHeading}>Published Papers</h2>
          <div className="space-y-10">
            {sortedPapers.map((entry) => (
              <PublicationEntry key={entry.id} entry={entry} />
            ))}
          </div>
        </section>

        <section id="conferences" className="mt-[var(--space-section)]">
          <h2 className={sectionHeading}>Conferences</h2>
          <div className="space-y-10">
            {sortedConferences.map((entry) => (
              <PublicationEntry key={entry.id} entry={entry} />
            ))}
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
```

Note: `sortWorkByStartDesc` is generic over `{ start: string }`, so it applies cleanly to `EducationEntry` too.

- [ ] **Step 2: Delete the `/resume` route**

Run:

```bash
git rm app/resume/page.tsx
rmdir app/resume
```

Expected: `app/resume/` no longer exists.

- [ ] **Step 3: Update `app/sitemap.ts`**

Open `app/sitemap.ts`. Remove the `/resume` entry from `staticEntries`:

```ts
import type { MetadataRoute } from "next";
import { getBlogPosts } from "@/lib/content";
import { SITE_URL } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getBlogPosts().filter((p) => !p.draft);
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: new Date() },
    { url: `${SITE_URL}/blog`, lastModified: new Date() },
    { url: `${SITE_URL}/map`, lastModified: new Date() },
  ];
  const postEntries: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${SITE_URL}/blog/${p.slug}`,
    lastModified: p.updated ?? p.date,
  }));
  return [...staticEntries, ...postEntries];
}
```

- [ ] **Step 4: Trim `content/about.mdx`**

Open `content/about.mdx`. Replace the last line:

```
For the details, see the [resume](/resume). For where the work happened, see the [map](/map).
```

with:

```
For where the work happened, see the [map](/map).
```

- [ ] **Step 5: Typecheck and build**

Run: `npm run typecheck`
Expected: Exit code 0.

Run: `npm run build`
Expected: Build succeeds. The route list should show `/`, `/blog`, `/blog/[slug]`, `/map` — no `/resume`.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx app/sitemap.ts content/about.mdx
git commit -m "feat(home): merge about + resume onto / and drop /resume route"
```

---

## Task 4: Update `FloatingNav` — hash anchors + client-side active state

**Files:**
- Modify: `components/nav/FloatingNav.tsx`

- [ ] **Step 1: Rewrite `components/nav/FloatingNav.tsx`**

Overwrite the file with:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BookOpen, FileText, Home, Map } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { NavIcon } from "./NavIcon";
import { ThemeToggle } from "./ThemeToggle";

interface NavItem {
  href: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const items: NavItem[] = [
  { href: "/#about", label: "Home", Icon: Home },
  { href: "/#resume", label: "Resume", Icon: FileText },
  { href: "/blog", label: "Blog", Icon: BookOpen },
  { href: "/map", label: "Map", Icon: Map },
];

const RESUME_HASHES = new Set([
  "#resume",
  "#work",
  "#teaching",
  "#education",
  "#papers",
  "#conferences",
]);

function isActive(pathname: string, hash: string, href: string): boolean {
  // Home-page anchor links
  if (href === "/#about") {
    return pathname === "/" && (hash === "" || hash === "#about");
  }
  if (href === "/#resume") {
    return pathname === "/" && RESUME_HASHES.has(hash);
  }
  // Non-home routes
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

function useHash(): string {
  const [hash, setHash] = useState("");
  useEffect(() => {
    const sync = () => setHash(window.location.hash);
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  return hash;
}

export function FloatingNav() {
  const pathname = usePathname();
  const hash = useHash();
  return (
    <>
      {/* Desktop: left edge, vertical */}
      <nav
        aria-label="Primary"
        className="fixed left-6 top-1/2 z-40 hidden -translate-y-1/2 md:block group"
      >
        <ul className="flex flex-col gap-8">
          {items.map(({ href, label, Icon }) => {
            const active = isActive(pathname, hash, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className="group/nav-item flex items-center gap-3 no-underline text-[color:var(--fg-muted)] hover:text-[color:var(--accent)] aria-[current=page]:text-[color:var(--accent)] transition-colors duration-[var(--duration-fast)] ease-[var(--ease-standard)]"
                  onClick={(e) => {
                    // Pointer/touch activations: drop focus so :focus-within
                    // doesn't keep the nav expanded post-navigation. Keyboard
                    // Enter/Space and programmatic .click() produce detail === 0,
                    // so we leave focus alone — that keeps the nav visible
                    // while the user is tabbing.
                    if (e.detail > 0) e.currentTarget.blur();
                  }}
                >
                  <NavIcon Icon={Icon} />
                  <span className="font-sans text-sm opacity-0 transition-opacity motion-safe:duration-[var(--duration-medium)] ease-[var(--ease-standard)] group-hover:opacity-100 group-focus-within:opacity-100">
                    {label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Desktop: bottom-left theme toggle */}
      <div className="fixed bottom-6 left-6 z-40 hidden md:block">
        <ThemeToggle />
      </div>

      {/* Mobile: bottom bar */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-center justify-around border-t md:hidden"
        style={{
          borderColor: "var(--border)",
          background: "color-mix(in srgb, var(--bg) 85%, transparent)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        {items.map(({ href, label, Icon }) => {
          const active = isActive(pathname, hash, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              aria-label={label}
              className="group/nav-item flex h-full flex-1 items-center justify-center no-underline text-[color:var(--fg-muted)] transition-colors duration-[var(--duration-fast)] ease-[var(--ease-standard)] hover:text-[color:var(--accent)] aria-[current=page]:text-[color:var(--accent)]"
            >
              <NavIcon Icon={Icon} size={22} />
            </Link>
          );
        })}
        <div className="flex h-full flex-1 items-center justify-center">
          <ThemeToggle />
        </div>
      </nav>
    </>
  );
}
```

Initial SSR render has `hash === ""`, so on `/` the Home item is active on first paint; the `useEffect` syncs the real hash on mount, which flips to Resume if the URL contains a `#resume` anchor. This matches the "no hydration flicker" note from the spec (Home-default on server is consistent with hash=""`).

- [ ] **Step 2: Typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: Both clean.

- [ ] **Step 3: Commit**

```bash
git add components/nav/FloatingNav.tsx
git commit -m "feat(nav): hash-anchor home/resume items with client-side active state"
```

---

## Task 5: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Lint, typecheck, test, build**

Run:

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

Expected: All four exit 0. Build output lists routes `/`, `/blog`, `/blog/[slug]`, `/map` — no `/resume`.

- [ ] **Step 2: Start the dev server**

Run: `npm run dev`
Expected: Server starts on port 3000.

- [ ] **Step 3: Manual browser checks**

Visit `http://localhost:3000/` and verify:

- [ ] About copy renders first; final paragraph ends with "…see the [map](/map)." (no resume pointer).
- [ ] A thin horizontal divider separates About from the resume content.
- [ ] Section order below the divider: **Work & Internships**, **Teaching & Other**, **Education**, **Published Papers**, **Conferences**.
- [ ] Work & Internships lists (newest first): Akara Markets, Argonne, Duke UQCM Lab, Sandia 2024, Sandia 2023.
- [ ] Teaching & Other lists (newest first): ME 336 TA, HOUSECS 59 Fall 25, Randolph RA, HOUSECS 59 Spr 24, CS 201 TA, Chronicle.
- [ ] Published Papers shows in-review entries (AES, JCTC) above the 2025 and 2024 CMAME papers. In-review entries display an "in review" badge.
- [ ] Conferences lists (newest first): USNCCM 2025, Frontiers 2025, WCCM 2024.
- [ ] Visiting `http://localhost:3000/resume` returns the 404 page (route removed).
- [ ] Nav "Home" icon active when URL is `/` (no hash).
- [ ] Clicking nav "Resume" scrolls to the Work & Internships heading and flips the active state to Resume.
- [ ] Clicking nav "Home" scrolls back to the About heading area and flips active back to Home.
- [ ] `http://localhost:3000/sitemap.xml` omits `/resume`.
- [ ] Dark-mode toggle still works and preserves the same layout.

- [ ] **Step 4: Stop the dev server**

Ctrl-C in the terminal running `npm run dev`.

- [ ] **Step 5: Verification-complete commit (if any doc tweaks were needed)**

If any manual check revealed an issue requiring a code fix, address it and commit. Otherwise no commit needed for this step.

---

## Self-Review Notes

- **Spec coverage:** Work split (Task 1 + Task 3), Publications split (Task 2 helpers + Task 3 page), in-review sorting (Task 2 sort helper + Task 5 manual check), combined home + `/resume` deletion (Task 3), nav hash anchors (Task 4), sitemap update (Task 3), about.mdx trim (Task 3), tests (Tasks 1 + 2). Page-level React Testing Library test from the spec is explicitly substituted with helper-level unit tests + manual browser check; this is called out in the plan header.
- **Placeholder scan:** No TBDs or vague handwaves. All test code and component code shown inline.
- **Type consistency:** `workCategory` enum, `Publication` kind `"journal" | "preprint" | "presentation"`, `WorkEntry.category` usage, and helper signatures line up across tasks.
