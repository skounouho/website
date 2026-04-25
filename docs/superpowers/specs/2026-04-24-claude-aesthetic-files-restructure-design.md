# Restructure Claude / aesthetic / human-facing root docs

**Date:** 2026-04-24
**Status:** Design

## Context

Four root-level files shape what gets built in this repo and how it's perceived:

- `CLAUDE.md` — Claude entrypoint; currently three lines that `@`-import `AGENTS.md` and `design-aesthetic.md`.
- `AGENTS.md` — five lines, holds the single Next.js "read the bundled docs" rule, wrapped in `<!-- BEGIN:nextjs-agent-rules --> ... <!-- END:nextjs-agent-rules -->` markers.
- `design-aesthetic.md` — ~5.6 KB design philosophy at repo root; pulled into Claude context via `CLAUDE.md`.
- `README.md` — still untouched `create-next-app` boilerplate; says nothing about the actual project.

Three asymmetries motivate this work:

1. **Inconsistent agent reach.** The design philosophy is imported from `CLAUDE.md`, not `AGENTS.md`. Any non-Claude agent (Codex, Cursor, Copilot CLI) reads `AGENTS.md` and misses the design rules — yet design rules arguably matter more for what an agent will produce than the Next.js rule does.
2. **Public face is empty.** Humans landing on the GitHub repo learn nothing from the README; AI agents get rich context. The asymmetry is backwards.
3. **No single source of truth for agent rules.** Two files (`CLAUDE.md`, `AGENTS.md`) carry overlapping responsibilities.

## Decisions

- **`CLAUDE.md` is canonical.** All agent rules live in or are imported by `CLAUDE.md`. `AGENTS.md` is deleted. (Cross-tool convention favors `AGENTS.md`; user explicitly chose `CLAUDE.md` instead — see memory.)
- **`DESIGN.md` stays at repo root.** Renamed from `design-aesthetic.md` to `DESIGN.md`. Dual-purpose: load-bearing for Claude *and* a human-readable design statement at the top of GitHub. Root prominence matches its load-bearing role; moving to `docs/` would bury it.
- **Scope = structure + README rewrite.** Mobile TBD in `DESIGN.md` and any code reorganization are explicitly out of scope.

## Next.js codemod consideration

`AGENTS.md` is regenerable via `npx @next/codemod@latest agents-md` or by running `create-next-app` against an existing project — but **not** by `npm install` or build. Deletion is safe; if the codemod ever recreates `AGENTS.md`, we re-do this consolidation manually. The BEGIN/END markers in the current `AGENTS.md` only protect the Next.js-managed block from overwrite *inside `AGENTS.md`*; they have no function once the rule moves into `CLAUDE.md`, so we drop them.

## Target file structure

| Path | State | Purpose |
|---|---|---|
| `CLAUDE.md` | edited | Canonical agent rules: Next.js doc-reading rule inlined + `@DESIGN.md` import |
| `DESIGN.md` | renamed from `design-aesthetic.md`, content unchanged | Design philosophy (dual-purpose: agent context + human reference) |
| `README.md` | rewritten | Real project description for human visitors |
| `AGENTS.md` | deleted | Content folded into `CLAUDE.md` |

Untouched: `docs/superpowers/{specs,plans}/`, all code dirs, `.gitignore`, the historical specs that reference `design-aesthetic.md` (those are records of past decisions).

## New `CLAUDE.md`

```md
# CLAUDE.md

This is NOT the Next.js you know. APIs, conventions, and file structure may all
differ from your training data. Before any Next.js work, find and read the
relevant guide in `node_modules/next/dist/docs/`. Heed deprecation notices.

## Design philosophy

@DESIGN.md
```

Two short sections, ~6 lines. Wording for the Next.js rule stays close to the existing `AGENTS.md` content; markers dropped.

## New `README.md`

Five short sections in this order:

1. **One-line intro** — what the site is (Senou Kounouho's personal site: blog, resume, map of places).
2. **Stack** — Next.js (canary, with version-bundled docs), MDX content, Tailwind, Vitest.
3. **Local development** — `npm install`, `npm run dev`, `npm run build`, `npm test`, `npm run lint`.
4. **Repo layout** — brief pointers to `app/`, `content/`, `components/`, `lib/`.
5. **Further reading** — pointer to `DESIGN.md` (visual philosophy) and `CLAUDE.md` (agent context).

Dropped from current README: `create-next-app` boilerplate, Vercel deploy plug, Geist font line, "Learn more" links.

## Migration steps

1. Rewrite `CLAUDE.md` with the version above (Next.js rule inlined; `@DESIGN.md` import).
2. `git mv design-aesthetic.md DESIGN.md`.
3. Delete `AGENTS.md`.
4. Rewrite `README.md`.
5. Verify: `git diff` shows only the intended changes; `CLAUDE.md` resolves `@DESIGN.md` cleanly; no other tracked file references `design-aesthetic.md` aside from the historical specs (intentionally untouched).

## Out of scope

- Filling in the "Mobile behavior has not yet been defined" line in `DESIGN.md` — deserves a dedicated brainstorming session.
- `docs/superpowers/` historical specs/plans — left as records.
- Any code or content directory reorganization.
