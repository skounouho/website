---
date: 2026-04-19
status: implemented
---

# CI — Lint, Typecheck, Test, Build on PRs to `main`

## Context

The repo has `lint`, `test`, and `build` scripts in `package.json` but no CI. PRs can merge to `main` without any automated check. This spec adds a GitHub Actions workflow that runs on every PR targeting `main` (and on pushes to `main` post-merge), plus two lightweight layers of automated review:

1. **Vercel Agent** for AI review comments on PRs (enabled out-of-band in the Vercel dashboard, no workflow changes).
2. **`eslint --fix` auto-commit** as a deterministic pre-validation step inside the workflow.

Branch protection rules (which would actually *block* merges on red CI) are out of scope for this spec — they require repo admin settings that are easier to configure after the workflow is landed and proven green.

## Goals

- Every PR to `main` runs lint, typecheck, tests, and a production build.
- Trivially-fixable lint issues are auto-corrected on the PR branch instead of becoming review friction.
- Vercel Agent is turned on so every PR gets an AI review pass.
- Main branch itself stays green post-merge (same checks run on `push` to `main`).
- CI minutes are not wasted on superseded runs of the same PR.

## Non-goals

- Branch protection rules / required status checks (separate follow-up).
- Coverage reporting, bundle size budgets, or Lighthouse checks.
- Deploy preview orchestration — the Vercel GitHub integration handles this already.
- AI-driven *auto-fix* (a bot writing code commits). We're only doing AI *review* + deterministic lint auto-fix for now.
- Multi-version Node matrix. Single version matches the Vercel runtime and is sufficient for a personal site.

## Track 1 — Vercel Agent (review)

Vercel Agent is enabled in the Vercel project dashboard (Integrations → Agent, or whichever path is current when the spec is executed). Once on, it posts AI review comments on every PR without workflow plumbing.

This track requires no file changes in the repo. The implementation plan should include a step reminding the owner to flip the toggle and linking the spec entry so it isn't forgotten.

## Track 2 — GitHub Actions workflow

### File

Single workflow at `.github/workflows/ci.yml`. One job, one OS, one Node version.

### Triggers

```yaml
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
```

`push` on `main` keeps the branch itself green after merge and warms the npm cache for subsequent PR runs.

### Concurrency

```yaml
concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

Grouping by `github.ref` means rapid pushes to the same PR cancel the prior run. `push`-to-`main` runs get their own group because the ref is different.

### Permissions

```yaml
permissions:
  contents: write   # for the eslint --fix auto-commit step
  pull-requests: read
```

### Runtime

- `runs-on: ubuntu-latest`
- Node 24 LTS via `actions/setup-node@v4` with `cache: 'npm'` and `node-version: '24'`

### Step sequence

| # | Step | When |
| - | ---- | ---- |
| 1 | `actions/checkout@v4` with `ref: ${{ github.head_ref \|\| github.ref }}` — resolves to the PR branch on `pull_request` events (so auto-fix commits land on the PR branch, not on a detached merge commit) and to `main` on `push` | always |
| 2 | `actions/setup-node@v4` (Node 24, npm cache) | always |
| 3 | `npm ci` | always |
| 4 | `npx eslint . --fix` | PR events only, not from forks, not when actor is the auto-fix bot |
| 5 | Commit via `stefanzweifel/git-auto-commit-action@v5` with message `chore: apply eslint --fix [skip ci]` | PR events only, only if step 4 produced changes |
| 6 | `npm run lint` | always |
| 7 | `npm run typecheck` (new script — see below) | always |
| 8 | `npm run test` | always |
| 9 | `npm run build` | always |

Steps 6–9 run against whatever code is in the working tree *after* the auto-fix commit, so CI always validates the final state of the PR.

### Conditional expressions

Auto-fix and commit steps use a single reusable `if`:

```yaml
if: >-
  github.event_name == 'pull_request' &&
  github.event.pull_request.head.repo.full_name == github.repository &&
  github.actor != 'github-actions[bot]'
```

- `event_name == 'pull_request'` — skip on pushes to `main`.
- `head.repo.full_name == github.repository` — skip on forks; we can't push to a forked PR branch, and the validation steps still run.
- `actor != 'github-actions[bot]'` — belt-and-braces loop prevention.
- The `[skip ci]` trailer in the commit message (step 5) is the primary loop-prevention mechanism — GitHub natively skips workflow runs triggered by commits containing `[skip ci]`.

### package.json change

Add one script:

```json
"typecheck": "tsc --noEmit"
```

This keeps the same command available locally and in CI, and avoids inlining `tsc --noEmit` inside the workflow YAML.

## Risks & caveats

- **Loop prevention is two-layered.** The auto-fix commit message includes `[skip ci]`, which GitHub natively recognises and skips — this is the primary guard. The `GITHUB_TOKEN` also does not retrigger workflows by default, serving as a secondary safeguard. Together they make a retriggering loop effectively impossible without any commit-message inspection in the `if:` expression.
- **Auto-fix creates a commit in the PR history.** Acceptable — it's a single well-labeled `chore:` commit and authors can squash on merge.
- **Forks get no auto-fix.** Acceptable — we don't expect external contributors on a personal site, and validation still runs.
- **Vercel Agent is public beta.** Behaviour may change or it may post noisy comments. If it does, it can be disabled from the dashboard without any repo change.
- **`next build` may require env vars in the future.** The site is currently fully static with no runtime config, so `npm run build` succeeds with an empty environment. If env-dependent features are added later (e.g. a `NEXT_PUBLIC_*` flag or a backend integration), the workflow will need those wired in — most likely via `vercel env pull` in CI or GitHub Actions secrets. Flag at that time; not a concern for this spec.

## Verification

After the workflow lands:

1. Open a throwaway PR that introduces a trivially-fixable lint issue (e.g. stray semicolon, unused import). Confirm:
   - Auto-fix commit appears on the PR branch with the expected message.
   - All subsequent CI steps pass.
2. Open a PR that introduces a type error. Confirm:
   - `typecheck` fails and blocks the green checkmark.
3. Open a PR from a fork (simulate by pushing from another account if available, otherwise skip). Confirm:
   - Auto-fix step is skipped, validation still runs.
4. Merge a PR to `main`. Confirm:
   - The `push`-on-`main` run executes and is green.
5. Vercel Agent posts a review comment on the throwaway PR (confirms Track 1 is live).

Tests in the existing vitest suite (52 passing at time of writing) continue to pass — the workflow simply wraps them.

## Open questions

None blocking. Branch protection setup is a natural follow-up once we've seen one or two green runs.
