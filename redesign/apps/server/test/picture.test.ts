import request from 'supertest';
import { stableId } from '@unite/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeReport, makeStatement, makeTheme } from '../src/seed/builders.js';
import type { PictureResponse, ThemeView } from '../src/services/picture/types.js';
import { updatePicture, waitForUpdate } from '../src/services/picture/update.js';
import { testEnv, type TestEnv } from './helpers.js';
import { asRole, ctxOf, heardPerson, makeTown, newPerson, pid, speaker, TOWN } from './picture.fixtures.js';

let env: TestEnv;
beforeEach(async () => {
  env = await testEnv();
  await makeTown(env);
});
afterEach(async () => {
  await waitForUpdate(TOWN);
  await env.close();
});

const NIGHT = stableId('thm', 'test/night');

/** Three speakers whose points are already in one theme, plus a few others. */
async function themedTown() {
  await speaker(env, 'ana', [
    { key: 'ana1', type: 'barrier', text: 'Courses run when I am on the night shift' },
    { key: 'ana2', type: 'barrier', text: 'Night shifts change every week' },
    { key: 'ana3', type: 'barrier', text: 'My rota is posted the night before' },
  ], { about: { age: 'under25' }, displayName: 'Ana' });
  await speaker(env, 'ben', [{ key: 'ben1', type: 'barrier', text: 'Night shift again, missed the class', visibility: 'named' }], { about: { age: 'over50' }, displayName: 'Ben' });
  await speaker(env, 'cat', [
    { key: 'cat1', type: 'barrier', text: 'Only counted, never shown', visibility: 'count' },
    { key: 'cat2', type: 'tradeoff', text: 'Money now or a better job later' },
    { key: 'cat3', type: 'doubt', text: 'Private doubt', visibility: 'count' },
  ], { about: { age: 'over50' } });
  await makeTheme(ctxOf(env), {
    id: NIGHT,
    assemblyId: TOWN,
    kind: 'barrier',
    name: 'night shift',
    pointIds: [pid('ana1'), pid('ana2'), pid('ana3'), pid('ben1'), pid('cat1')],
    sentences: [
      { text: 'Night shifts keep people from courses.', pointIds: [pid('ana1'), pid('ben1')] },
      { text: 'A sentence whose source is not in the picture.', pointIds: [pid('ana1'), stableId('pt', 'gone')] },
    ],
  });
}

const getPicture = async (cookie: string[]) => {
  const res = await request(env.app).get('/api/assemblies/town/picture').set('Cookie', cookie);
  expect(res.status).toBe(200);
  return res.body as PictureResponse;
};
const themeOf = (pic: PictureResponse, id: string) => pic.sections.flatMap((s) => s.themes).find((t) => t.id === id) as ThemeView;

describe('rule 1 on the picture endpoints', () => {
  it('refuses someone not heard on every picture read and on reports', async () => {
    await themedTown();
    const { cookie } = await newPerson(env);
    for (const path of ['/api/assemblies/town/picture', `/api/themes/${NIGHT}/points`, '/api/assemblies/town/reports']) {
      const res = await request(env.app).get(path).set('Cookie', cookie);
      expect(res.status, path).toBe(403);
      expect(res.body.error.code).toBe('not_heard');
    }
    expect((await request(env.app).get('/api/assemblies/town/picture')).status).toBe(403);
    const post = await request(env.app).post('/api/reports').set('Cookie', cookie).send({ targetType: 'theme', targetId: NIGHT, kind: 'missing', text: 'x' });
    expect(post.status).toBe(403);
  });

  it('lets in someone heard, and stewards and hosts without a conversation', async () => {
    await themedTown();
    const me = await heardPerson(env);
    expect((await request(env.app).get('/api/assemblies/town/picture').set('Cookie', me.cookie)).status).toBe(200);
    expect((await request(env.app).get(`/api/themes/${NIGHT}/points`).set('Cookie', me.cookie)).status).toBe(200);
    for (const role of ['steward', 'host'] as const)
      expect((await request(env.app).get('/api/assemblies/town/picture').set('Cookie', await asRole(env, role))).status).toBe(200);
  });
});

describe('what the picture shows', () => {
  it('counts people, not points (rule 4), with totals computed', async () => {
    await themedTown();
    const me = await heardPerson(env);
    const pic = await getPicture(me.cookie);
    expect(pic.totals).toEqual({ people: 3, points: 7 });
    const night = themeOf(pic, NIGHT);
    expect(night.people).toBe(3);
    expect(night.sentences).toHaveLength(1);
    expect(night.sentences[0]).toMatchObject({ text: 'Night shifts keep people from courses.', people: 2 });
    expect(pic.sections.map((s) => s.title)).toEqual(['What matters', 'What gets in the way', 'Good ordinary days', 'Ideas']);
  });

  it('quotes at most three points in time order, names named points and never quotes count points', async () => {
    await themedTown();
    const me = await heardPerson(env);
    const night = themeOf(await getPicture(me.cookie), NIGHT);
    expect(night.quotes.map((q) => q.id)).toEqual([pid('ana1'), pid('ana2'), pid('ana3')]);
    const all = (await request(env.app).get(`/api/themes/${NIGHT}/points`).set('Cookie', me.cookie)).body;
    expect(all.people).toBe(3);
    expect(all.quotes.map((q: { id: string }) => q.id)).toEqual([pid('ana1'), pid('ana2'), pid('ana3'), pid('ben1')]);
    expect(all.quotes.find((q: { id: string }) => q.id === pid('ben1')).name).toBe('Ben');
    expect(all.quotes.find((q: { id: string }) => q.id === pid('ana1')).name).toBeUndefined();
    const text = JSON.stringify(await getPicture(me.cookie));
    expect(text).not.toContain('Only counted, never shown');
    expect(text).not.toContain('Private doubt');
    expect(text).not.toContain('per_');
  });

  it('shows trade-offs and doubts as quotes only, under hard choices', async () => {
    await themedTown();
    const me = await heardPerson(env);
    const pic = await getPicture(me.cookie);
    expect(pic.hardChoices.people).toBe(1);
    expect(pic.hardChoices.quotes.map((q) => q.text)).toEqual(['Money now or a better job later']);
  });

  it('marks my own points "you said this", even when only counted', async () => {
    await themedTown();
    const me = await heardPerson(env, [{ key: 'me1', type: 'barrier', text: 'Night shift for me too', visibility: 'count' }]);
    const t = await env.deps.store.get('themes', NIGHT);
    await env.deps.store.put('themes', { ...t!, pointIds: [...t!.pointIds, pid('me1')] });
    const night = themeOf(await getPicture(me.cookie), NIGHT);
    expect(night.mine).toEqual([{ id: pid('me1'), text: 'Night shift for me too' }]);
    expect(night.people).toBe(4);
  });

  it('shows who we have not heard from, against each group target', async () => {
    await themedTown();
    const me = await heardPerson(env);
    const pic = await getPicture(me.cookie);
    expect(pic.missing).toEqual([
      { key: 'young', label: 'Under 25', heard: 1, target: 4, underHeard: true },
      { key: 'old', label: 'Over 50', heard: 2, target: 2, underHeard: false },
    ]);
  });
});

describe('updating the picture', () => {
  const fivePoints = async (n: number) => {
    for (let i = 0; i < n; i++) await speaker(env, `p${i}`, [{ key: `p${i}`, type: i % 2 ? 'matters' : 'idea', text: `Thing number ${i} that matters` }]);
  };

  it('does not update by itself below 5 unthemed points', async () => {
    await fivePoints(4);
    const me = await heardPerson(env);
    const pic = await getPicture(me.cookie);
    expect(pic.unthemed).toBe(4);
    expect(pic.updating).toBe(false);
    await waitForUpdate(TOWN);
    expect(await env.deps.store.count('themes', { assemblyId: TOWN })).toBe(0);
  });

  it('updates by itself at 5 unthemed points, then shows the themes', async () => {
    await fivePoints(5);
    const me = await heardPerson(env);
    const first = await getPicture(me.cookie);
    expect(first.unthemed).toBe(5);
    expect(first.updating).toBe(true);
    await waitForUpdate(TOWN);
    const after = await getPicture(me.cookie);
    expect(after.unthemed).toBe(0);
    const themes = after.sections.flatMap((s) => s.themes);
    expect(themes.reduce((n, t) => n + t.people, 0)).toBe(5);
    const p0 = await env.deps.store.get('points', pid('p0'));
    expect(p0?.themeId).toBeDefined();
  });

  it('lets only a steward or host update, and an update clears the confirmation', async () => {
    await fivePoints(2);
    const me = await heardPerson(env);
    expect((await request(env.app).post('/api/assemblies/town/picture/update').set('Cookie', me.cookie)).status).toBe(403);
    expect((await request(env.app).post('/api/assemblies/town/picture/confirm').set('Cookie', await asRole(env, 'host'))).status).toBe(403);
    const steward = await asRole(env, 'steward');
    const conf = await request(env.app).post('/api/assemblies/town/picture/confirm').set('Cookie', steward).send({ name: 'Rosa' });
    expect(conf.status).toBe(200);
    expect((await getPicture(me.cookie)).confirmed).toEqual({ at: env.clock.iso(), by: 'Rosa' });
    const up = await request(env.app).post('/api/assemblies/town/picture/update').set('Cookie', await asRole(env, 'host'));
    expect(up.status).toBe(200);
    expect(up.body.result).toMatchObject({ themed: 2, created: 2 });
    expect((await getPicture(me.cookie)).confirmed).toBeNull();
  });

  it('removes withdrawn points, keeps a theme with a report or statement, deletes an empty one with nothing attached', async () => {
    await speaker(env, 'w', [
      { key: 'w1', type: 'idea', text: 'Library classes' },
      { key: 'w2', type: 'matters', text: 'Family time' },
      { key: 'w3', type: 'barrier', text: 'Bus fares' },
      { key: 'w4', type: 'barrier', text: 'Shift rota' },
    ]);
    const ctx = ctxOf(env);
    const [reported, stated, bare, staying] = ['reported', 'stated', 'bare', 'staying'].map((k) => stableId('thm', `test/${k}`)) as [string, string, string, string];
    await makeTheme(ctx, { id: reported, assemblyId: TOWN, kind: 'idea', name: 'Library classes', pointIds: [pid('w1')] });
    await makeTheme(ctx, { id: stated, assemblyId: TOWN, kind: 'matters', name: 'Family time', pointIds: [pid('w2')] });
    await makeTheme(ctx, { id: bare, assemblyId: TOWN, kind: 'barrier', name: 'Bus fares', pointIds: [pid('w3')] });
    await makeTheme(ctx, {
      id: staying,
      assemblyId: TOWN,
      kind: 'barrier',
      name: 'Shift rota',
      pointIds: [pid('w4'), pid('w3')],
      sentences: [{ text: 'Rotas and fares.', pointIds: [pid('w4'), pid('w3')] }, { text: 'Rotas.', pointIds: [pid('w4')] }],
    });
    await makeReport(ctx, { id: stableId('rpt', 'test/r'), assemblyId: TOWN, targetType: 'theme', targetId: reported, kind: 'missing', text: 'Something is missing' });
    await makeStatement(ctx, { id: stableId('st', 'test/s'), assemblyId: TOWN, text: 'Family time matters.', pointIds: [pid('w2')], themeIds: [stated] });
    for (const k of ['w1', 'w2', 'w3']) {
      const p = await env.deps.store.get('points', pid(k));
      await env.deps.store.put('points', { ...p!, status: 'withdrawn' });
    }
    const result = await updatePicture(env.deps, TOWN);
    expect(result).toMatchObject({ deleted: 1, keptEmpty: 2, removed: 4 });
    expect(await env.deps.store.get('themes', reported)).toMatchObject({ pointIds: [] });
    expect(await env.deps.store.get('themes', stated)).toMatchObject({ pointIds: [] });
    expect(await env.deps.store.get('themes', bare)).toBeUndefined();
    // Without the AI the theme keeps the sentences whose sources are all still in it.
    expect(await env.deps.store.get('themes', staying)).toMatchObject({ pointIds: [pid('w4')], sentences: [{ text: 'Rotas.', pointIds: [pid('w4')] }] });
    expect((await env.deps.store.get('points', pid('w3')))?.themeId).toBeUndefined();
  });

  it('runs one update at a time per assembly', async () => {
    await fivePoints(3);
    const a = updatePicture(env.deps, TOWN);
    const b = updatePicture(env.deps, TOWN);
    expect(a).toBe(b);
    await a;
    expect(await env.deps.store.count('themes', { assemblyId: TOWN })).toBe(2);
  });
});

describe('reports: this is not what was said', () => {
  it('a heard person reports a theme, it shows beside the theme, and only a steward resolves it', async () => {
    await themedTown();
    const me = await heardPerson(env);
    const bad = await request(env.app).post('/api/reports').set('Cookie', me.cookie).send({ targetType: 'theme', targetId: stableId('thm', 'nope'), kind: 'count', text: 'x' });
    expect(bad.status).toBe(404);
    const res = await request(env.app)
      .post('/api/reports')
      .set('Cookie', me.cookie)
      .send({ targetType: 'theme', targetId: NIGHT, kind: 'emphasis', text: 'It was about the rota, not the shift' });
    expect(res.status).toBe(201);
    expect(res.body.report).toMatchObject({ kind: 'emphasis', status: 'open', mine: true });
    expect(res.body.report.personId).toBeUndefined();
    const night = themeOf(await getPicture(me.cookie), NIGHT);
    expect(night.reports.map((r) => r.text)).toEqual(['It was about the rota, not the shift']);

    const id = res.body.report.id;
    expect((await request(env.app).patch(`/api/reports/${id}`).set('Cookie', me.cookie).send({ status: 'upheld', outcomeNote: 'ok' })).status).toBe(403);
    const steward = await asRole(env, 'steward');
    expect((await request(env.app).patch(`/api/reports/${id}`).set('Cookie', steward).send({ status: 'upheld' })).status).toBe(400);
    const done = await request(env.app).patch(`/api/reports/${id}`).set('Cookie', steward).send({ status: 'upheld', outcomeNote: 'The name now says rota.' });
    expect(done.status).toBe(200);
    const list = (await request(env.app).get('/api/assemblies/town/reports').set('Cookie', me.cookie)).body.reports;
    expect(list).toEqual([expect.objectContaining({ status: 'upheld', outcomeNote: 'The name now says rota.', targetType: 'theme', targetId: NIGHT })]);
    expect(themeOf(await getPicture(me.cookie), NIGHT).reports[0]).toMatchObject({ status: 'upheld', outcomeNote: 'The name now says rota.' });
  });
});
