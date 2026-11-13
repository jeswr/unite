# Narrated walkthrough video

Records Unite's walkthrough video from the running app: a Markdown script ([narration.md](narration.md)) is voiced paragraph by paragraph while Playwright drives the real Unite, and the screen and the voice are muxed into one MP4 with captions and chapters. The pipeline is adapted from Concord's walkthrough (see [NOTICE.md](NOTICE.md)).

## Commands

Run from `redesign/`:

```sh
pnpm walkthrough --draft                        # silent voice, pending scenes shown as cards; for pacing and visuals
pnpm walkthrough --draft --strict               # the same, but any pending action, UI drift or page error fails
pnpm walkthrough --draft --only intro,pledge    # some scenes only (scene ids from narration.md, comma-separated)
pnpm walkthrough --publish --voice elevenlabs   # a release video; needs ELEVENLABS_API_KEY
pnpm walkthrough --list-actions                 # every action, with the pending ones marked
```

Other flags: `--voice silent|say|elevenlabs` (without `--draft` or `--publish`), `--voice-id`, `--model`, `--rate 0.95`, `--voice-budget <chars>`, `--out <dir>`, `--headed`, `--burn-captions` or `--soft-captions`. With no voice the captions are drawn on a bar under the picture (and kept as a soft track); with a voice they are a soft track only, unless you pass `--burn-captions`.

`--publish` is strict, uses ElevenLabs, and refuses to start without `ELEVENLABS_API_KEY` in the environment (it never asks for it), when a pending action is in the scenes it would record, when the narration not yet in the voice cache would pass the character budget, or when the ElevenLabs account hasn't that many characters left plus 10%. Nothing is sent before those checks pass. After recording it refuses to call the result publishable if there was any warning or blocked request.

Each run boots its own Unite (`lib/servers.ts`): the production server from `apps/server` (building the web app first if there is no build), on a free port, with `UNITE_DATA_DIR=memory`, `UNITE_DEMO=1`, `UNITE_NOW=2026-11-13T09:00:00Z` and no AI key, so the example assemblies are seeded fresh, dates never drift, and the interviewer asks its fixed questions (the `ai` feature is off). It waits for `/healthz` and stops the server afterwards. The browser's clock is set to the same moment.

Output lands in `walkthrough/out/` (git-ignored):

| File | What |
| --- | --- |
| `unite-walkthrough.mp4` | 1920×1080, 30 fps H.264 (CRF 18), AAC narration (loudness-normalised), soft English captions, a chapter per scene |
| `unite-walkthrough.vtt` | The captions |
| `unite-walkthrough.transcript.md` | The narration as text, one section per chapter |
| `unite-walkthrough.chapters.txt` | Chapter timestamps in YouTube's description format |
| `unite-walkthrough.report.json` | Voice, scenes, pending actions, blocked requests, caption timing, frame latency, tool versions, warnings |

Needs Node 22, pnpm, ffmpeg and Playwright's Chromium.

## The script

```md
## The question, and the pledge {#pledge}

[do: open-earning]
Here's an example. The town, the council and the people in it are invented…
```

- `## Title {#id}` starts a scene and a chapter. Each paragraph is one narration clip.
- `[do: action]` above a paragraph runs as it starts, while it is spoken; `[then: action]` runs after it is spoken; `[pause: 1.5]` holds in silence.
- `[if: ai]` / `[if: !ai]` keeps a paragraph only when the AI interviewer is on (or off). The recorder runs with it off.
- `{@action}` just before a word runs the action when the voice reaches that word. Marks are never spoken or captioned.
- `{minutes}` becomes the estimated length of the whole video, in words.
- The next paragraph starts once both the narration and the actions have finished, so rewording a sentence re-times the video around it.
- Words the voice might say wrongly go in [lexicon.json](lexicon.json); captions keep the written spelling.

## Actions

What happens on screen is in [scenes.ts](scenes.ts), one named action for every `[do:]` and `[then:]` in the script (a test checks the two match). Actions use the `Director` helpers (`goto`, `click`, `type`, `pointAt`, `highlight`, `ring`, `chapter`, `scroll`, `pause`, `label`) and find elements by role and text, never by position. Every claim the narration makes is checked with `d.claim` or `d.claimVisible`; a claim that isn't on screen is a warning, which fails `--strict` and `--publish`. Console errors, failed requests and HTTP errors in the browser are warnings too.

Actions whose pages aren't built yet are listed in `PENDING_ACTIONS`. In a draft each shows a plain card with its name, so the timing of the whole script can be judged; in `--strict` or `--publish` they fail before the app starts. To finish one, move it from `PENDING_ACTIONS` into `implemented`.

## Voices

| `--voice` | Service | Notes |
| --- | --- | --- |
| `elevenlabs` | ElevenLabs `eleven_multilingual_v2`, voice "George" (`JBFqnCBsd6RMkjVDRZzb`) | Settings: stability 0.5, similarity boost 0.75, style 0.15, speaker boost on, seed 4242. Uses each paragraph's neighbours so clips flow, and the character timestamps time the captions and `{@}` marks. `mp3_44100_128` by default; set `ELEVENLABS_OUTPUT_FORMAT=mp3_44100_192` on Creator or above. Key: `ELEVENLABS_API_KEY`, never written to disk or output. |
| `say` | macOS `say` | Quick local drafts only. |
| `silent` | none | Silence sized to the words (about 155 words a minute), with captions. `--draft` uses it. |

Voiced clips are cached in `walkthrough/.cache/voice/` (git-ignored) by their exact words and the voice settings, so after an edit only changed paragraphs are sent. A paid voice may send at most `VOICE_CHAR_BUDGET` characters per run (or `--voice-budget`; default 2,500, 0 means no limit), counting every retry.

## The recording browser

Chromium runs behind a local allowlisting proxy ([lib/egress.ts](lib/egress.ts)) that lets it reach only the Unite being recorded; anything else is refused and listed in `report.json`, and fails `--strict`. WebRTC is switched off. The pointer, highlight rings and chapter cards are drawn by [stage/overlay.js](stage/overlay.js), injected into every page.
