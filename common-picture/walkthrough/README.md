# Walkthrough video

Records a narrated walkthrough of the demonstration from the built site: a Markdown script ([narration.md](narration.md)) is spoken (or, in a draft, captioned) paragraph by paragraph while Playwright drives the pages, and the screen, voice and captions are muxed into one MP4 with chapters. The pipeline is adapted from the Unite and Concord walkthroughs (see [NOTICE.md](NOTICE.md)).

## Commands

Run from `common-picture/`, after `pnpm build`:

```sh
pnpm walkthrough --draft                       # silent voice, captions on a bar under the picture
pnpm walkthrough:strict                        # the same, but any warning or outside request fails
pnpm walkthrough --draft --only picture,room   # some scenes only (ids from narration.md)
pnpm walkthrough --list-actions
```

Other flags: `--voice silent|say|elevenlabs` (not with `--draft`), `--publish` (strict, ElevenLabs, needs `ELEVENLABS_API_KEY` in the environment), `--voice-budget <chars>`, `--out <dir>`, `--headed`, `--burn-captions` or `--soft-captions`.

Each run serves `dist/` itself (`lib/server.ts`, a static server with an SPA fallback) on a free loopback port. The browser is 1280×720 at 1.5× (a 1920×1080 picture), recorded at 30 fps; its clock is set to 13 November 2026, the site's fixed "today". `/api/feedback` is answered with 200 in the browser, so nothing is sent anywhere. Any request off the local server is refused and listed in the report.

Needs Node 22.18 or later (the recorder runs as TypeScript with `--experimental-transform-types`), ffmpeg, and Playwright with its Chromium available to `require('playwright')`. It is not a dependency of the site.

## Output

In `walkthrough/out/` (git-ignored): `common-picture-walkthrough.mp4`, `.vtt` (captions), `.chapters.txt` (YouTube format), `.transcript.md` and `.report.json` (scenes, timings, frame latency, outside requests, warnings).

## The script

- `## Title {#id}` starts a scene and a chapter. Each paragraph is one narration clip and one caption block.
- `[do: action]` above a paragraph runs as it starts; `[then: action]` after it; `[pause: 1.5]` holds in silence.
- `[do: chapter /path]` on its own line shows the chapter card and opens `/path` behind it.
- The next paragraph starts once both the narration and the actions have finished.

Actions are in [scenes.ts](scenes.ts). They find elements by role and text, scroll to them smoothly, move the pointer there and ring them. Every claim a paragraph makes about the screen is checked with `d.claim` or `d.claimVisible`; a claim that isn't on screen is a warning, which fails `--strict`.
