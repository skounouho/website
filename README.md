# skounouho.com

Senou Kounouho's personal website — blog, resume, and a map of places that have meant something.

## Stack

- [Next.js](https://nextjs.org) (canary, with version-bundled docs in `node_modules/next/dist/docs/`)
- React 19, TypeScript, Tailwind 4
- MDX content via `next-mdx-remote`
- Vitest for tests, ESLint for linting

## Local development

```bash
npm install
npm run dev        # start dev server on 0.0.0.0:3000
npm run build      # production build
npm test           # run vitest
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
```

## Repo layout

- `app/` — App Router pages (home, blog, map)
- `components/` — React components, grouped by feature (`blog/`, `layout/`, `map/`, `mdx/`, `nav/`, `resume/`)
- `content/` — MDX posts, the about page, resume data, and `map.yaml`
- `lib/` — utilities (clustering, formatting, projections, etc.)
- `docs/superpowers/` — design specs and implementation plans for past work

## Further reading

- [`DESIGN.md`](./DESIGN.md) — visual philosophy and aesthetic principles
- [`CLAUDE.md`](./CLAUDE.md) — context for AI coding agents working in this repo
