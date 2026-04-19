# Content Data Layer Implementation Plan

> **Status: historical.** This plan was written on 2026-04-19 and executed via PR #1 / #3. Some schema details here (e.g. the original `conference | talk | poster` publication kinds, required `year`, absence of `service.yaml`) have since been superseded. Treat this document as a snapshot of the original plan, not as current design truth — see the spec at `docs/superpowers/specs/2026-04-19-content-data-layer-design.md` for the up-to-date shape.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a typed, Git-authored content layer (blog MDX + resume/map YAML) that is validated at build time and exposed through a small typed API under `lib/content/`.

**Architecture:** Zod schemas define every content shape and export TS types. A pure loader module reads files from `content/`, parses MDX frontmatter and YAML, validates each entry, enforces unique `id`s, and resolves cross-references. A thin `index.ts` memoizes and exposes reader functions (`getBlogPosts`, `getWork`, `getPins`, …). Unknown cross-reference targets or schema violations throw readable errors that fail `next build`. No rendering, routing, or styling is in scope.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 5, Zod (schemas), `yaml` (eemeli/yaml — YAML parser), `gray-matter` (MDX frontmatter), Vitest (test runner).

---

## File Structure

```
content/
  about.mdx                              # prose for Home/About (schema-less MDX)
  map.yaml                               # all map pins
  blog/
    2026-03-01-first-post.mdx            # seed post for tests/dev
  resume/
    work.yaml
    education.yaml
    publications.yaml

lib/content/
  schemas.ts                             # Zod schemas + exported TS types
  dates.ts                               # YYYY-MM / YYYY-MM-DD Zod helpers
  paths.ts                               # resolves content/ paths from cwd
  parse-yaml.ts                          # thin wrapper: read+parse one YAML file
  parse-mdx.ts                           # frontmatter + body split for one MDX file
  load-blog.ts                           # blog-specific loader (folder → BlogPost[])
  load-resume.ts                         # resume loaders (work/education/pubs)
  load-map.ts                            # map loader (map.yaml → MapPin[])
  load.ts                                # orchestrates all loaders + cross-refs
  index.ts                               # public API (memoized getters)
  __tests__/                             # colocated tests
    schemas.test.ts
    dates.test.ts
    parse-mdx.test.ts
    load-blog.test.ts
    load-resume.test.ts
    load-map.test.ts
    load.test.ts
    index.test.ts
  __fixtures__/                          # minimal valid + invalid content trees used by tests
    valid/
      about.mdx
      map.yaml
      blog/2026-01-01-hello.mdx
      resume/work.yaml
      resume/education.yaml
      resume/publications.yaml
    invalid-unknown-place/
      (same tree, but a blog post references an unknown pin id)
    invalid-duplicate-id/
      (two work entries with same id)
    invalid-filename-date-mismatch/
      (blog post frontmatter date doesn't match filename prefix)

vitest.config.ts                         # test runner config
```

Why this split:

- One file per loader keeps each responsibility (blog / resume / map) independent and testable.
- `parse-yaml.ts` and `parse-mdx.ts` hold the I/O so loaders are pure functions that take strings.
- `load.ts` is the only place that does cross-reference resolution — loaders never reach across collections.
- `index.ts` memoizes the heavy `load()` call so Next.js Server Components can call `getBlogPosts()` repeatedly with no re-parse cost.
- `__fixtures__/` directories are real content trees — each test points the loader at one and asserts on the result or the thrown error. This keeps tests readable and catches real-world parsing bugs.

---

## Task 1: Install dependencies and configure Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `.gitignore` (amend)

- [ ] **Step 1: Install runtime + dev dependencies**

Run:
```bash
npm install zod yaml gray-matter
npm install -D vitest @vitest/ui
```

- [ ] **Step 2: Add test scripts to `package.json`**

Modify the `"scripts"` block to:
```json
"scripts": {
  "dev": "next dev -H 0.0.0.0",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:ui": "vitest --ui"
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["lib/**/__tests__/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

- [ ] **Step 4: Ensure `.gitignore` covers Vitest output**

Append to `.gitignore` (if not already present):
```
# Vitest
coverage/
.vitest-cache/
```

- [ ] **Step 5: Sanity-check the runner**

Run: `npx vitest run --passWithNoTests`
Expected: exits 0 with "No test files found" message (we haven't written tests yet).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts .gitignore
git commit -m "chore: add zod, yaml, gray-matter, vitest"
```

---

## Task 2: Remove legacy PDFs and scaffold empty content directories

**Files:**
- Delete: `content/CV.pdf`
- Delete: `content/Senou_Kounouho_Resume.pdf`
- Create: `content/blog/.gitkeep`
- Create: `content/resume/.gitkeep`

- [ ] **Step 1: Remove the PDFs**

Run:
```bash
git rm content/CV.pdf content/Senou_Kounouho_Resume.pdf
```

- [ ] **Step 2: Create empty directories with `.gitkeep`**

Run:
```bash
mkdir -p content/blog content/resume
touch content/blog/.gitkeep content/resume/.gitkeep
```

- [ ] **Step 3: Commit**

```bash
git add -A content/
git commit -m "chore: remove CV/resume PDFs, scaffold content directories"
```

---

## Task 3: Date parsing helpers with tests

**Files:**
- Create: `lib/content/dates.ts`
- Create: `lib/content/__tests__/dates.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/content/__tests__/dates.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { yearMonth, isoDate, yearMonthOrNull } from "../dates";

describe("yearMonth", () => {
  it("accepts YYYY-MM strings", () => {
    expect(yearMonth.parse("2026-01")).toBe("2026-01");
  });

  it("rejects YYYY-MM-DD strings", () => {
    expect(() => yearMonth.parse("2026-01-15")).toThrow();
  });

  it("rejects bad months", () => {
    expect(() => yearMonth.parse("2026-13")).toThrow();
    expect(() => yearMonth.parse("2026-00")).toThrow();
  });

  it("rejects non-strings", () => {
    expect(() => yearMonth.parse(202601)).toThrow();
  });
});

describe("yearMonthOrNull", () => {
  it("accepts null", () => {
    expect(yearMonthOrNull.parse(null)).toBeNull();
  });
  it("accepts YYYY-MM", () => {
    expect(yearMonthOrNull.parse("2026-01")).toBe("2026-01");
  });
});

describe("isoDate", () => {
  it("accepts YYYY-MM-DD strings", () => {
    expect(isoDate.parse("2026-03-15")).toBe("2026-03-15");
  });

  it("coerces Date objects from YAML auto-parse", () => {
    const d = new Date(Date.UTC(2026, 2, 15));
    expect(isoDate.parse(d)).toBe("2026-03-15");
  });

  it("rejects YYYY-MM", () => {
    expect(() => isoDate.parse("2026-03")).toThrow();
  });

  it("rejects invalid calendar dates", () => {
    expect(() => isoDate.parse("2026-02-30")).toThrow();
  });
});
```

- [ ] **Step 2: Run the test — expect failure**

Run: `npm test -- dates`
Expected: fails with "Cannot find module '../dates'".

- [ ] **Step 3: Implement `lib/content/dates.ts`**

```ts
import { z } from "zod";

const YEAR_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const ISO_DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export const yearMonth = z
  .string()
  .regex(YEAR_MONTH_RE, "must be YYYY-MM");

export const yearMonthOrNull = yearMonth.nullable();

export const isoDate = z
  .preprocess((v) => {
    if (v instanceof Date) {
      const y = v.getUTCFullYear();
      const m = String(v.getUTCMonth() + 1).padStart(2, "0");
      const d = String(v.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    return v;
  }, z.string().regex(ISO_DATE_RE, "must be YYYY-MM-DD"))
  .refine((s) => {
    const [y, m, d] = s.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return (
      dt.getUTCFullYear() === y &&
      dt.getUTCMonth() === m - 1 &&
      dt.getUTCDate() === d
    );
  }, "must be a valid calendar date");
```

- [ ] **Step 4: Run the tests — expect pass**

Run: `npm test -- dates`
Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/content/dates.ts lib/content/__tests__/dates.test.ts
git commit -m "feat(content): add YYYY-MM and YYYY-MM-DD Zod helpers"
```

---

## Task 4: Zod schemas for blog, resume, map + exported types

**Files:**
- Create: `lib/content/schemas.ts`
- Create: `lib/content/__tests__/schemas.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/content/__tests__/schemas.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  blogFrontmatterSchema,
  workEntrySchema,
  educationEntrySchema,
  publicationSchema,
  mapPinSchema,
} from "../schemas";

describe("blogFrontmatterSchema", () => {
  const base = {
    title: "Hello",
    date: "2026-03-15",
    description: "Short summary.",
  };

  it("accepts minimal valid input and fills defaults", () => {
    const r = blogFrontmatterSchema.parse(base);
    expect(r.tags).toEqual([]);
    expect(r.draft).toBe(false);
    expect(r.places).toEqual([]);
    expect(r.updated).toBeUndefined();
  });

  it("rejects missing title", () => {
    expect(() => blogFrontmatterSchema.parse({ ...base, title: undefined })).toThrow();
  });

  it("rejects updated < date", () => {
    expect(() =>
      blogFrontmatterSchema.parse({ ...base, updated: "2026-03-14" }),
    ).toThrow(/updated/);
  });

  it("accepts updated === date", () => {
    expect(() =>
      blogFrontmatterSchema.parse({ ...base, updated: "2026-03-15" }),
    ).not.toThrow();
  });

  it("rejects non-kebab-case tags", () => {
    expect(() => blogFrontmatterSchema.parse({ ...base, tags: ["Data Science"] })).toThrow();
  });
});

describe("workEntrySchema", () => {
  const base = {
    id: "akara",
    org: "Akara",
    role: "Head of Product",
    location: "NYC",
    start: "2026-01",
    end: null,
    highlights: ["Did a thing."],
  };

  it("accepts null end", () => {
    expect(workEntrySchema.parse(base).end).toBeNull();
  });

  it("requires at least one highlight", () => {
    expect(() => workEntrySchema.parse({ ...base, highlights: [] })).toThrow();
  });

  it("rejects end < start when both present", () => {
    expect(() =>
      workEntrySchema.parse({ ...base, end: "2025-12" }),
    ).toThrow(/end/);
  });

  it("accepts end === start", () => {
    expect(() =>
      workEntrySchema.parse({ ...base, end: "2026-01" }),
    ).not.toThrow();
  });

  it("rejects bad id (must be kebab-case)", () => {
    expect(() => workEntrySchema.parse({ ...base, id: "Akara Markets" })).toThrow();
  });
});

describe("educationEntrySchema", () => {
  it("accepts minimal valid", () => {
    expect(() =>
      educationEntrySchema.parse({
        id: "duke-bse",
        institution: "Duke",
        degree: "BSE",
        start: "2022-08",
        end: "2026-05",
      }),
    ).not.toThrow();
  });
});

describe("publicationSchema", () => {
  const base = {
    id: "cma-2024",
    title: "A Paper",
    authors: ["A"],
    venue: "CMA",
    year: 2024,
    kind: "journal",
    status: "published",
  };
  it("accepts valid journal publication", () => {
    expect(() => publicationSchema.parse(base)).not.toThrow();
  });
  it("rejects unknown kind", () => {
    expect(() => publicationSchema.parse({ ...base, kind: "book" })).toThrow();
  });
  it("rejects empty authors", () => {
    expect(() => publicationSchema.parse({ ...base, authors: [] })).toThrow();
  });
});

describe("mapPinSchema", () => {
  const base = {
    id: "nyc",
    name: "New York City",
    kind: "worked",
    lat: 40.7128,
    lon: -74.006,
  };

  it("accepts minimal pin with no dates", () => {
    const r = mapPinSchema.parse(base);
    expect(r.blog_slugs).toEqual([]);
    expect(r.links).toEqual([]);
  });

  it("rejects out-of-range lat/lon", () => {
    expect(() => mapPinSchema.parse({ ...base, lat: 91 })).toThrow();
    expect(() => mapPinSchema.parse({ ...base, lon: -181 })).toThrow();
  });

  it("rejects unknown kind", () => {
    expect(() => mapPinSchema.parse({ ...base, kind: "birthplace" })).toThrow();
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `npm test -- schemas`
Expected: module-not-found error.

- [ ] **Step 3: Implement `lib/content/schemas.ts`**

```ts
import { z } from "zod";
import { yearMonth, yearMonthOrNull, isoDate } from "./dates";

const kebabCase = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "must be kebab-case");

const url = z.string().url();
const urlOrNull = url.nullable();

export const blogFrontmatterSchema = z
  .object({
    title: z.string().min(1),
    date: isoDate,
    updated: isoDate.optional(),
    description: z.string().min(1),
    tags: z.array(kebabCase).default([]),
    draft: z.boolean().default(false),
    places: z.array(kebabCase).default([]),
  })
  .strict()
  .refine(
    (v) => v.updated === undefined || v.updated >= v.date,
    { message: "updated must be >= date", path: ["updated"] },
  );

export type BlogFrontmatter = z.infer<typeof blogFrontmatterSchema>;

export interface BlogPost extends BlogFrontmatter {
  slug: string;
  body: string;
  filePath: string;
}

const yearMonthRange = <T extends z.ZodRawShape>(shape: T) =>
  z
    .object(shape)
    .strict()
    .refine(
      (v: Record<string, unknown>) => {
        const start = v.start as string | undefined;
        const end = v.end as string | null | undefined;
        return !start || !end || end >= start;
      },
      { message: "end must be >= start", path: ["end"] },
    );

export const workEntrySchema = yearMonthRange({
  id: kebabCase,
  org: z.string().min(1),
  role: z.string().min(1),
  location: z.string().min(1),
  start: yearMonth,
  end: yearMonthOrNull,
  org_url: url.optional(),
  highlights: z.array(z.string().min(1)).min(1),
  blog_slugs: z.array(kebabCase).default([]),
  map_pin_ids: z.array(kebabCase).default([]),
});

export type WorkEntry = z.infer<typeof workEntrySchema>;

export const educationEntrySchema = yearMonthRange({
  id: kebabCase,
  institution: z.string().min(1),
  degree: z.string().min(1),
  minor: z.string().optional(),
  certificate: z.string().optional(),
  gpa: z.string().optional(),
  honors: z.array(z.string().min(1)).default([]),
  start: yearMonth,
  end: yearMonthOrNull,
  map_pin_ids: z.array(kebabCase).default([]),
});

export type EducationEntry = z.infer<typeof educationEntrySchema>;

export const publicationKind = z.enum([
  "journal",
  "preprint",
  "conference",
  "talk",
  "poster",
]);
export const publicationStatus = z.enum(["published", "in-review", "accepted"]);

export const publicationSchema = z
  .object({
    id: kebabCase,
    title: z.string().min(1),
    authors: z.array(z.string().min(1)).min(1),
    venue: z.string().min(1),
    year: z.number().int().min(1900).max(2100),
    kind: publicationKind,
    status: publicationStatus,
    doi: z.string().optional(),
    url: urlOrNull.optional(),
    blog_slugs: z.array(kebabCase).default([]),
  })
  .strict();

export type Publication = z.infer<typeof publicationSchema>;

export const mapPinKind = z.enum([
  "lived",
  "worked",
  "visited",
  "conference",
  "research",
]);

export const mapPinSchema = yearMonthRange({
  id: kebabCase,
  name: z.string().min(1),
  kind: mapPinKind,
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  start: yearMonth.optional(),
  end: yearMonthOrNull.optional(),
  description: z.string().optional(),
  blog_slugs: z.array(kebabCase).default([]),
  links: z
    .array(z.object({ label: z.string().min(1), url }).strict())
    .default([]),
});

export type MapPin = z.infer<typeof mapPinSchema>;
```

- [ ] **Step 4: Run — expect pass**

Run: `npm test -- schemas`
Expected: all schema tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/content/schemas.ts lib/content/__tests__/schemas.test.ts
git commit -m "feat(content): add zod schemas and TS types"
```

---

## Task 5: Path + YAML parsing utilities

**Files:**
- Create: `lib/content/paths.ts`
- Create: `lib/content/parse-yaml.ts`

- [ ] **Step 1: Implement `lib/content/paths.ts`**

```ts
import path from "node:path";

export interface ContentPaths {
  root: string;
  blog: string;
  map: string;
  about: string;
  resume: {
    work: string;
    education: string;
    publications: string;
  };
}

export function contentPaths(root?: string): ContentPaths {
  const r = root ?? path.join(process.cwd(), "content");
  return {
    root: r,
    blog: path.join(r, "blog"),
    map: path.join(r, "map.yaml"),
    about: path.join(r, "about.mdx"),
    resume: {
      work: path.join(r, "resume", "work.yaml"),
      education: path.join(r, "resume", "education.yaml"),
      publications: path.join(r, "resume", "publications.yaml"),
    },
  };
}
```

- [ ] **Step 2: Implement `lib/content/parse-yaml.ts`**

```ts
import fs from "node:fs";
import YAML from "yaml";

export class ContentParseError extends Error {
  constructor(
    public filePath: string,
    public reason: string,
    public cause?: unknown,
  ) {
    super(`${filePath}: ${reason}`);
    this.name = "ContentParseError";
  }
}

export function readYamlList(filePath: string): unknown[] {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (err) {
    throw new ContentParseError(filePath, "failed to read file", err);
  }

  let parsed: unknown;
  try {
    parsed = YAML.parse(raw);
  } catch (err) {
    throw new ContentParseError(filePath, "YAML parse error", err);
  }

  if (parsed === null || parsed === undefined) return [];
  if (!Array.isArray(parsed)) {
    throw new ContentParseError(filePath, "expected top-level YAML list");
  }
  return parsed;
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/content/paths.ts lib/content/parse-yaml.ts
git commit -m "feat(content): add path helper and YAML list reader"
```

---

## Task 6: MDX frontmatter parser with tests

**Files:**
- Create: `lib/content/parse-mdx.ts`
- Create: `lib/content/__tests__/parse-mdx.test.ts`
- Create: `lib/content/__fixtures__/mdx/basic.mdx`
- Create: `lib/content/__fixtures__/mdx/no-frontmatter.mdx`

- [ ] **Step 1: Create MDX fixtures**

`lib/content/__fixtures__/mdx/basic.mdx`:
```mdx
---
title: "Hello"
date: 2026-01-15
description: "A short summary."
tags: [jazz, research]
---

Body starts here.

Second paragraph.
```

`lib/content/__fixtures__/mdx/no-frontmatter.mdx`:
```mdx
Just a body, nothing else.
```

- [ ] **Step 2: Write the failing tests**

`lib/content/__tests__/parse-mdx.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import path from "node:path";
import { parseMdx } from "../parse-mdx";

const fixture = (name: string) =>
  path.join(__dirname, "..", "__fixtures__", "mdx", name);

describe("parseMdx", () => {
  it("splits frontmatter and body", () => {
    const r = parseMdx(fixture("basic.mdx"));
    expect(r.data).toMatchObject({
      title: "Hello",
      description: "A short summary.",
      tags: ["jazz", "research"],
    });
    expect(r.body.trim().startsWith("Body starts here.")).toBe(true);
  });

  it("coerces date to YYYY-MM-DD string even when YAML parses it as Date", () => {
    const r = parseMdx(fixture("basic.mdx"));
    expect(r.data.date).toBe("2026-01-15");
  });

  it("throws ContentParseError when frontmatter missing", () => {
    expect(() => parseMdx(fixture("no-frontmatter.mdx"))).toThrow(/frontmatter/);
  });
});
```

- [ ] **Step 3: Run — expect failure**

Run: `npm test -- parse-mdx`
Expected: module not found.

- [ ] **Step 4: Implement `lib/content/parse-mdx.ts`**

```ts
import fs from "node:fs";
import matter from "gray-matter";
import { ContentParseError } from "./parse-yaml";

export interface ParsedMdx {
  data: Record<string, unknown>;
  body: string;
}

function coerceDates(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...data };
  for (const key of ["date", "updated"]) {
    const v = out[key];
    if (v instanceof Date) {
      const y = v.getUTCFullYear();
      const m = String(v.getUTCMonth() + 1).padStart(2, "0");
      const d = String(v.getUTCDate()).padStart(2, "0");
      out[key] = `${y}-${m}-${d}`;
    }
  }
  return out;
}

export function parseMdx(filePath: string): ParsedMdx {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch (err) {
    throw new ContentParseError(filePath, "failed to read file", err);
  }

  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(raw);
  } catch (err) {
    throw new ContentParseError(filePath, "frontmatter parse error", err);
  }

  if (!parsed.matter || parsed.matter.trim() === "") {
    throw new ContentParseError(filePath, "missing YAML frontmatter block");
  }

  return {
    data: coerceDates(parsed.data as Record<string, unknown>),
    body: parsed.content,
  };
}
```

- [ ] **Step 5: Run — expect pass**

Run: `npm test -- parse-mdx`
Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/content/parse-mdx.ts lib/content/__tests__/parse-mdx.test.ts lib/content/__fixtures__/mdx
git commit -m "feat(content): add MDX frontmatter parser"
```

---

## Task 7: Blog loader (`load-blog.ts`) with tests

**Files:**
- Create: `lib/content/load-blog.ts`
- Create: `lib/content/__tests__/load-blog.test.ts`
- Create: `lib/content/__fixtures__/blog-valid/2026-01-15-hello.mdx`
- Create: `lib/content/__fixtures__/blog-valid/2026-02-01-world.mdx`
- Create: `lib/content/__fixtures__/blog-draft/2026-03-01-wip.mdx`
- Create: `lib/content/__fixtures__/blog-bad-date/2026-01-15-mismatch.mdx`
- Create: `lib/content/__fixtures__/blog-dup-slug/2026-01-15-dup.mdx`
- Create: `lib/content/__fixtures__/blog-dup-slug/2026-02-01-dup.mdx`

- [ ] **Step 1: Create fixtures**

`blog-valid/2026-01-15-hello.mdx`:
```mdx
---
title: "Hello"
date: 2026-01-15
description: "First."
places: [nyc]
---
Body A.
```

`blog-valid/2026-02-01-world.mdx`:
```mdx
---
title: "World"
date: 2026-02-01
description: "Second."
tags: [jazz]
---
Body B.
```

`blog-draft/2026-03-01-wip.mdx`:
```mdx
---
title: "WIP"
date: 2026-03-01
description: "In progress."
draft: true
---
WIP body.
```

`blog-bad-date/2026-01-15-mismatch.mdx`:
```mdx
---
title: "Mismatch"
date: 2026-01-20
description: "Date disagrees with filename."
---
X.
```

`blog-dup-slug/2026-01-15-dup.mdx`:
```mdx
---
title: "First dup"
date: 2026-01-15
description: "."
---
A.
```

`blog-dup-slug/2026-02-01-dup.mdx`:
```mdx
---
title: "Second dup"
date: 2026-02-01
description: "."
---
B.
```

- [ ] **Step 2: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import path from "node:path";
import { loadBlogPosts } from "../load-blog";

const fx = (name: string) =>
  path.join(__dirname, "..", "__fixtures__", name);

describe("loadBlogPosts", () => {
  it("loads .mdx files, derives slug, sorts newest first", () => {
    const posts = loadBlogPosts(fx("blog-valid"), { includeDrafts: true });
    expect(posts.map((p) => p.slug)).toEqual(["world", "hello"]);
    expect(posts[0].title).toBe("World");
    expect(posts[0].body.trim()).toBe("Body B.");
  });

  it("excludes drafts when includeDrafts is false", () => {
    const posts = loadBlogPosts(fx("blog-draft"), { includeDrafts: false });
    expect(posts).toEqual([]);
  });

  it("includes drafts when includeDrafts is true", () => {
    const posts = loadBlogPosts(fx("blog-draft"), { includeDrafts: true });
    expect(posts).toHaveLength(1);
    expect(posts[0].draft).toBe(true);
  });

  it("throws when filename date prefix disagrees with frontmatter date", () => {
    expect(() =>
      loadBlogPosts(fx("blog-bad-date"), { includeDrafts: true }),
    ).toThrow(/filename.*date/i);
  });

  it("throws on duplicate slug", () => {
    expect(() =>
      loadBlogPosts(fx("blog-dup-slug"), { includeDrafts: true }),
    ).toThrow(/duplicate.*slug|slug.*dup/i);
  });

  it("returns [] if directory does not exist", () => {
    expect(loadBlogPosts(fx("blog-does-not-exist"), { includeDrafts: true })).toEqual([]);
  });
});
```

- [ ] **Step 3: Run — expect failure**

Run: `npm test -- load-blog`
Expected: module not found.

- [ ] **Step 4: Implement `lib/content/load-blog.ts`**

```ts
import fs from "node:fs";
import path from "node:path";
import { blogFrontmatterSchema, type BlogPost } from "./schemas";
import { parseMdx } from "./parse-mdx";
import { ContentParseError } from "./parse-yaml";

const FILENAME_RE = /^(\d{4}-\d{2}-\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)\.mdx$/;

export interface LoadBlogOptions {
  includeDrafts: boolean;
}

export function loadBlogPosts(
  dir: string,
  { includeDrafts }: LoadBlogOptions,
): BlogPost[] {
  if (!fs.existsSync(dir)) return [];

  const entries = fs
    .readdirSync(dir)
    .filter((n) => n.endsWith(".mdx"))
    .sort();

  const posts: BlogPost[] = [];
  const seen = new Map<string, string>();

  for (const name of entries) {
    const abs = path.join(dir, name);
    const match = FILENAME_RE.exec(name);
    if (!match) {
      throw new ContentParseError(
        abs,
        `blog filename must match YYYY-MM-DD-<slug>.mdx`,
      );
    }
    const [, filenameDate, slug] = match;

    const { data, body } = parseMdx(abs);
    const fm = blogFrontmatterSchema.parse(data);

    if (fm.date !== filenameDate) {
      throw new ContentParseError(
        abs,
        `frontmatter date ${fm.date} does not match filename date ${filenameDate}`,
      );
    }

    if (seen.has(slug)) {
      throw new ContentParseError(
        abs,
        `duplicate blog slug "${slug}" (also defined in ${seen.get(slug)})`,
      );
    }
    seen.set(slug, abs);

    if (fm.draft && !includeDrafts) continue;

    posts.push({ ...fm, slug, body, filePath: abs });
  }

  posts.sort((a, b) => b.date.localeCompare(a.date));
  return posts;
}
```

- [ ] **Step 5: Run — expect pass**

Run: `npm test -- load-blog`
Expected: 6 tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/content/load-blog.ts lib/content/__tests__/load-blog.test.ts lib/content/__fixtures__/blog-*
git commit -m "feat(content): add blog post loader with slug + draft handling"
```

---

## Task 8: Resume loader (`load-resume.ts`) with tests

**Files:**
- Create: `lib/content/load-resume.ts`
- Create: `lib/content/__tests__/load-resume.test.ts`
- Create: `lib/content/__fixtures__/resume-valid/work.yaml`
- Create: `lib/content/__fixtures__/resume-valid/education.yaml`
- Create: `lib/content/__fixtures__/resume-valid/publications.yaml`
- Create: `lib/content/__fixtures__/resume-dup-id/work.yaml`

- [ ] **Step 1: Create fixtures**

`resume-valid/work.yaml`:
```yaml
- id: akara
  org: Akara Markets
  role: Head of Product
  location: New York City, NY
  start: "2026-01"
  end: null
  highlights:
    - Shipped v1 of the trading UI.
  blog_slugs: []
  map_pin_ids: [nyc]
```

`resume-valid/education.yaml`:
```yaml
- id: duke-bse
  institution: Duke University
  degree: B.S.E. Mechanical Engineering
  minor: Mathematics
  gpa: "3.93/4.00"
  honors: [Angier B. Duke Scholar]
  start: "2022-08"
  end: "2026-05"
  map_pin_ids: [durham]
```

`resume-valid/publications.yaml`:
```yaml
- id: cma-2024
  title: "A paper"
  authors: ["Senou Kounouho"]
  venue: CMA
  year: 2024
  kind: journal
  status: published
  doi: 10.1016/example
```

`resume-dup-id/work.yaml`:
```yaml
- id: dup
  org: A
  role: X
  location: L
  start: "2026-01"
  end: null
  highlights: [h]
- id: dup
  org: B
  role: Y
  location: M
  start: "2026-02"
  end: null
  highlights: [h2]
```

- [ ] **Step 2: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import path from "node:path";
import {
  loadWork,
  loadEducation,
  loadPublications,
} from "../load-resume";

const fx = (p: string) =>
  path.join(__dirname, "..", "__fixtures__", p);

describe("loadWork", () => {
  it("parses work.yaml and validates each entry", () => {
    const work = loadWork(fx("resume-valid/work.yaml"));
    expect(work).toHaveLength(1);
    expect(work[0].id).toBe("akara");
    expect(work[0].end).toBeNull();
    expect(work[0].map_pin_ids).toEqual(["nyc"]);
  });

  it("throws on duplicate id within a file", () => {
    expect(() => loadWork(fx("resume-dup-id/work.yaml"))).toThrow(/duplicate.*id.*dup/i);
  });

  it("returns [] if file does not exist", () => {
    expect(loadWork(fx("does-not-exist.yaml"))).toEqual([]);
  });
});

describe("loadEducation", () => {
  it("parses education.yaml", () => {
    const r = loadEducation(fx("resume-valid/education.yaml"));
    expect(r[0].id).toBe("duke-bse");
    expect(r[0].gpa).toBe("3.93/4.00");
  });
});

describe("loadPublications", () => {
  it("parses publications.yaml", () => {
    const r = loadPublications(fx("resume-valid/publications.yaml"));
    expect(r[0].kind).toBe("journal");
    expect(r[0].doi).toBe("10.1016/example");
  });
});
```

- [ ] **Step 3: Run — expect failure**

Run: `npm test -- load-resume`
Expected: module not found.

- [ ] **Step 4: Implement `lib/content/load-resume.ts`**

```ts
import fs from "node:fs";
import { z } from "zod";
import { readYamlList, ContentParseError } from "./parse-yaml";
import {
  workEntrySchema,
  educationEntrySchema,
  publicationSchema,
  type WorkEntry,
  type EducationEntry,
  type Publication,
} from "./schemas";

function loadCollection<T extends { id: string }>(
  filePath: string,
  schema: z.ZodType<T>,
  label: string,
): T[] {
  if (!fs.existsSync(filePath)) return [];
  const items = readYamlList(filePath);

  const seen = new Map<string, number>();
  return items.map((item, i) => {
    const parsed = schema.safeParse(item);
    if (!parsed.success) {
      throw new ContentParseError(
        filePath,
        `${label}[${i}] failed validation: ${parsed.error.message}`,
      );
    }
    const value = parsed.data;
    if (seen.has(value.id)) {
      throw new ContentParseError(
        filePath,
        `duplicate ${label} id "${value.id}" at indexes ${seen.get(value.id)} and ${i}`,
      );
    }
    seen.set(value.id, i);
    return value;
  });
}

export function loadWork(filePath: string): WorkEntry[] {
  return loadCollection(filePath, workEntrySchema, "work");
}

export function loadEducation(filePath: string): EducationEntry[] {
  return loadCollection(filePath, educationEntrySchema, "education");
}

export function loadPublications(filePath: string): Publication[] {
  return loadCollection(filePath, publicationSchema, "publication");
}
```

- [ ] **Step 5: Run — expect pass**

Run: `npm test -- load-resume`
Expected: 5 tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/content/load-resume.ts lib/content/__tests__/load-resume.test.ts lib/content/__fixtures__/resume-*
git commit -m "feat(content): add resume loaders (work/education/publications)"
```

---

## Task 9: Map loader (`load-map.ts`) with tests

**Files:**
- Create: `lib/content/load-map.ts`
- Create: `lib/content/__tests__/load-map.test.ts`
- Create: `lib/content/__fixtures__/map-valid.yaml`
- Create: `lib/content/__fixtures__/map-dup.yaml`

- [ ] **Step 1: Create fixtures**

`map-valid.yaml`:
```yaml
- id: nyc
  name: New York City
  kind: worked
  lat: 40.7128
  lon: -74.0060
  start: "2026-01"
  end: null
  description: |
    Working at Akara Markets.
  blog_slugs: []
  links:
    - label: Akara Markets
      url: https://akaramarkets.com
- id: durham
  name: Durham
  kind: lived
  lat: 35.9940
  lon: -78.8986
```

`map-dup.yaml`:
```yaml
- id: x
  name: A
  kind: worked
  lat: 0
  lon: 0
- id: x
  name: B
  kind: visited
  lat: 1
  lon: 1
```

- [ ] **Step 2: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import path from "node:path";
import { loadPins } from "../load-map";

const fx = (p: string) =>
  path.join(__dirname, "..", "__fixtures__", p);

describe("loadPins", () => {
  it("parses valid pins", () => {
    const pins = loadPins(fx("map-valid.yaml"));
    expect(pins).toHaveLength(2);
    expect(pins[0].id).toBe("nyc");
    expect(pins[0].links[0].url).toBe("https://akaramarkets.com");
  });

  it("throws on duplicate id", () => {
    expect(() => loadPins(fx("map-dup.yaml"))).toThrow(/duplicate.*id.*x/i);
  });

  it("returns [] if file does not exist", () => {
    expect(loadPins(fx("nope.yaml"))).toEqual([]);
  });
});
```

- [ ] **Step 3: Run — expect failure**

Run: `npm test -- load-map`
Expected: module not found.

- [ ] **Step 4: Implement `lib/content/load-map.ts`**

```ts
import fs from "node:fs";
import { readYamlList, ContentParseError } from "./parse-yaml";
import { mapPinSchema, type MapPin } from "./schemas";

export function loadPins(filePath: string): MapPin[] {
  if (!fs.existsSync(filePath)) return [];
  const items = readYamlList(filePath);
  const seen = new Map<string, number>();
  return items.map((item, i) => {
    const parsed = mapPinSchema.safeParse(item);
    if (!parsed.success) {
      throw new ContentParseError(
        filePath,
        `pin[${i}] failed validation: ${parsed.error.message}`,
      );
    }
    const pin = parsed.data;
    if (seen.has(pin.id)) {
      throw new ContentParseError(
        filePath,
        `duplicate pin id "${pin.id}" at indexes ${seen.get(pin.id)} and ${i}`,
      );
    }
    seen.set(pin.id, i);
    return pin;
  });
}
```

- [ ] **Step 5: Run — expect pass**

Run: `npm test -- load-map`
Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/content/load-map.ts lib/content/__tests__/load-map.test.ts lib/content/__fixtures__/map-*
git commit -m "feat(content): add map pin loader"
```

---

## Task 10: Cross-reference resolver in `load.ts`

**Files:**
- Create: `lib/content/load.ts`
- Create: `lib/content/__tests__/load.test.ts`
- Create fixtures for integration trees — see Step 1.

- [ ] **Step 1: Create fixtures**

Create directory `lib/content/__fixtures__/tree-ok/` with:

`tree-ok/about.mdx`:
```mdx
# About
Some prose.
```

`tree-ok/map.yaml`:
```yaml
- id: nyc
  name: New York City
  kind: worked
  lat: 40.7128
  lon: -74.0060
  blog_slugs: [hello]
- id: durham
  name: Durham
  kind: lived
  lat: 35.9940
  lon: -78.8986
```

`tree-ok/blog/2026-01-15-hello.mdx`:
```mdx
---
title: "Hello"
date: 2026-01-15
description: "First."
places: [nyc]
---
Body.
```

`tree-ok/resume/work.yaml`:
```yaml
- id: akara
  org: Akara
  role: Head of Product
  location: NYC
  start: "2026-01"
  end: null
  highlights: [h]
  blog_slugs: [hello]
  map_pin_ids: [nyc]
```

`tree-ok/resume/education.yaml`:
```yaml
- id: duke-bse
  institution: Duke
  degree: BSE
  start: "2022-08"
  end: "2026-05"
  map_pin_ids: [durham]
```

`tree-ok/resume/publications.yaml`:
```yaml
- id: cma-2024
  title: "A paper"
  authors: [Senou]
  venue: CMA
  year: 2024
  kind: journal
  status: published
  blog_slugs: [hello]
```

Also create `tree-bad-place/` — same as `tree-ok/` but the blog post references `[mars]` instead of `[nyc]`:

`tree-bad-place/blog/2026-01-15-hello.mdx`:
```mdx
---
title: "Hello"
date: 2026-01-15
description: "First."
places: [mars]
---
Body.
```
(Copy all other files from `tree-ok/` unchanged.)

And `tree-bad-blog-ref/` — same as `tree-ok/` but `resume/work.yaml` references `blog_slugs: [missing]`:

`tree-bad-blog-ref/resume/work.yaml`:
```yaml
- id: akara
  org: Akara
  role: Head of Product
  location: NYC
  start: "2026-01"
  end: null
  highlights: [h]
  blog_slugs: [missing]
  map_pin_ids: [nyc]
```
(Copy all other files from `tree-ok/` unchanged.)

- [ ] **Step 2: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import path from "node:path";
import { loadAll } from "../load";

const fx = (p: string) =>
  path.join(__dirname, "..", "__fixtures__", p);

describe("loadAll", () => {
  it("loads a valid content tree", () => {
    const all = loadAll({ contentRoot: fx("tree-ok"), includeDrafts: true });
    expect(all.posts.map((p) => p.slug)).toEqual(["hello"]);
    expect(all.work[0].id).toBe("akara");
    expect(all.education[0].id).toBe("duke-bse");
    expect(all.publications[0].id).toBe("cma-2024");
    expect(all.pins.map((p) => p.id)).toEqual(["nyc", "durham"]);
  });

  it("rejects blog post referencing unknown pin id", () => {
    expect(() =>
      loadAll({ contentRoot: fx("tree-bad-place"), includeDrafts: true }),
    ).toThrow(/unknown.*pin.*mars/i);
  });

  it("rejects work entry referencing unknown blog slug", () => {
    expect(() =>
      loadAll({ contentRoot: fx("tree-bad-blog-ref"), includeDrafts: true }),
    ).toThrow(/unknown.*blog.*missing/i);
  });
});
```

- [ ] **Step 3: Run — expect failure**

Run: `npm test -- __tests__/load.test`
Expected: module not found.

- [ ] **Step 4: Implement `lib/content/load.ts`**

```ts
import { contentPaths } from "./paths";
import { loadBlogPosts } from "./load-blog";
import { loadPins } from "./load-map";
import {
  loadWork,
  loadEducation,
  loadPublications,
} from "./load-resume";
import { ContentParseError } from "./parse-yaml";
import type {
  BlogPost,
  WorkEntry,
  EducationEntry,
  Publication,
  MapPin,
} from "./schemas";

export interface LoadAllOptions {
  contentRoot?: string;
  includeDrafts: boolean;
}

export interface AllContent {
  posts: BlogPost[];
  work: WorkEntry[];
  education: EducationEntry[];
  publications: Publication[];
  pins: MapPin[];
}

export function loadAll({ contentRoot, includeDrafts }: LoadAllOptions): AllContent {
  const p = contentPaths(contentRoot);

  const pins = loadPins(p.map);
  const posts = loadBlogPosts(p.blog, { includeDrafts });
  const work = loadWork(p.resume.work);
  const education = loadEducation(p.resume.education);
  const publications = loadPublications(p.resume.publications);

  const pinIds = new Set(pins.map((x) => x.id));
  const slugs = new Set(posts.map((x) => x.slug));

  const checkPinRefs = (
    where: string,
    ownerId: string,
    ids: string[],
  ) => {
    for (const id of ids) {
      if (!pinIds.has(id)) {
        throw new ContentParseError(
          where,
          `${ownerId}: unknown pin id "${id}" — not found in map.yaml`,
        );
      }
    }
  };

  const checkBlogRefs = (
    where: string,
    ownerId: string,
    s: string[],
  ) => {
    for (const slug of s) {
      if (!slugs.has(slug)) {
        throw new ContentParseError(
          where,
          `${ownerId}: unknown blog slug "${slug}" — not found in content/blog/`,
        );
      }
    }
  };

  for (const post of posts) {
    checkPinRefs(post.filePath, post.slug, post.places);
  }
  for (const w of work) {
    checkPinRefs(p.resume.work, w.id, w.map_pin_ids);
    checkBlogRefs(p.resume.work, w.id, w.blog_slugs);
  }
  for (const e of education) {
    checkPinRefs(p.resume.education, e.id, e.map_pin_ids);
  }
  for (const pub of publications) {
    checkBlogRefs(p.resume.publications, pub.id, pub.blog_slugs);
  }
  for (const pin of pins) {
    checkBlogRefs(p.map, pin.id, pin.blog_slugs);
  }

  return { posts, work, education, publications, pins };
}
```

- [ ] **Step 5: Run — expect pass**

Run: `npm test -- __tests__/load.test`
Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/content/load.ts lib/content/__tests__/load.test.ts lib/content/__fixtures__/tree-*
git commit -m "feat(content): resolve cross-references between blog/resume/map"
```

---

## Task 11: Public API (`index.ts`) with memoization

**Files:**
- Create: `lib/content/index.ts`
- Create: `lib/content/__tests__/index.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import path from "node:path";
import {
  configureContent,
  getBlogPosts,
  getBlogPost,
  getWork,
  getEducation,
  getPublications,
  getPins,
  getPin,
  _resetContentForTests,
} from "../index";

const root = path.join(__dirname, "..", "__fixtures__", "tree-ok");

describe("public API", () => {
  beforeEach(() => {
    _resetContentForTests();
    configureContent({ contentRoot: root, includeDrafts: true });
  });

  it("returns the expected collections", () => {
    expect(getBlogPosts().map((p) => p.slug)).toEqual(["hello"]);
    expect(getBlogPost("hello")?.title).toBe("Hello");
    expect(getBlogPost("missing")).toBeNull();
    expect(getWork()[0].id).toBe("akara");
    expect(getEducation()[0].id).toBe("duke-bse");
    expect(getPublications()[0].id).toBe("cma-2024");
    expect(getPins().map((x) => x.id)).toEqual(["nyc", "durham"]);
    expect(getPin("nyc")?.name).toBe("New York City");
    expect(getPin("mars")).toBeNull();
  });

  it("memoizes across calls", () => {
    const a = getBlogPosts();
    const b = getBlogPosts();
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `npm test -- __tests__/index.test`
Expected: module not found.

- [ ] **Step 3: Implement `lib/content/index.ts`**

```ts
import { loadAll, type AllContent } from "./load";

export type {
  BlogPost,
  WorkEntry,
  EducationEntry,
  Publication,
  MapPin,
} from "./schemas";

interface Config {
  contentRoot?: string;
  includeDrafts: boolean;
}

const defaultConfig = (): Config => ({
  contentRoot: undefined,
  includeDrafts: process.env.NODE_ENV !== "production",
});

let config: Config = defaultConfig();
let cached: AllContent | null = null;

export function configureContent(next: Partial<Config>): void {
  config = { ...config, ...next };
  cached = null;
}

export function _resetContentForTests(): void {
  config = defaultConfig();
  cached = null;
}

function all(): AllContent {
  if (!cached) cached = loadAll(config);
  return cached;
}

export function getBlogPosts() {
  return all().posts;
}

export function getBlogPost(slug: string) {
  return all().posts.find((p) => p.slug === slug) ?? null;
}

export function getWork() {
  return all().work;
}

export function getEducation() {
  return all().education;
}

export function getPublications() {
  return all().publications;
}

export function getPins() {
  return all().pins;
}

export function getPin(id: string) {
  return all().pins.find((p) => p.id === id) ?? null;
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npm test -- __tests__/index.test`
Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/content/index.ts lib/content/__tests__/index.test.ts
git commit -m "feat(content): expose memoized public API"
```

---

## Task 12: Seed real content files

**Files:**
- Create: `content/about.mdx`
- Create: `content/map.yaml`
- Create: `content/resume/work.yaml`
- Create: `content/resume/education.yaml`
- Create: `content/resume/publications.yaml`
- Create: `content/blog/2026-03-15-on-jazz.mdx`
- Delete: `content/blog/.gitkeep` and `content/resume/.gitkeep` (no longer needed)

- [ ] **Step 1: `content/about.mdx`** — placeholder prose the user can replace later.

```mdx
# About

This is a placeholder about page. Replace with real prose.
```

- [ ] **Step 2: `content/map.yaml`**

```yaml
- id: nyc
  name: New York City
  kind: worked
  lat: 40.7128
  lon: -74.0060
  start: "2026-01"
  end: null
  description: |
    Working at Akara Markets, building courtside intelligence
    for sports prediction markets.
  blog_slugs: []
  links:
    - label: Akara Markets
      url: https://akaramarkets.com

- id: durham
  name: Durham
  kind: lived
  lat: 35.9940
  lon: -78.8986
  start: "2022-08"
  end: "2026-05"
  description: |
    Duke University — undergraduate.
```

- [ ] **Step 3: `content/resume/work.yaml`**

```yaml
- id: akara-markets
  org: Akara Markets
  role: Head of Product
  location: New York City, NY
  start: "2026-01"
  end: null
  org_url: https://akaramarkets.com
  highlights:
    - "Founding team of a start-up building courtside intelligence for sports prediction markets."
    - "Built and iterated on web and iOS apps in React / React Native."
  blog_slugs: []
  map_pin_ids: [nyc]
```

- [ ] **Step 4: `content/resume/education.yaml`**

```yaml
- id: duke-bse
  institution: Duke University
  degree: B.S.E. Mechanical Engineering
  minor: Mathematics
  certificate: Material Science & Engineering
  gpa: "3.93/4.00"
  honors: [Angier B. Duke Scholar, Tau Beta Pi, Pi Tau Sigma]
  start: "2022-08"
  end: "2026-05"
  map_pin_ids: [durham]
```

- [ ] **Step 5: `content/resume/publications.yaml`**

```yaml
- id: cma-2024-phase-changes
  title: "Uncertainty in atomic-level phase changes driven by model choice"
  authors: ["Senou Kounouho"]
  venue: Computer Methods in Applied Mechanics and Engineering
  year: 2024
  kind: journal
  status: published
  doi: 10.1016/j.cma.2024.117323
  url: null
  blog_slugs: []
```

- [ ] **Step 6: `content/blog/2026-03-15-on-jazz.mdx`** — seed post so the blog folder isn't empty.

```mdx
---
title: "On Jazz and Numerical Methods"
date: 2026-03-15
description: "Placeholder seed post. Replace with real content."
tags: [jazz]
places: [nyc]
---

Placeholder body. Replace with real content.
```

- [ ] **Step 7: Remove `.gitkeep` files**

Run:
```bash
git rm -f content/blog/.gitkeep content/resume/.gitkeep
```

- [ ] **Step 8: Verify it loads**

Add an integration smoke test at `lib/content/__tests__/real-content.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import path from "node:path";
import {
  configureContent,
  _resetContentForTests,
  getBlogPosts,
  getWork,
  getEducation,
  getPublications,
  getPins,
} from "../index";

describe("real content/ tree", () => {
  beforeEach(() => {
    _resetContentForTests();
    configureContent({
      contentRoot: path.join(process.cwd(), "content"),
      includeDrafts: true,
    });
  });

  it("loads without throwing and returns non-empty collections", () => {
    expect(getBlogPosts().length).toBeGreaterThan(0);
    expect(getWork().length).toBeGreaterThan(0);
    expect(getEducation().length).toBeGreaterThan(0);
    expect(getPublications().length).toBeGreaterThan(0);
    expect(getPins().length).toBeGreaterThan(0);
  });
});
```

Run: `npm test`
Expected: all tests (including `real-content`) pass.

- [ ] **Step 9: Commit**

```bash
git add content/ lib/content/__tests__/real-content.test.ts
git commit -m "feat(content): seed initial blog/resume/map content"
```

---

## Task 13: Ensure `next build` picks up the loader

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Add a temporary import in `app/page.tsx` to verify the loader runs at build time**

Replace `app/page.tsx` contents with:
```tsx
import { getBlogPosts, getPins, getWork } from "@/lib/content";

export default function Home() {
  const posts = getBlogPosts();
  const pins = getPins();
  const work = getWork();
  return (
    <main className="p-8 font-sans">
      <h1 className="text-2xl">Content loader smoke page</h1>
      <p>
        {posts.length} post(s), {pins.length} pin(s), {work.length} work entry(ies).
      </p>
    </main>
  );
}
```

- [ ] **Step 2: Install dependencies first (if not already) and run the build**

Run:
```bash
npm install
npm run build
```

Expected: build completes without errors. The home page statically renders the counts.

- [ ] **Step 3: Introduce a deliberate bad reference to verify the build fails loudly**

Temporarily edit `content/blog/2026-03-15-on-jazz.mdx` frontmatter to `places: [mars]`.

Run: `npm run build`

Expected: build fails with a clear `ContentParseError` mentioning `unknown pin id "mars"`.

Revert the change:
```bash
git checkout content/blog/2026-03-15-on-jazz.mdx
```

- [ ] **Step 4: Commit the smoke page**

```bash
git add app/page.tsx
git commit -m "chore: wire content loader into home page for build-time validation"
```

---

## Task 14: Final verification pass

**Files:** none

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Run production build one more time**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Spec cross-check**

Walk the spec (`docs/superpowers/specs/2026-04-19-content-data-layer-design.md`) section by section and confirm:

- File layout matches.
- Blog schema fields, defaults, and `updated >= date` rule all present.
- Resume work / education / publications schemas match including enums.
- Map pin schema matches including `kind` enum closure.
- Cross-refs enforced: `blog.places`, `work.map_pin_ids`, `education.map_pin_ids`, `work.blog_slugs`, `publications.blog_slugs`, `map.blog_slugs`.
- Drafts excluded in production, included in dev (via `NODE_ENV`).
- Errors mention file paths.
- Public API matches signatures in spec.

If any gap: add a task, fix, re-run tests, commit.
