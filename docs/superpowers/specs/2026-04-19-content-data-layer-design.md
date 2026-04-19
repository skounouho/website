---
date: 2026-04-19
status: approved
---

# Content Data Layer — Design

## Context

The site has three content-driven sections: Resume, Blog, and Map. Before building any Next.js pages, we want to lock down the data model: where content lives in the repo, what fields each entry has, and how the app consumes it. This spec defines that layer. Rendering, styling, and navigation are deliberately out of scope.

The design favors:

- **Authoring in Git.** Content is plain files (MDX, YAML) committed to the repo — no CMS, no database.
- **Separation by shape.** Prose-heavy content uses MDX; structured records use YAML. Each format plays to its strengths.
- **Typed consumption.** All content is validated against Zod schemas at build time; downstream React components see fully-typed objects with no optional chaining on guaranteed fields.
- **Cross-references by id.** A blog post can point at map pins; a resume entry can point at blog posts and map pins. All cross-refs resolve at build time — unknown ids fail the build.

## File layout

```
content/
  blog/
    2026-03-01-first-post.mdx
    2026-03-15-on-jazz.mdx
  resume/
    work.yaml
    education.yaml
    publications.yaml
  map.yaml
  about.mdx
```

Notes:

- Blog filenames embed the publish date as a prefix (`YYYY-MM-DD-<slug>.mdx`). The slug is derived from the filename; no `slug` field in frontmatter.
- Resume is a folder with one YAML file per section. Keeps each file short and independently editable.
- Map is a single YAML file — pins are small and benefit from being viewed as a single list.
- `about.mdx` holds prose for the Home/About page. Schema-less; just MDX.
- The existing `content/CV.pdf` and `content/Senou_Kounouho_Resume.pdf` are removed — the structured resume replaces them.

### A note on date fields

All date values in YAML are strings matching either `YYYY-MM` or `YYYY-MM-DD`. To avoid YAML auto-casting partial dates to unexpected types, `YYYY-MM` values must be quoted in files (e.g. `start: "2026-01"`). Full `YYYY-MM-DD` values may be written unquoted; the loader coerces them to strings regardless.

## Blog post schema

Format: MDX file with YAML frontmatter.

```yaml
---
title: "On Jazz and Numerical Methods"
date: 2026-03-15
updated: 2026-03-20          # optional
description: "One-line summary for listings."
tags: [jazz, research]        # optional, defaults to []
draft: false                  # optional, defaults to false
places: [nyc, durham]         # optional, references map.yaml ids
---

MDX body here.
```

Field rules:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `title` | string | yes | |
| `date` | ISO date (`YYYY-MM-DD`) | yes | Must match filename prefix. |
| `description` | string | yes | Used in listings and meta tags. |
| `updated` | ISO date | no | Must be ≥ `date` if present. |
| `tags` | string[] | no | Lowercase, kebab-case. Default `[]`. |
| `draft` | boolean | no | Default `false`. Drafts are excluded from production builds but visible in `next dev`. |
| `places` | string[] | no | Each entry must match a pin `id` in `map.yaml`. |

Slug derivation: filename `2026-03-15-on-jazz.mdx` → slug `on-jazz`.

## Resume schemas

### `resume/work.yaml`

```yaml
- id: akara-markets
  org: Akara Markets
  role: Head of Product
  location: New York City, NY
  start: "2026-01"
  end: null                 # null = present
  org_url: https://akaramarkets.com
  highlights:
    - "Founding team of a start-up building courtside intelligence..."
    - "Built and iterated on web and iOS apps in React/ReactNative..."
  blog_slugs: []
  map_pin_ids: [nyc]
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | yes | Unique within the file. Kebab-case. |
| `org` | string | yes | |
| `role` | string | yes | |
| `location` | string | yes | Human-readable. |
| `start` | `YYYY-MM` | yes | |
| `end` | `YYYY-MM` \| `null` | yes | `null` means ongoing. |
| `org_url` | url | no | |
| `highlights` | string[] | yes | At least one. |
| `blog_slugs` | string[] | no | Each must match a blog post slug. |
| `map_pin_ids` | string[] | no | Each must match a pin `id`. |

### `resume/education.yaml`

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

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | yes | Unique within the file. |
| `institution` | string | yes | |
| `degree` | string | yes | |
| `minor` | string | no | |
| `certificate` | string | no | |
| `gpa` | string | no | Kept as string to preserve formatting like `"3.93/4.00"`. |
| `honors` | string[] | no | |
| `start` | `YYYY-MM` | yes | |
| `end` | `YYYY-MM` \| `null` | yes | |
| `map_pin_ids` | string[] | no | |

### `resume/publications.yaml`

```yaml
- id: cma-2024-phase-changes
  title: "Uncertainty in atomic-level phase changes driven by model choice"
  authors: ["Senou Kounouho", "..."]
  venue: Computer Methods in Applied Mechanics and Engineering
  year: 2024
  kind: journal            # journal | preprint | presentation
  status: published        # published | in-review | accepted
  doi: 10.1016/j.cma.2024.117323
  url: null
  blog_slugs: []
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | yes | |
| `title` | string | yes | |
| `authors` | string[] | yes | At least one. |
| `venue` | string | yes | Journal, conference, or workshop name. |
| `year` | integer | yes | |
| `kind` | enum | yes | `journal \| preprint \| presentation` |
| `status` | enum | yes | `published \| in-review \| accepted` |
| `doi` | string | no | Canonical DOI if available. |
| `url` | url \| null | no | Fallback link if no DOI. |
| `blog_slugs` | string[] | no | |

## Map schema

### `map.yaml`

```yaml
- id: nyc
  name: New York City
  kind: worked             # lived | worked | visited | conference | research
  lat: 40.7128
  lon: -74.0060
  start: "2026-01"         # optional; omit both for undated pins
  end: null                # null = ongoing
  description: |
    Working at Akara Markets, building courtside intelligence
    for sports prediction markets.
  blog_slugs: [on-jazz]
  links:
    - label: Akara Markets
      url: https://akaramarkets.com
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | yes | Unique within the file. Kebab-case. |
| `name` | string | yes | Display name on the map. |
| `kind` | enum | yes | `lived \| worked \| visited \| conference \| research` |
| `lat` | number | yes | Decimal degrees. |
| `lon` | number | yes | Decimal degrees. |
| `start` | `YYYY-MM` | no | |
| `end` | `YYYY-MM` \| `null` | no | `null` = ongoing. |
| `description` | string | no | Plain text with newlines. Not MDX — map popovers stay simple. |
| `blog_slugs` | string[] | no | Each must match a blog post slug. |
| `links` | `{label, url}[]` | no | |

`kind` is a closed enum. Adding a new kind requires a schema change — intentional, to keep the map legend stable.

## Validation & loading

A small loader module at `lib/content/` reads and validates everything at build time.

```
lib/content/
  schemas.ts    # Zod schemas + exported TS types
  load.ts       # parse files, validate, resolve cross-refs
  index.ts      # public API: getBlogPosts(), getWork(), getPins(), etc.
```

Responsibilities:

- Parse MDX frontmatter (blog) and YAML files (resume, map).
- Validate each entry against its Zod schema — required fields, enum values, date formats.
- Enforce uniqueness of `id` within each collection.
- Resolve cross-references:
  - `blog.places[]` must match an id in `map.yaml`.
  - `work.blog_slugs[]`, `publications.blog_slugs[]`, `map.blog_slugs[]` must match blog filenames.
  - `work.map_pin_ids[]`, `education.map_pin_ids[]` must match pin ids.
- Filter out `draft: true` posts in production builds.
- Emit readable errors pointing at the offending file and field.

Public API sketch:

```ts
// lib/content/index.ts
export function getBlogPosts(): BlogPost[];
export function getBlogPost(slug: string): BlogPost | null;
export function getWork(): WorkEntry[];
export function getEducation(): EducationEntry[];
export function getPublications(): Publication[];
export function getPins(): MapPin[];
export function getPin(id: string): MapPin | null;
```

Types are re-exported from `schemas.ts` so consumers can import `BlogPost`, `MapPin`, etc. directly.

## Out of scope

- Page components, routing, styling — covered by later specs.
- Search / full-text indexing.
- RSS feed generation (easy to add on top of `getBlogPosts()` later).
- Photos / galleries on map pins.
- A skills/interests section in the resume data model (can live as prose in `about.mdx`).
- An admin UI or CMS.

## Open questions

None at time of writing. If gaps appear during implementation, update this spec before changing code.
