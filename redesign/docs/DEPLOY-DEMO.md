# Deploying the demo to Vercel

A public demonstration with no database: each Vercel instance opens PGlite in memory and seeds the
example assemblies when it starts. Anything a visitor adds lasts only as long as that instance and is
not seen by other instances. Every page shows a banner saying so, and the role switcher lets a visitor
view Unite as a participant, a host or a steward.

Sent feedback is the one thing kept: with a Vercel Blob store connected, each sent record (and each
later change to it) is also written as `unite-feedback/<ISO time>-<id>.json`, without the private link
token.

## Environment

Set these for the Production environment (and Preview, if you use preview deploys).

| Variable | Value | Why |
|---|---|---|
| `UNITE_DEMO` | `1` | Runs without `DATABASE_URL` on a seeded in-memory store, shows the banner and the role switcher |
| `UNITE_SECRET` | a long random string, for example `openssl rand -base64 32` | Signs the session and role cookies. Required in production |
| `BLOB_READ_WRITE_TOKEN` | added for you when a Blob store is connected | Keeps a copy of sent feedback. The store must be **private**. Unset: feedback lives only in memory |
| `VITE_OVERVIEW_URL` | optional; default `https://unite-overview.vercel.app/#unite` | Where "Watch the walkthrough" in the banner goes. Read at build time, so redeploy after changing it |

Leave these unset:

- `DATABASE_URL`: unset is what makes it a demo.
- `UNITE_HOST_CODE` and `UNITE_STEWARD_CODE`: in demo mode they default to `host` and `steward`, the
  passcodes the role switcher sends. If you set them to anything else the switcher stops working.
- `NODE_ENV`: Vercel sets `production` for the function. Setting it yourself would also apply to
  the install step, where it skips the dev dependencies the build needs.
- `ANTHROPIC_API_KEY`: unset means scripted mode (fixed questions, no AI cost). The spending caps are
  kept in the store, so on an in-memory store each instance has caps of its own. Leave it unset for a
  public demo.

## Commands

Run from `redesign/` with the Vercel CLI, signed in.

```sh
vercel link --yes --project unite-assemblies --scope jesse-wrights-projects-776f60ef

printf '1' | vercel env add UNITE_DEMO production
openssl rand -base64 32 | tr -d '\n' | vercel env add UNITE_SECRET production
# Optional: printf 'https://…' | vercel env add VITE_OVERVIEW_URL production

vercel deploy --prod --yes
```

For the feedback copies, create a Blob store with **private** access in the project's Storage tab on
vercel.com and connect it to the project for Production. That adds `BLOB_READ_WRITE_TOKEN`; deploy
again afterwards. To read the copies: Storage, the store, then the `unite-feedback/` folder.

Check the deployment: `/healthz` answers `{"ok":true}`, and the home page shows the demonstration banner
and "Demo. View as:".

## What to expect

- The first request on a new instance takes a few seconds while the TypeScript is loaded and the
  examples are seeded (about 3.5 s locally); it answers "Unite is starting up" only if starting fails.
- Additions disappear when Vercel recycles the instance, and two visitors on different instances can
  see different data. That is what the banner tells them.
- The function uses about 500 MB of memory once seeded.

## Moving to Postgres later

1. Add a Neon database from the Vercel Marketplace (Storage tab) and connect it to the project. That
   sets `DATABASE_URL`. Unite creates its table on first start.
2. Choose:
   - **Keep it a demo, but lasting**: keep `UNITE_DEMO=1`. The examples are seeded once into the empty
     database and additions now persist and are shared between instances.
   - **Run it for real**: remove `UNITE_DEMO` (`vercel env rm UNITE_DEMO production`) and set
     `UNITE_HOST_CODE` and `UNITE_STEWARD_CODE` to private passcodes. The banner and role switcher go,
     no examples are seeded, and production refuses to start without the passcodes.
3. `vercel deploy --prod --yes`.

The Blob copies of feedback can stay on or be removed; the database keeps every record either way.

## How the function is packaged

`api/index.mjs` loads `apps/server/vercel-entry.mjs`, which registers tsx and loads the TypeScript at
run time. Vercel finds the files a function needs by tracing imports, and it cannot read TypeScript,
so `vercel-entry.mjs` (and `packages/shared/vercel-trace.mjs`) name every package the code imports in
a branch that never runs. `vercel.json`'s `includeFiles` adds the TypeScript sources, `RELEASES.json`
and PGlite's files. The tracer keeps pnpm's symlinks, so the default pnpm layout works and no
`node-linker` change is needed. `apps/server/test/vercel.test.ts` fails if an import is added
without naming it there.
