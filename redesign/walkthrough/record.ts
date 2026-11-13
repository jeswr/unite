/**
 * Records the narrated Unite walkthrough from narration.md, driving the real app.
 *
 *   pnpm walkthrough --draft                         silent voice, pending actions shown as cards, fast
 *   pnpm walkthrough --draft --strict                the same, but any pending action or warning fails
 *   pnpm walkthrough --publish --voice elevenlabs    a release video (needs ELEVENLABS_API_KEY)
 *   pnpm walkthrough --draft --only intro,pledge     some scenes only
 *   pnpm walkthrough --list-actions
 *
 * Output goes to walkthrough/out/: unite-walkthrough.mp4 (1920×1080, 30 fps, soft captions,
 * a chapter per scene), .vtt, .transcript.md, .chapters.txt and .report.json.
 */
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { guardContext, launchBrowser } from './lib/browser.ts';
import { Capture } from './lib/capture.ts';
import { Director, sleep } from './lib/director.ts';
import { startEgressProxy, type Egress } from './lib/egress.ts';
import { mux, type Placed } from './lib/mux.ts';
import { cuesFor, fillMinutes, parseNarration, plain, selectScenes, speechMap, wordTime, type Action, type Scene } from './lib/narration.ts';
import { parseOptions } from './lib/options.ts';
import { EPOCH, startUnite, type Unite } from './lib/servers.ts';
import { Voice } from './lib/tts.ts';
import { actions, isPending, PENDING_ACTIONS, unknownActions, type ActionName, type Ctx } from './scenes.ts';

const HERE = import.meta.dirname;
const NAME = 'unite-walkthrough';
const TITLE = 'Unite walkthrough';
/** Narration starts this long after its step's actions, and steps are this far apart (seconds). */
const LEAD = 0.35;
const GAP = 0.45;
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
    const names = Object.keys(actions).sort();
    console.log(names.map((n) => (isPending(n) ? `${n} (pending)` : n)).join('\n'));
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

  // The recorder starts Unite without an AI key, so the AI interviewer is off (checked after boot).
  const features = new Set<string>();
  const { kept, skipped } = selectScenes(narration, features, opts.only);
  if (!kept.length) throw new Error('No scenes to record');

  // In strict mode a pending action fails the run before anything starts.
  const pendingUsed = kept.flatMap((s) => s.steps.flatMap((st) => [...st.actions, ...st.after, ...st.marks.map((m) => m.action)]).filter((a) => isPending(a.name)).map((a) => `${s.id}: ${a.name}`));
  if (opts.strict && pendingUsed.length) throw new Error(`${pendingUsed.length} pending action(s) in the scenes to record, so --strict${opts.mode === 'publish' ? ' (implied by --publish)' : ''} refuses:\n  ${pendingUsed.join('\n  ')}`);

  const promisesLength = kept.some((s) => s.steps.some((st) => st.text.includes('{minutes}')));
  // The intro promises the length of the whole video, even when only some scenes are recorded
  // (the selected scenes share their steps with the whole script, so this fills them too).
  const promisedMinutes = fillMinutes(selectScenes(narration, features).kept);

  // Voice every paragraph (cached), with its neighbours for natural flow, under the budget.
  const voice = new Voice({ provider: opts.provider, voice: opts.voiceId, model: opts.model, rate: opts.rate }, path.join(HERE, '.cache', 'voice'));
  voice.budget = opts.budget;
  log(`Voice: ${voice.label}`);
  const spoken = kept.flatMap((s) => s.steps).filter((st) => st.text);
  const say = (text: string) => speechMap(text, lexicon).speech;
  const reqs = spoken.map((st, i) => ({ text: say(st.text), previous: spoken[i - 1] && say(spoken[i - 1].text), next: spoken[i + 1] && say(spoken[i + 1].text) }));
  // Refuse up front rather than run out halfway: the run's budget, then the account's quota.
  const cost = voice.checkBudget(reqs);
  const quota = await voice.checkQuota(cost);
  if (quota) log(`ElevenLabs usage: ${quota.used.toLocaleString('en')} of ${quota.limit.toLocaleString('en')} characters this period`);
  else if (cost && voice.paid) log(`ElevenLabs usage: NOT CHECKED, this key isn't allowed to read it; ${voice.budget ? `only the run budget of ${voice.budget.toLocaleString('en')} characters limits this run` : 'this run has no budget either'}`);
  log(`Voicing ${spoken.length} paragraphs${voice.paid ? ` (${cost.toLocaleString('en')} new characters${voice.budget ? ` of a ${voice.budget.toLocaleString('en')} budget` : ''})` : ''}…`);
  const clips = new Map<object, { file: string; duration: number; charStarts?: number[] }>();
  let fresh = 0;
  await pool(spoken, 3, async (st, i) => {
    const c = await voice.synth(reqs[i]);
    if (!c.cached) fresh++;
    clips.set(st, c);
  });
  log(`  ${fresh} new, ${spoken.length - fresh} cached, ${fmt([...clips.values()].reduce((a, c) => a + c.duration, 0))} of speech`);

  await mkdir(out, { recursive: true });
  let unite: Unite | undefined;
  let egress: Egress | undefined;
  try {
    log('Starting Unite…');
    unite = await startUnite({ log });
    const url = unite.url;
    const prompts = (await (await fetch(`${url}/api/how/prompts`)).json()) as { mode?: string };
    if (prompts.mode === 'claude') features.add('ai');
    if (features.has('ai')) throw new Error('The recorded Unite has its AI interviewer on, but the walkthrough records the fixed-question mode. Is ANTHROPIC_API_KEY leaking into the server?');

    // Every connection the browser makes goes through the allowlisting proxy, loopback included.
    const outside = new Set<string>();
    egress = await startEgressProxy([url], outside);
    const browser = await launchBrowser({ proxy: egress.url, headless: !opts.headed, args: ['--force-color-profile=srgb', '--font-render-hinting=none', '--hide-scrollbars'] });
    const chromiumVersion = browser.version();
    // 1280×720 at 1.5× is a 1920×1080 picture with text at a readable size.
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5, colorScheme: 'light', reducedMotion: 'no-preference', locale: 'en-GB', timezoneId: 'Europe/London' });
    // tsx compiles with keepNames, which wraps functions we hand to the page in __name().
    await context.addInitScript('globalThis.__name ??= (f) => f;');
    await guardContext(context);
    await context.addInitScript({ path: path.join(HERE, 'stage', 'overlay.js') });
    // The browser's clock agrees with the server's.
    await context.clock.setSystemTime(new Date(EPOCH));
    // The stage pages (a blank opening frame) are answered here, never by the app.
    await context.route(`${url}/__stage/**`, async (route) => {
      const name = path.basename(new URL(route.request().url()).pathname);
      const file = path.join(HERE, 'stage', name);
      if (!existsSync(file)) return route.fulfill({ status: 404, body: 'Not found' });
      return route.fulfill({ status: 200, contentType: name.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8', body: await readFile(file) });
    });
    const page = await context.newPage();

    // Warm up: fill caches so nothing loads slowly on camera.
    log('Warming up…');
    for (const p of ['/', '/a/earning-and-learning', '/a/earning-and-learning/pledge', '/how']) await page.goto(`${url}${p}`, { waitUntil: 'networkidle' }).catch(() => {});

    const d = new Director(page, opts.strict);
    const ctx: Ctx = { d, url, features, strict: opts.strict, app: { secret: unite.secret, fixtureToken: unite.fixtureToken }, memo: {} };
    const run = async (scene: Scene, list: Action[]) => {
      for (const a of list) {
        try {
          await actions[a.name as ActionName](ctx);
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
    for (const scene of kept) {
      log(`▶ ${scene.id}`);
      ctx.scene = scene;
      chapters.push({ at: cap.now(), title: scene.title });
      for (const step of scene.steps) {
        cap.check();
        const clip = clips.get(step);
        const start = cap.now();
        if (clip) placed.push({ file: clip.file, at: start + LEAD, duration: clip.duration, text: step.text, cues: cuesFor(step.text, lexicon, clip.duration, clip.charStarts) });
        // Waits for the narration to be spoken.
        const speaking = clip ? sleep((LEAD + clip.duration) * 1000) : Promise.resolve();
        const opening = run(scene, step.actions);
        // Timed marks wait for the step's opening actions, then for their word.
        const marked = (async () => {
          await opening;
          for (const m of step.marks) {
            const due = clip ? start + LEAD + wordTime(step.text, lexicon, clip.duration, m.word, clip.charStarts) : cap.now();
            // Waits until the voice reaches the mark's word.
            if (due > cap.now()) await sleep((due - cap.now()) * 1000);
            const late = cap.now() - due;
            sync.push({ scene: scene.id, action: m.action.name, word: plain(step.text).split(/\s+/)[m.word], at: Number(due.toFixed(2)), late: Number(late.toFixed(2)) });
            if (late > MAX_LATE) d.warnings.push(`${scene.id} / {@${m.action.name}} ran ${late.toFixed(1)}s after its word; move the mark later or shorten what runs before it`);
            await run(scene, [m.action]);
          }
        })();
        await Promise.all([opening, marked, speaking]);
        await run(scene, step.after);
        await d.pause((GAP + step.pause) * 1000);
      }
    }
    await d.pause(1500);
    await d.checkRing(); // a ring still shown at the end must have stayed in view too
    const seconds = await cap.stop();
    if (cap.peakBacklogBytes > 256 * 1024 * 1024) d.warnings.push(`video encoder fell behind (peak backlog ${Math.round(cap.peakBacklogBytes / 1048576)} MB); use a faster machine`);
    if (promisesLength && !opts.only && Math.abs(seconds / 60 - promisedMinutes) > 1.5) d.note(`The intro promises about ${promisedMinutes} minutes, but the video is ${fmt(seconds)}`);
    await browser.close();

    // Mix the narration in, with captions and chapters.
    log('Mixing…');
    await mux({ video: raw, videoSeconds: seconds, clips: placed, out: outFile('.mp4'), captions: outFile('.vtt'), chapters, title: TITLE });
    await rm(raw, { force: true });
    await writeFile(outFile('.chapters.txt'), chaptersText(chapters));
    await writeFile(outFile('.transcript.md'), transcript(kept, chapters));
    const report = {
      recordedAt: new Date().toISOString(),
      mode: opts.mode,
      strict: opts.strict,
      duration: Math.round(seconds),
      voice: voice.label,
      app: url,
      features: [...features],
      scenes: kept.map((s) => s.id),
      skipped,
      pendingActions: [...new Set(pendingUsed.map((p) => p.split(': ')[1]))],
      pendingTotal: PENDING_ACTIONS.length,
      outsideRequests: [...outside],
      promisedMinutes: promisesLength ? promisedMinutes : undefined,
      toolchain: await toolchain(chromiumVersion),
      sync,
      frameLatency: cap.latency(),
      warnings: d.warnings,
      captionTiming: clips.size && [...clips.values()].every((c) => c.charStarts) ? 'voice timestamps' : 'estimated from text length',
    };
    await writeFile(outFile('.report.json'), JSON.stringify(report, null, 2));
    if (opts.mode === 'publish' && (d.warnings.length || outside.size)) throw new Error(`Not publishable: ${d.warnings.length} warning(s), ${outside.size} outside request(s). See report.json.`);
    // Some warnings arrive between steps (page errors, failed requests), so strict mode checks again at the end.
    if (opts.strict && (d.warnings.length || outside.size)) throw new Error(`--strict: ${d.warnings.length} warning(s) and ${outside.size} blocked outside request(s) during the recording. See report.json.`);
    log(`\nDone: ${outFile('.mp4')} (${fmt(seconds)})`);
    if (pendingUsed.length) log(`  ${pendingUsed.length} pending action(s) shown as placeholder cards.`);
    if (outside.size) log(`\n⚠ Blocked requests to outside hosts:\n  ${[...outside].join('\n  ')}`);
    if (d.warnings.length) log(`\n${d.warnings.length} warning(s); see report.json.`);
  } finally {
    unite?.stop();
    await egress?.close();
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
  // Exits rather than waiting for stray handles.
  main().then(
    () => process.exit(process.exitCode ?? 0),
    (e) => {
      console.error(`\n✗ ${(e as Error).stack ?? e}`);
      process.exit(1);
    },
  );
}
