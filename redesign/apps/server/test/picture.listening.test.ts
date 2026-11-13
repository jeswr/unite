import request from 'supertest';
import { stableId } from '@unite/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeAssembly, makeTheme } from '../src/seed/builders.js';
import type { ListeningResponse } from '@unite/shared';
import { reachOf } from '../src/routes/listening.js';
import { testEnv, type TestEnv } from './helpers.js';
import { ctxOf, heardPerson, newPerson, pid, speaker } from './picture.fixtures.js';

let env: TestEnv;
const OPEN = stableId('asm', 'test/open');
const CARE = stableId('thm', 'test/care');
const STREETS = stableId('thm', 'test/streets');
const DAY = stableId('thm', 'test/day');

beforeEach(async () => {
  env = await testEnv();
  const ctx = ctxOf(env);
  await makeAssembly(ctx, {
    id: OPEN,
    slug: 'open',
    title: 'The lives people want',
    question: 'What does a good ordinary life look like for you?',
    kind: 'listening',
    scale: 'global',
    hostName: '',
    hostSlug: '',
    stage: 'listening',
    isOpenListening: true,
  });
  await speaker(env, 'lu', [
    { key: 'lu1', type: 'barrier', text: 'Caring for my mother while I work full time' },
    { key: 'lu2', type: 'wish', text: 'Breakfast outside with my daughter before school', visibility: 'named' },
  ], { assemblyId: OPEN, displayName: 'Lu' });
  await speaker(env, 'mo', [
    { key: 'mo1', type: 'barrier', text: 'Cars too fast past the school' },
    { key: 'mo2', type: 'moment', text: 'Counted only', visibility: 'count' },
  ], { assemblyId: OPEN });
  await makeTheme(ctx, { id: CARE, assemblyId: OPEN, kind: 'barrier', name: 'caring for my mother', pointIds: [pid('lu1')] });
  await makeTheme(ctx, { id: STREETS, assemblyId: OPEN, kind: 'barrier', name: 'cars too fast', pointIds: [pid('mo1')] });
  await makeTheme(ctx, { id: DAY, assemblyId: OPEN, kind: 'day', name: 'breakfast outside', pointIds: [pid('lu2'), pid('mo2')] });
  // An assembly opened to answer the care theme.
  await makeAssembly(ctx, {
    id: stableId('asm', 'test/care'),
    slug: 'care',
    title: 'Care',
    question: 'What should care look like?',
    kind: 'advisory',
    scale: 'global',
    hostName: 'Care Coalition',
    hostSlug: 'care',
    stage: 'pledged',
    fromThemeId: CARE,
  });
});
afterEach(() => env.close());

const get = async (cookie?: string[]) => {
  const req = request(env.app).get('/api/listening');
  const res = cookie ? await req.set('Cookie', cookie) : await req;
  expect(res.status).toBe(200);
  return res.body as ListeningResponse;
};

describe('open listening', () => {
  it('lists themes with no host: those no assembly’s fromThemeId points to', async () => {
    const body = await get();
    expect(body.noHost.map((t) => t.name).sort()).toEqual(['breakfast outside', 'cars too fast']);
    expect(body.noHost.find((t) => t.id === STREETS)?.people).toBe(1);
    const care = body.sections.flatMap((s) => s.themes).find((t) => t.id === CARE);
    expect(care?.hostedBy).toEqual([{ slug: 'care', title: 'Care' }]);
  });

  it('shows theme names and counts to anyone, but no quotes, sentences or days until heard (rule 1)', async () => {
    const anon = await get();
    expect(anon.heard).toBe(false);
    expect(anon.totals).toEqual({ people: 2, points: 4 });
    const themes = anon.sections.flatMap((s) => s.themes);
    expect(themes.map((t) => [t.name, t.people])).toContainEqual(['breakfast outside', 2]);
    expect(themes.every((t) => t.quotes.length === 0 && t.sentences.length === 0)).toBe(true);
    expect(anon.days).toEqual([]);
    expect(JSON.stringify(anon)).not.toContain('Caring for my mother');
    const stranger = await newPerson(env);
    expect((await get(stranger.cookie)).heard).toBe(false);
  });

  it('shows quotes and good ordinary days, without names, once heard', async () => {
    const me = await heardPerson(env, [], { assemblyId: OPEN });
    const body = await get(me.cookie);
    expect(body.heard).toBe(true);
    expect(body.sections.flatMap((s) => s.themes).find((t) => t.id === CARE)?.quotes.map((q) => q.text)).toEqual(['Caring for my mother while I work full time']);
    expect(body.days).toEqual([{ id: DAY, name: 'breakfast outside', people: 2, quotes: [{ id: pid('lu2'), text: 'Breakfast outside with my daughter before school' }] }]);
  });
});

describe('where people come from', () => {
  it('counts countries and languages from each person’s locale', () => {
    expect(reachOf(['es-MX', 'es-MX', 'en-US', 'fr-SN', 'wo-SN', 'en', 'pt-BR', 'zh-Hant-TW'])).toEqual({ people: 8, countries: 5, languages: 6 });
    expect(reachOf([])).toEqual({ people: 0, countries: 0, languages: 0 });
  });

  it('puts the counts in the listening response, from the people who have approved points', async () => {
    const lu = await env.deps.store.get('persons', stableId('per', 'test/lu'));
    await env.deps.store.put('persons', { ...lu!, locale: 'es-MX' });
    const mo = await env.deps.store.get('persons', stableId('per', 'test/mo'));
    await env.deps.store.put('persons', { ...mo!, locale: 'fr-SN' });
    // Someone with no approved points is not counted.
    await newPerson(env);
    expect((await get()).reach).toEqual({ people: 2, countries: 2, languages: 2 });
  });
});
