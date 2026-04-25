# senou.vercel.app

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

## Environment variables

- `NEXT_PUBLIC_SITE_URL` — canonical site URL (used for OG / sitemap / robots).
  Required at build time when not deployed on Vercel.
- `SITE_PASSWORD` — optional shared password that gates the `/blog` tree
  (index and every post, including OG images). The rest of the site stays
  public. When set, blog requests redirect to `/unlock` until the visitor
  enters the password; a long-lived `site_unlock` cookie keeps them in until
  the browser clears it. Leave unset locally to skip the gate.

## Repo layout

- `app/` — App Router pages (home, blog, map)
- `components/` — React components, grouped by feature (`blog/`, `layout/`, `map/`, `mdx/`, `nav/`, `resume/`)
- `content/` — MDX posts, the about page, resume data, and `map.yaml`
- `lib/` — utilities (clustering, formatting, projections, etc.)
- `docs/superpowers/` — design specs and implementation plans for past work

## Further reading

- [`DESIGN.md`](./DESIGN.md) — visual philosophy and aesthetic principles
- [`CLAUDE.md`](./CLAUDE.md) — context for AI coding agents working in this repo
