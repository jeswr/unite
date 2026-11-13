# The Common Picture — demonstration

A clickable demonstration of the global shared-vision method described in `GLOBAL-VISION.md`:
listen to people about a real day, draw a picture with five parts at every layer, talk across
languages in a slow room, and ask institutions to answer in public.

**Everything here is invented example data.** No real people, places' views, results,
institutions or assemblies. ‘The Common Picture’ is a working name.

## Run

```sh
pnpm install
pnpm dev            # http://localhost:5173
pnpm build          # tsc --noEmit + vite build -> dist/
pnpm test           # Vitest: seed counts, picture, point extraction, interviewer follow-ups
pnpm test:api       # the feedback function with a fake req/res (503 without token, 200 with mocked Blob put)
pnpm e2e            # Playwright walk of the whole journey on the built site; screenshots to $SHOTS_DIR
```

## Pages

`/` front door · `/listen` the conversation (web chat, phone mock-up) · `/picture` the nested picture ·
`/days` good days from elsewhere · `/room` slow room and Talk it through · `/answers` pledges, register,
check panel · `/route` Rehema's route by phone · `/editions` statement histories · `/about` what this
is and is not · `/feedback` feedback.

## Data

`src/data/seed.ts` builds 162 invented conversations deterministically (30 per place, 12 in the circle).
Every count on the site is computed from those records (`src/data/picture.ts`). The fixed "today" is
13 November 2026 (`src/data/content.ts`).

## Environment

| Variable | Where | Purpose |
| --- | --- | --- |
| `BLOB_READ_WRITE_TOKEN` | Vercel (server) | Lets `api/feedback.mjs` store feedback with `@vercel/blob` at `common-picture-feedback/<ISO>-<random>.json` (private). Without it the function answers 503 and the page offers to copy the text. |
| `VITE_OVERVIEW_URL` | build time | "Watch the walkthrough" link in the footer. Default `https://unite-overview.vercel.app/#common-picture`. |

## Deploy

Vercel project rooted at `common-picture/`. `vercel.json` sets the build, SPA rewrites, and leaves
`/api/*` to the function.
