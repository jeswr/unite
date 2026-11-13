/**
 * Records the Common Picture walkthrough from narration.md, driving the built site.
 *
 *   pnpm walkthrough --draft                      silent voice, captions on a bar under the picture
 *   pnpm walkthrough --draft --strict             the same, but any warning or outside request fails
 *   pnpm walkthrough --draft --only picture,room  some scenes only
 *   pnpm walkthrough --list-actions
 *
 * Output goes to walkthrough/out/: common-picture-walkthrough.mp4 (1920×1080, 30 fps, soft
 * captions, a chapter per scene), .vtt, .transcript.md, .chapters.txt and .report.json.
 */
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { guardContext, launchBrowser } from './lib/browser.ts';
import { Capture } from './lib/capture.ts';
import { Director, sleep } from './lib/director.ts';
import { mux, type Placed } from './lib/mux.ts';
import { cuesFor, fillMinutes, parseNarration, plain, selectScenes, speechMap, wordTime, type Action, type Scene } from './lib/narration.ts';
import { parseOptions } from './lib/options.ts';
import { serveDist, type Site } from './lib/server.ts';
import { Voice } from './lib/tts.ts';
import { actions, unknownActions, type ActionName, type Ctx } from './scenes.ts';

const HERE = import.meta.dirname;
const DIST = path.resolve(HERE, '..', 'dist');
const NAME = 'common-picture-walkthrough';
const TITLE = 'The Common Picture: a walkthrough of the demonstration';
/** The demonstration's fixed "today" (src/data/content.ts); the browser's clock is set to it. */
const EPOCH = '2026-11-13T09:00:00Z';
/** Narration starts this long after its step's actions, and steps are this far apart (seconds). */
const LEAD = 0.35;
const GAP = 0.35;
/** How late a timed mark may run before the recording counts it as out of sync. */
const MAX_LATE = 0.75;

const log = (s: string) => console.log(s);
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

async function main() {
  const opts = parseOptions(process.argv.slice(2));
  if (opts.help) {
    console.log(readFileSync(path.join(HERE, 'README.md'), 'utf8'));
    return;
  }
  if (opts.listActions) {
    console.log(Object.keys(actions).sort().join('\n'));
    return;
  }
  const out = path.resolve(opts.out ?? path.join(HERE, 'out'));
  const outFile = (suffix: string) => path.join(out, `${NAME}${suffix}`);

  const narration = parseNarration(await readFile(path.join(HERE, 'narration.md'), 'utf8'));
  const lexicon = Object.fromEntries(Object.entries(JSON.parse(await readFile(path.join(HERE, 'lexicon.json'), 'utf8')) as Record<string, string>).filter(([k]) => !k.startsWith('_')));

  // Every action named in the script must exist, before anything is spent on voices.
  const unknown = unknownActions(narration);
  if (unknown.length) throw new Error(`narration.md uses actions that scenes.ts doesn't define:\n  ${unknown.join('\n  ')}`);
  const missingIds = (opts.only ?? []).filter((id) => !narration.scenes.some((s) => s.id === id));
  if (missingIds.length) throw new Error(`No scene called ${missingIds.join(', ')}. Scenes: ${narration.scenes.map((s) => s.id).join(', ')}`);

  const features = new Set<string>();
  const { kept, skipped } = selectScenes(narration, features, opts.only);
  if (!kept.length) throw new Error('No scenes to record');
  const promisesLength = kept.some((s) => s.steps.some((st) => st.text.includes('{minutes}')));
  const promisedMinutes = fillMinutes(selectScenes(narration, features).kept);

  // Voice every paragraph (cached), with its neighbours for natural flow, under the budget.
  const voice = new Voice({ provider: opts.provider, voice: opts.voiceId, model: opts.model, rate: opts.rate }, path.join(HERE, '.cache', 'voice'));
  voice.budget = opts.budget;
  log(`Voice: ${voice.label}`);
  const spoken = kept.flatMap((s) => s.steps).filter((st) => st.text);
  const say = (text: string) => speechMap(text, lexicon).speech;
  const reqs = spoken.map((st, i) => ({ text: say(st.text), previous: spoken[i - 1] && say(spoken[i - 1].text), next: spoken[i + 1] && say(spoken[i + 1].text) }));
  const cost = voice.checkBudget(reqs);
  const quota = await voice.checkQuota(cost);
  if (quota) log(`ElevenLabs usage: ${quota.used.toLocaleString('en')} of ${quota.limit.toLocaleString('en')} characters this period`);
  log(`Voicing ${spoken.length} paragraphs${voice.paid ? ` (${cost.toLocaleString('en')} new characters)` : ''}…`);
  const clips = new Map<object, { file: string; duration: number; charStarts?: number[] }>();
  await pool(spoken, 3, async (st, i) => {
    clips.set(st, await voice.synth(reqs[i]));
  });
  const words = spoken.reduce((n, st) => n + plain(st.text).split(/\s+/).filter(Boolean).length, 0);
  log(`  ${words} words, ${fmt([...clips.values()].reduce((a, c) => a + c.duration, 0))} of speech`);

  await mkdir(out, { recursive: true });
  let site: Site | undefined;
  try {
    log(`Serving ${path.relative(process.cwd(), DIST) || DIST}…`);
    site = await serveDist(DIST);
    const url = site.url;

    const outside = new Set<string>();
    const browser = await launchBrowser({ headless: !opts.headed, args: ['--force-color-profile=srgb', '--font-render-hinting=none', '--hide-scrollbars'] });
    const chromiumVersion = browser.version();
    // 1280×720 at 1.5× is a 1920×1080 picture with text at a readable size.
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5, colorScheme: 'light', reducedMotion: 'no-preference', locale: 'en-GB', timezoneId: 'Europe/London' });
    await guardContext(context, url, outside);
    await context.addInitScript({ path: path.join(HERE, 'stage', 'overlay.js') });
    await context.clock.setSystemTime(new Date(EPOCH));
    // The stage pages (a blank opening frame) are answered here, never by the site.
    await context.route(`${url}/__stage/**`, async (route) => {
      const name = path.basename(new URL(route.request().url()).pathname);
      const file = path.join(HERE, 'stage', name);
      if (!existsSync(file)) return route.fulfill({ status: 404, body: 'Not found' });
      return route.fulfill({ status: 200, contentType: name.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8', body: await readFile(file) });
    });
    // The feedback function isn't part of the static build: answer it as a working one would.
    const feedback: unknown[] = [];
    await context.route(`${url}/api/feedback`, async (route) => {
      feedback.push(JSON.parse(route.request().postData() || 'null'));
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    const page = await context.newPage();

    // Warm up: fill caches so nothing loads slowly on camera.
    log('Warming up…');
    for (const p of ['/', '/listen', '/picture', '/days', '/room', '/answers', '/route', '/about', '/feedback']) await page.goto(`${url}${p}`, { waitUntil: 'networkidle' }).catch(() => {});

    const d = new Director(page, opts.strict);
    const ctx: Ctx = { d, url, strict: opts.strict, chapterCount: kept.length };
    const run = async (scene: Scene, list: Action[]) => {
      for (const a of list) {
        try {
          await actions[a.name as ActionName](ctx, a.args);
        } catch (e) {
          if (opts.strict) throw new Error(`${scene.id} / ${a.name}: ${(e as Error).message}`, { cause: e });
          d.warnings.push(`${scene.id} / ${a.name}: ${(e as Error).message.split('\n')[0]}`);
          console.warn(`  ! ${scene.id} / ${a.name} failed: ${(e as Error).message.split('\n')[0]}`);
        }
      }
    };

    // Record: each paragraph starts its actions and its narration together, and the next
    // paragraph waits for both. The narration is laid on afterwards at the same times.
    await page.goto(`${url}/__stage/blank.html`);
    const raw = outFile('.raw.mp4');
    const cap = new Capture(page, raw, { fps: 30, width: 1920, height: 1080, quality: 92, crf: 18 });
    await cap.start();
    const placed: Placed[] = [];
    const chapters: { at: number; title: string }[] = [];
    const sync: { scene: string; action: string; word: string; at: number; late: number }[] = [];
    for (const [i, scene] of kept.entries()) {
      log(`▶ ${scene.id}`);
      ctx.scene = scene;
      ctx.chapterNo = i + 1;
      chapters.push({ at: cap.now(), title: scene.title });
      for (const step of scene.steps) {
        cap.check();
        const clip = clips.get(step);
        const start = cap.now();
        if (clip) placed.push({ file: clip.file, at: start + LEAD, duration: clip.duration, text: step.text, cues: cuesFor(step.text, lexicon, clip.duration, clip.charStarts) });
        const speaking = clip ? sleep((LEAD + clip.duration) * 1000) : Promise.resolve();
        const opening = run(scene, step.actions);
        const marked = (async () => {
          await opening;
          for (const m of step.marks) {
            const due = clip ? start + LEAD + wordTime(step.text, lexicon, clip.duration, m.word, clip.charStarts) : cap.now();
            if (due > cap.now()) await sleep((due - cap.now()) * 1000);
            const late = cap.now() - due;
            sync.push({ scene: scene.id, action: m.action.name, word: plain(step.text).split(/\s+/)[m.word], at: Number(due.toFixed(2)), late: Number(late.toFixed(2)) });
            if (late > MAX_LATE) d.warnings.push(`${scene.id} / {@${m.action.name}} ran ${late.toFixed(1)}s after its word`);
            await run(scene, [m.action]);
          }
        })();
        await Promise.all([opening, marked, speaking]);
        await run(scene, step.after);
        await d.pause((GAP + step.pause) * 1000);
      }
    }
    await d.pause(1000);
    await d.checkRing();
    const seconds = await cap.stop();
    if (cap.peakBacklogBytes > 256 * 1024 * 1024) d.warnings.push(`video encoder fell behind (peak backlog ${Math.round(cap.peakBacklogBytes / 1048576)} MB)`);
    if (promisesLength && !opts.only && Math.abs(seconds / 60 - promisedMinutes) > 1.5) d.note(`The intro promises about ${promisedMinutes} minutes, but the video is ${fmt(seconds)}`);
    await browser.close();

    log('Mixing…');
    await mux({ video: raw, videoSeconds: seconds, clips: placed, out: outFile('.mp4'), captions: outFile('.vtt'), chapters, title: TITLE, burn: opts.burnCaptions });
    await rm(raw, { force: true });
    await writeFile(outFile('.chapters.txt'), chaptersText(chapters));
    await writeFile(outFile('.transcript.md'), transcript(kept, chapters));
    const report = {
      recordedAt: new Date().toISOString(),
      mode: opts.mode,
      strict: opts.strict,
      duration: Math.round(seconds),
      words,
      voice: voice.label,
      site: url,
      epoch: EPOCH,
      scenes: kept.map((s) => s.id),
      skipped,
      chapters: chapters.map((c) => ({ at: Number(c.at.toFixed(2)), title: c.title })),
      outsideRequests: [...outside],
      feedbackPosts: feedback.length,
      toolchain: await toolchain(chromiumVersion),
      sync,
      frameLatency: cap.latency(),
      warnings: d.warnings,
      captionTiming: clips.size && [...clips.values()].every((c) => c.charStarts) ? 'voice timestamps' : 'estimated from text length',
    };
    await writeFile(outFile('.report.json'), JSON.stringify(report, null, 2));
    if (opts.mode === 'publish' && (d.warnings.length || outside.size)) throw new Error(`Not publishable: ${d.warnings.length} warning(s), ${outside.size} outside request(s). See report.json.`);
    if (opts.strict && (d.warnings.length || outside.size)) throw new Error(`--strict: ${d.warnings.length} warning(s) and ${outside.size} blocked outside request(s) during the recording. See report.json.`);
    log(`\nDone: ${outFile('.mp4')} (${fmt(seconds)})`);
    if (outside.size) log(`\n⚠ Blocked requests to outside hosts:\n  ${[...outside].join('\n  ')}`);
    if (d.warnings.length) log(`\n${d.warnings.length} warning(s); see report.json.`);
  } finally {
    await site?.stop();
  }
}

export function chaptersText(chapters: { at: number; title: string }[]) {
  return chapters.map((c) => `${fmt(c.at)} ${c.title}`).join('\n') + '\n';
}

export function transcript(scenes: Scene[], chapters: { at: number }[]) {
  const words = (sc: Scene) =>
    sc.steps
      .filter((st) => st.text)
      .map((st) => plain(st.text))
      .join('\n\n');
  return `# ${TITLE}\n\n` + scenes.map((sc, i) => `## ${sc.title} (${fmt(chapters[i].at)})\n\n${words(sc)}`).join('\n\n') + '\n';
}

async function pool<T>(items: T[], n: number, fn: (x: T, i: number) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        await fn(items[i], i);
      }
    }),
  );
}

/** Versions of everything that affects the pixels and the sound, for comparing recordings. */
async function toolchain(chromiumVersion: string) {
  const { execFile } = await import('node:child_process');
  const os = await import('node:os');
  const out = (cmd: string, args: string[]) => new Promise<string>((r) => execFile(cmd, args, (_e, stdout) => r(String(stdout ?? '').split('\n')[0].trim())));
  const distro = existsSync('/etc/os-release') ? (await readFile('/etc/os-release', 'utf8')).match(/^PRETTY_NAME="?([^"\n]*)/m)?.[1] : undefined;
  return { node: process.version, chromium: chromiumVersion, ffmpeg: await out('ffmpeg', ['-version']), os: [distro, `${os.type()} ${os.release()} ${os.arch()}`].filter(Boolean).join(' · ') };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  main().then(
    () => process.exit(process.exitCode ?? 0),
    (e) => {
      console.error(`\n✗ ${(e as Error).stack ?? e}`);
      process.exit(1);
    },
  );
}
