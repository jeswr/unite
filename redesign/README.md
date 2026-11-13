# Unite (redesign)

A place where people say, in a private conversation, what a good ordinary life looks like for them,
see an honest picture of what everyone said, work through the disagreements together, decide by a
rule agreed in advance, and then watch what was decided get built or get a public reason why not.

The design is in `docs/DESIGN.md`; the build contract is in `docs/BUILD-SPEC.md`.

## Run it

Needs Node 22 and pnpm.

```sh
pnpm install
pnpm dev          # server on http://localhost:4310, web app on http://localhost:4311 (with /api proxied)
```

In development the server seeds the example assemblies into an empty store (`UNITE_DEMO=1`) and
keeps its data in `redesign/.data`. Delete that folder to start again, or run with
`UNITE_DATA_DIR=memory`.

| Command | What it does |
|---|---|
| `pnpm dev` | Server and web app with reload |
| `pnpm build` | Typechecks the packages and builds the web app into `apps/web/dist` |
| `pnpm start` | One process serving the built web app and the API (production) |
| `pnpm test` | Unit and API tests (shared, server, web) |
| `pnpm typecheck` | TypeScript in every package |
| `pnpm lint` | ESLint, no warnings allowed |
| `pnpm seed` | Writes the examples into the configured store (safe to run twice) |
| `pnpm e2e` | Builds, starts the app on a memory store in demo mode, and runs Playwright; screenshots go to `e2e/shots/` |

## Environment

All optional; see `.env.example`.

| Variable | Default | Meaning |
|---|---|---|
| `ANTHROPIC_API_KEY` | unset | Enables the Claude interviewer and synthesis. Unset means scripted mode |
| `UNITE_MODEL` | `claude-opus-5-5` | Model for every AI call |
| `UNITE_AI_DAILY_USD` / `UNITE_AI_MONTHLY_USD` | `5` / `40` | Spending caps. Over the cap means scripted mode |
| `DATABASE_URL` | unset | Postgres. Unset means PGlite at `UNITE_DATA_DIR` (default `redesign/.data`), or in memory when `UNITE_DATA_DIR=memory` |
| `UNITE_SECRET` | dev value | Signs the session cookie. Required in production |
| `UNITE_HOST_CODE` / `UNITE_STEWARD_CODE` | `host` / `steward` in dev; required in production | Passcodes for the host and steward consoles |
| `UNITE_DEMO` | `1` in dev | Seeds the examples on an empty store and shows the role switcher |
| `UNITE_NOW` | unset | Fixed clock (ISO date-time) for tests and the video |
| `PORT` | `4310` | Server port |

Production is `NODE_ENV=production`, which refuses to start without `UNITE_SECRET` and the two passcodes.

## Folders

| Folder | What it is |
|---|---|
| `packages/shared` | Zod schemas (the single source of types), collection names, ids, the clock, the stage tables and rules, and every pure function: counting people, opinion groups, support, the decision rule, what is still needed, proportional ranking, interviewer checks, word overlap, the register summary, the stage checklist. No I/O |
| `apps/server` | Express API. `app.ts` builds the app from injected `{ store, clock, ai, config }`; `store/` is the document store (PGlite or Postgres, one SQL dialect); `auth.ts` sessions, roles and rule 1; `ai/` the AI client and the published prompts; `routes/` one router per area; `services/` the logic behind them; `seed/` the example data |
| `apps/web` | React app. `ui/` shared pieces, `lib/` the API client, live polling and speech, `pages/<area>/` one file per route, `routes.tsx` the route table |
| `e2e` | Playwright tests against the built app |
| `docs` | Design and build specification |
| `RELEASES.json` | What changed in each release, read by the feedback pages |
| `vercel.json`, `api/`, `apps/server/src/vercel.ts` | A Vercel entry, kept ready but not deployed |
