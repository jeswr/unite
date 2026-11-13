import {
  classifyStatement,
  COLLECTION_NAMES,
  countPeople,
  findLeadingPhrases,
  opinionGroups,
  rankPriorities,
  registerSummary,
  statementSupport,
  wordOverlap,
  type Point,
} from '@unite/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FACILITATOR_FALLBACK, SCRIPTED_QUESTIONS } from '../src/ai/prompts.js';
import { ASSEMBLY_IDS, EARNING_PLEDGE, SEED_NOW, VOLUNTEERING_PLEDGE } from '../src/seed/assemblies.js';
import { EARNING_STATEMENTS } from '../src/seed/content/earningDebate.js';
import { EARNING_PROBES } from '../src/seed/content/transcripts.js';
import { EARNING_IDS } from '../src/seed/earning.js';
import { seed } from '../src/seed/index.js';
import { OPEN_IDS } from '../src/seed/open.js';
import { VOLUNTEERING_IDS } from '../src/seed/volunteering.js';
import type { Store } from '../src/store/types.js';
import { testEnv, type TestEnv } from './helpers.js';

let env: TestEnv;
let store: Store;

beforeAll(async () => {
  env = await testEnv();
  store = env.deps.store;
  // The store validates every document against its schema, so completing proves they all validate.
  await seed(env.deps);
}, 60_000);
afterAll(() => env.close());

const country = (locale: string) => locale.split('-')[1];
const pointsOf = (assemblyId: string) => store.list('points', { assemblyId });
const peopleOf = async (assemblyId: string) => {
  const ms = await store.list('memberships', { assemblyId });
  return Promise.all(ms.map(async (m) => (await store.get('persons', m.personId))!));
};
const peopleIn = async (points: Point[]) => {
  const ids = [...new Set(points.map((p) => p.personId))];
  return Promise.all(ids.map(async (id) => (await store.get('persons', id))!));
};

describe('seed: running it again changes nothing', () => {
  it('gives identical documents on a second run', async () => {
    const snapshot = async (s: Store) => {
      const out: Record<string, unknown> = {};
      for (const c of COLLECTION_NAMES) out[c] = await s.list(c);
      return JSON.stringify(out);
    };
    const before = await snapshot(store);
    await seed(env.deps);
    expect(await snapshot(store)).toBe(before);
  }, 60_000);
});

describe('seed: the people', () => {
  it('every seeded person is an example with a first name only, unique within their assembly', async () => {
    const persons = await store.list('persons');
    expect(persons.length).toBe(60 + 48 + 36);
    for (const p of persons) {
      expect(p.isExample).toBe(true);
      expect(p.displayName).toMatch(/^\p{Lu}[\p{Ll}]+$/u);
    }
    for (const a of [ASSEMBLY_IDS.open, ASSEMBLY_IDS.earning, ASSEMBLY_IDS.volunteering]) {
      const names = (await peopleOf(a)).map((p) => p.displayName);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it('no point is longer than 30 words, and no two points in an assembly are the same', async () => {
    for (const a of [ASSEMBLY_IDS.open, ASSEMBLY_IDS.earning, ASSEMBLY_IDS.volunteering]) {
      const pts = await pointsOf(a);
      for (const p of pts) {
        const words = (p.textEn ?? p.text).trim().split(/\s+/).length;
        expect(words, p.text).toBeLessThanOrEqual(30);
        if (!p.textEn) expect(p.text.trim().split(/\s+/).length, p.text).toBeLessThanOrEqual(30);
      }
      const texts = pts.map((p) => p.text.toLowerCase());
      expect(new Set(texts).size).toBe(texts.length);
    }
  });

  it('mixes visibility: about half anonymous, a third counted only, the rest named', async () => {
    for (const a of [ASSEMBLY_IDS.open, ASSEMBLY_IDS.earning, ASSEMBLY_IDS.volunteering]) {
      const pts = await pointsOf(a);
      const share = (v: Point['visibility']) => pts.filter((p) => p.visibility === v).length / pts.length;
      expect(share('anonymous')).toBeGreaterThan(0.4);
      expect(share('anonymous')).toBeLessThan(0.6);
      expect(share('count')).toBeGreaterThan(0.25);
      expect(share('count')).toBeLessThan(0.4);
      expect(share('named')).toBeGreaterThan(0.12);
    }
  });

  it('every conversation is complete, by the AI route, with only approved points', async () => {
    for (const c of await store.list('conversations')) {
      expect(c).toMatchObject({ status: 'complete', route: 'ai' });
      expect(c.completedAt! <= SEED_NOW).toBe(true);
    }
    for (const p of await store.list('points')) {
      expect(p.status).toBe('approved');
      expect(p.approvedAt! <= SEED_NOW).toBe(true);
    }
  });

  it('every point not in English has an English rendering, and English points have none', async () => {
    for (const p of await store.list('points')) {
      const c = (await store.get('conversations', p.conversationId))!;
      const person = (await store.get('persons', p.personId))!;
      expect(c.language === 'en').toBe(person.locale.startsWith('en'));
      if (c.language === 'en') expect(p.textEn).toBeUndefined();
      else expect(p.textEn, p.text).toBeTruthy();
    }
  });
});

describe('seed: open listening', () => {
  it('has 60 people in 14 countries on every inhabited continent, with 3 to 5 points each', async () => {
    const pts = await pointsOf(ASSEMBLY_IDS.open);
    expect(countPeople(pts)).toBe(60);
    const people = await peopleOf(ASSEMBLY_IDS.open);
    expect(people).toHaveLength(60);
    expect(new Set(people.map((p) => country(p.locale))).size).toBe(14);
    const regions = new Set(people.map((p) => p.about.region));
    for (const r of ['Africa', 'Asia', 'Europe', 'Latin America and the Caribbean', 'North America', 'Oceania']) expect(regions).toContain(r);
    for (const p of people) {
      const n = pts.filter((x) => x.personId === p.id).length;
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(5);
      expect(p.about.age).toBeTruthy();
    }
  });

  it('has at least 20 people speaking in at least 6 languages other than English', async () => {
    const convs = (await store.list('conversations', { assemblyId: ASSEMBLY_IDS.open })).filter((c) => c.language !== 'en');
    expect(convs.length).toBeGreaterThanOrEqual(20);
    expect(new Set(convs.map((c) => c.language)).size).toBeGreaterThanOrEqual(6);
  });

  it('has themes of every kind, and a large theme about caring for an ageing parent while working', async () => {
    const themes = await store.list('themes', { assemblyId: ASSEMBLY_IDS.open });
    expect(new Set(themes.map((t) => t.kind))).toEqual(new Set(['matters', 'barrier', 'idea', 'day']));
    const care = themes.find((t) => t.id === OPEN_IDS.careTheme)!;
    const carePoints = (await Promise.all(care.pointIds.map((id) => store.get('points', id)))) as Point[];
    expect(countPeople(carePoints)).toBeGreaterThanOrEqual(9);
    expect(new Set((await peopleIn(carePoints)).map((p) => country(p.locale))).size).toBeGreaterThanOrEqual(5);
    expect(themes.find((t) => t.name === 'Safe streets for children')).toBeTruthy();
    // At least four themes besides the care theme, which no assembly answers.
    const answered = new Set((await store.list('assemblies')).map((a) => a.fromThemeId).filter(Boolean));
    expect(themes.filter((t) => t.id !== OPEN_IDS.careTheme && !answered.has(t.id)).length).toBeGreaterThanOrEqual(4);
  });
});

describe('seed: Riverbend (earning and learning)', () => {
  it('has 48 invited participants with completed conversations, 3 of them under 25', async () => {
    const ms = await store.list('memberships', { assemblyId: ASSEMBLY_IDS.earning });
    expect(ms).toHaveLength(48);
    for (const m of ms) expect(m).toMatchObject({ role: 'participant', invited: true });
    expect(await store.count('conversations', { assemblyId: ASSEMBLY_IDS.earning, status: 'complete' })).toBe(48);
    expect(countPeople(await pointsOf(ASSEMBLY_IDS.earning))).toBe(48);
    const people = await peopleOf(ASSEMBLY_IDS.earning);
    const assembly = (await store.get('assemblies', ASSEMBLY_IDS.earning))!;
    const heard = (key: string) => {
      const g = assembly.affectedGroups.find((x) => x.key === key)!;
      return people.filter((p) => p.about[g.aboutKey] === g.aboutValue).length;
    };
    expect(heard('under_25')).toBe(3);
    for (const g of assembly.affectedGroups.filter((x) => x.key !== 'under_25')) expect(heard(g.key), g.label).toBeGreaterThanOrEqual(g.target);
    expect(people.every((p) => p.displayName !== 'Amina')).toBe(true);
  });

  it('names the classes theme with a participant’s phrase and has exactly 18 people in it', async () => {
    const theme = (await store.get('themes', EARNING_IDS.theme('classes')))!;
    const pts = (await Promise.all(theme.pointIds.map((id) => store.get('points', id)))) as Point[];
    expect(countPeople(pts)).toBe(18);
    expect(pts.some((p) => p.text.toLowerCase().includes(theme.name.toLowerCase()))).toBe(true);
    const names = (await store.list('themes', { assemblyId: ASSEMBLY_IDS.earning })).map((t) => t.name);
    for (const n of ['I can’t stop earning to learn', 'What will still be a job', 'Time with my family', 'No childcare during classes', 'What I already know doesn’t count']) expect(names).toContain(n);
  });

  it('has statements S1 to S8 and S2b, word for word', async () => {
    const sts = await store.list('statements', { assemblyId: ASSEMBLY_IDS.earning });
    expect(sts).toHaveLength(9);
    for (const s of EARNING_STATEMENTS) expect((await store.get('statements', EARNING_IDS.statement(s.key)))!.text).toBe(s.text);
    expect((await store.get('statements', EARNING_IDS.statement('S1')))!.text).toBe(
      'People who work nights or rotating shifts should be able to take any core course at a time that fits their shift.',
    );
    const s2b = (await store.get('statements', EARNING_IDS.statement('S2b')))!;
    expect(s2b).toMatchObject({
      version: 2,
      previousId: EARNING_IDS.statement('S2'),
      origin: 'room',
      text: 'Workers in roles their employer expects to change should get paid learning hours, with the cost shared between the employer and the skills fund.',
    });
  });

  it('reactions give two opinion groups, and every statement’s status follows the pledge’s rule', async () => {
    const sts = await store.list('statements', { assemblyId: ASSEMBLY_IDS.earning });
    const rx = (await store.list('reactions', { assemblyId: ASSEMBLY_IDS.earning })).filter((r) => r.counted);
    const groups = opinionGroups(rx, sts.map((s) => s.id));
    expect(groups.groups).toHaveLength(2);
    expect(groups.groups[0]!.personIds.length + groups.groups[1]!.personIds.length).toBe(48);
    const expected = { S1: 'common_ground', S2: 'differ', S2b: 'common_ground', S3: 'common_ground', S4: 'common_ground', S5: 'differ', S6: 'common_ground', S7: 'differ', S8: 'not_enough' } as const;
    for (const [key, status] of Object.entries(expected)) {
      const st = sts.find((s) => s.id === EARNING_IDS.statement(key as keyof typeof expected))!;
      const support = statementSupport(st, rx, groups);
      expect(classifyStatement(support, EARNING_PLEDGE, support.overall.total), key).toBe(status);
      expect(st.status, key).toBe(status);
    }
  });

  it('31 people chose priorities, ranked S1, S2b, S6, S3, S4', async () => {
    const choices = await store.list('priorityChoices', { assemblyId: ASSEMBLY_IDS.earning });
    expect(choices).toHaveLength(31);
    const cg = (await store.list('statements', { assemblyId: ASSEMBLY_IDS.earning, status: 'common_ground' })).map((s) => s.id);
    const order = rankPriorities(choices, cg).map((r) => r.statementId);
    expect(order).toEqual((['S1', 'S2b', 'S6', 'S3', 'S4'] as const).map((k) => EARNING_IDS.statement(k)));
    expect(choices.length).toBeGreaterThanOrEqual(Math.ceil(48 / 2));
  });

  it('has a closed room on S2 that proposed S2b, with the facilitator’s fixed wording and private answers', async () => {
    const room = (await store.get('rooms', EARNING_IDS.roomS2))!;
    expect(room).toMatchObject({ status: 'closed', statementId: EARNING_IDS.statement('S2') });
    expect(room.memberIds).toHaveLength(6);
    expect(room.outcome?.proposedWording).toBe((await store.get('statements', EARNING_IDS.statement('S2b')))!.text);
    const msgs = await store.list('roomMessages', { roomId: room.id });
    expect(msgs.length).toBeGreaterThanOrEqual(24);
    const fixed = Object.values(FACILITATOR_FALLBACK);
    for (const m of msgs.filter((x) => x.authorType === 'facilitator')) {
      expect(fixed.some((f) => (f.includes('{name}') ? m.text.startsWith(f.split('{name}')[0]!) && m.text.endsWith(f.split('{name}')[1]!) : m.text === f)), m.text).toBe(true);
    }
    for (const m of msgs.filter((x) => x.authorType === 'person')) expect(room.memberIds).toContain(m.personId);
    expect(msgs.filter((x) => x.authorType === 'facilitator').length).toBeGreaterThanOrEqual(5);
    const answers = await store.list('roomAnswers', { roomId: room.id });
    expect(answers.map((a) => a.personId).sort()).toEqual([...room.memberIds].sort());
    // The room is balanced across the two opinion groups.
    const sts = await store.list('statements', { assemblyId: ASSEMBLY_IDS.earning });
    const groups = opinionGroups(await store.list('reactions', { assemblyId: ASSEMBLY_IDS.earning }), sts.map((s) => s.id));
    for (const g of groups.groups) expect(room.memberIds.filter((id) => g.personIds.includes(id))).toHaveLength(3);
  });

  it('has a scheduled room on S5 with a two-sided briefing and two evidence cards', async () => {
    const room = (await store.get('rooms', EARNING_IDS.roomS5))!;
    expect(room).toMatchObject({ status: 'scheduled', statementId: EARNING_IDS.statement('S5') });
    expect(room.memberIds).toHaveLength(6);
    expect(room.briefing.forSide.length).toBeGreaterThanOrEqual(2);
    expect(room.briefing.againstSide.length).toBeGreaterThanOrEqual(2);
    expect(room.briefing.evidenceIds).toHaveLength(2);
    for (const id of room.briefing.evidenceIds) {
      const e = (await store.get('evidenceCards', id))!;
      expect(e.expertName && e.expertRole && e.disputed).toBeTruthy();
      expect(e.sources.length).toBeGreaterThan(0);
      // Sources link only to the publishing organisation’s home page.
      for (const s of e.sources) expect(s.url).toMatch(/^https:\/\/www\.[a-z]+\.org$/);
    }
  });

  it('has at least four reasons on each side of S5 and S7, an answered objection on S4 and an upheld report', async () => {
    for (const k of ['S5', 'S7'] as const) {
      const rs = await store.list('reasons', { statementId: EARNING_IDS.statement(k) });
      expect(rs.filter((r) => r.side === 'for').length).toBeGreaterThanOrEqual(4);
      expect(rs.filter((r) => r.side === 'against').length).toBeGreaterThanOrEqual(4);
    }
    const objections = await store.list('objections', { assemblyId: ASSEMBLY_IDS.earning });
    expect(objections).toHaveLength(1);
    expect(objections[0]).toMatchObject({ statementId: EARNING_IDS.statement('S4'), status: 'answered' });
    expect(objections[0]!.reply).toBeTruthy();
    const reports = await store.list('reports', { assemblyId: ASSEMBLY_IDS.earning });
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ targetType: 'theme', status: 'upheld' });
    expect(reports[0]!.outcomeNote).toBeTruthy();
    expect(await store.get('themes', reports[0]!.targetId)).toBeTruthy();
    expect(await store.count('decisions', { assemblyId: ASSEMBLY_IDS.earning })).toBe(0);
  });
});

describe('seed: every summary sentence and statement has sources (rule 3)', () => {
  it('theme sentences cite points of their own theme, and theme names come from their points', async () => {
    const kindOf: Record<Point['type'], string | null> = { matters: 'matters', barrier: 'barrier', idea: 'idea', moment: 'day', wish: 'day', tradeoff: null, doubt: null };
    for (const t of await store.list('themes')) {
      expect(t.pointIds.length, t.name).toBeGreaterThan(0);
      const pts = (await Promise.all(t.pointIds.map((id) => store.get('points', id)))) as (Point | null)[];
      for (const p of pts) {
        expect(p, t.name).toBeTruthy();
        expect(p!.assemblyId).toBe(t.assemblyId);
        expect(p!.themeId).toBe(t.id);
        expect(kindOf[p!.type], `${t.name}: ${p!.text}`).toBe(t.kind);
      }
      expect(t.sentences.length).toBeGreaterThan(0);
      for (const s of t.sentences) {
        expect(s.pointIds.length, s.text).toBeGreaterThan(0);
        for (const id of s.pointIds) expect(t.pointIds, `${t.name}: ${s.text}`).toContain(id);
      }
      const name = t.name.toLowerCase();
      expect(pts.some((p) => p!.text.toLowerCase().includes(name) || (p!.textEn ?? '').toLowerCase().includes(name)), t.name).toBe(true);
    }
  });

  it('statements cite existing points of their own assembly, from their own themes or doubts', async () => {
    for (const s of await store.list('statements')) {
      expect(s.pointIds.length, s.text).toBeGreaterThan(0);
      for (const id of s.pointIds) {
        const p = await store.get('points', id);
        expect(p, `${s.text}: ${id}`).toBeTruthy();
        expect(p!.assemblyId).toBe(s.assemblyId);
        if (p!.themeId) expect(s.themeIds, `${s.text}: ${p!.text}`).toContain(p!.themeId);
      }
      for (const id of s.themeIds) expect(await store.get('themes', id)).toBeTruthy();
    }
  });
});

describe('seed: the six transcripts', () => {
  it('follow the eight stages with the fixed questions, and every point cites the turns it came from', async () => {
    const convs = [];
    for (const c of await store.list('conversations')) if ((await store.count('turns', { conversationId: c.id })) > 0) convs.push(c);
    expect(convs.filter((c) => c.assemblyId === ASSEMBLY_IDS.earning)).toHaveLength(4);
    expect(convs.filter((c) => c.assemblyId === ASSEMBLY_IDS.open)).toHaveLength(2);
    for (const c of convs) {
      const turns = await store.list('turns', { conversationId: c.id });
      expect(new Set(turns.map((t) => t.stage))).toEqual(new Set([1, 2, 3, 4, 5, 6, 7, 8]));
      for (const t of turns.filter((x) => x.role === 'interviewer')) {
        const allowed = [...SCRIPTED_QUESTIONS[t.stage]!, ...(c.assemblyId === ASSEMBLY_IDS.earning && t.stage === 7 ? EARNING_PROBES : [])];
        expect(allowed, t.text).toContain(t.text);
      }
      for (const stage of [1, 2, 3, 4]) expect(turns.filter((t) => t.stage === stage && t.role === 'person').length).toBeGreaterThanOrEqual(2);
      if (c.assemblyId === ASSEMBLY_IDS.earning) for (const probe of EARNING_PROBES) expect(turns.map((t) => t.text)).toContain(probe);
      const points = await store.list('points', { conversationId: c.id });
      expect(points.length).toBeGreaterThanOrEqual(3);
      for (const p of points) {
        expect(p.sourceTurnIds.length).toBeGreaterThan(0);
        const sources = p.sourceTurnIds.map((id) => turns.find((t) => t.id === id)!);
        for (const s of sources) expect(s, p.text).toMatchObject({ role: 'person' });
        expect(wordOverlap(p.text, sources.map((s) => s.text)), p.text).toBeGreaterThanOrEqual(0.6);
      }
    }
  });
});

describe('seed: the volunteering tool', () => {
  it('has 36 participants, a confirmed picture, settled statements and closed priorities', async () => {
    expect(countPeople(await pointsOf(ASSEMBLY_IDS.volunteering))).toBe(36);
    const a = (await store.get('assemblies', ASSEMBLY_IDS.volunteering))!;
    expect(a.pictureConfirmedAt).toBeTruthy();
    const sts = await store.list('statements', { assemblyId: ASSEMBLY_IDS.volunteering });
    for (const s of sts) expect(['decided', 'no_agreement']).toContain(s.status);
    const rx = await store.list('reactions', { assemblyId: ASSEMBLY_IDS.volunteering });
    const groups = opinionGroups(rx, sts.map((s) => s.id));
    for (const n of [1, 2, 3, 4, 5]) {
      const d = (await store.get('decisions', VOLUNTEERING_IDS.decision(n)))!;
      const st = sts.find((s) => s.id === d.statementId)!;
      const support = statementSupport(st, rx, groups);
      expect(classifyStatement(support, VOLUNTEERING_PLEDGE, support.overall.total), d.title).toBe('common_ground');
    }
    const v6 = sts.find((s) => s.status === 'no_agreement')!;
    expect(classifyStatement(statementSupport(v6, rx, groups), VOLUNTEERING_PLEDGE, 36)).not.toBe('common_ground');
    // The decisions' ranks follow the proportional ranking of the priority choices.
    const choices = await store.list('priorityChoices', { assemblyId: ASSEMBLY_IDS.volunteering });
    for (const c of choices) expect(c.updatedAt < '2026-05-20').toBe(true);
    const ranked = rankPriorities(choices, sts.filter((s) => s.status === 'decided').map((s) => s.id)).map((r) => r.statementId);
    for (const n of [1, 2, 3, 4, 5]) expect(ranked[n - 1]).toBe((await store.get('decisions', VOLUNTEERING_IDS.decision(n)))!.statementId);
  });

  it('has the five decisions as worded, with answers, tests and the register figures', async () => {
    const ds = (await store.list('decisions', { assemblyId: ASSEMBLY_IDS.volunteering })).sort((x, y) => x.number - y.number);
    expect(ds.map((d) => d.title)).toEqual([
      'A volunteer proves who they are once and can share that proof with any group they choose.',
      'Hours given are recorded by the volunteer, confirmed by the group, and belong to the volunteer.',
      'A group with no paid staff can start using it in ten minutes without training.',
      'The tool works in Welsh, Urdu and Polish from the first release.',
      'The network pays volunteers’ travel costs through the tool.',
    ]);
    expect(ds.map((d) => d.status)).toEqual(['delivered_minor_changes', 'in_progress', 'in_progress', 'delayed', 'refused']);
    expect(ds.map((d) => d.answer?.kind)).toEqual(['accepted', 'accepted', 'changed', 'delayed', 'refused']);
    expect(ds[0]!.tests.map((t) => t.text)).toEqual([
      'A volunteer checked by one group can start with a second group without a new identity check.',
      'The volunteer can see which groups have looked at their record.',
      'The volunteer can withdraw a group’s access at any time.',
    ]);
    for (const d of ds) {
      expect(d.tests.length).toBeGreaterThanOrEqual(2);
      expect(d.tests.map((t) => t.n)).toEqual(d.tests.map((_, i) => i + 1));
      expect(d.why && d.dissent && d.options.length >= 2 && d.answer!.reasons.length > 100).toBeTruthy();
      expect(d.answer!.answeredAt.slice(0, 10) <= VOLUNTEERING_PLEDGE.replyBy).toBe(true);
      expect(d.dueDate).toBe(VOLUNTEERING_PLEDGE.replyBy);
    }
    expect(ds[2]!.answer!.changedTo).toMatch(/phone/);
    expect(ds[3]!.answer!.delayedUntil! > SEED_NOW.slice(0, 10)).toBe(true);
    expect(ds[4]!.answer!.reasons).toMatch(/travel policy/);
    const summary = registerSummary(ds);
    expect(summary).toMatchObject({ total: 5, answered: 5, awaitingAnswer: 0, inProgress: 2, delivered: 1, deliveredAsDecided: 0, notDelivered: 0 });
  });

  it('has a chosen and a not-chosen proposal for Decision 1, delivery items, and the check by a panel of five', async () => {
    const props = await store.list('buildProposals', { decisionId: VOLUNTEERING_IDS.decision(1) });
    expect(props.map((p) => p.status).sort()).toEqual(['chosen', 'not_chosen']);
    const chosen = props.find((p) => p.status === 'chosen')!;
    expect(chosen.testCoverage.map((t) => t.n)).toEqual([1, 2, 3]);
    expect(chosen.faithfulConfirmedAt).toBeTruthy();
    for (const n of [2, 3]) expect((await store.list('buildProposals', { decisionId: VOLUNTEERING_IDS.decision(n), status: 'chosen' })).length).toBe(1);
    const d1Items = await store.list('deliveryItems', { decisionId: VOLUNTEERING_IDS.decision(1) });
    expect(d1Items.map((i) => i.status)).toEqual(['done', 'done', 'done']);
    expect(await store.count('deliveryItems', { decisionId: VOLUNTEERING_IDS.decision(2) })).toBe(2);
    const all = await store.list('deliveryItems', { assemblyId: ASSEMBLY_IDS.volunteering });
    for (const i of all) for (const u of i.updates) expect(u.at <= SEED_NOW).toBe(true);
    expect(all.some((i) => i.updates.some((u) => /governed in Concord/.test(u.text)))).toBe(true);
    const check = (await store.get('checks', VOLUNTEERING_IDS.checkD1))!;
    expect(check.panel).toHaveLength(5);
    expect(check.panel).toEqual(['Oliver', 'Farah', 'Delroy', 'Ceri', 'Tariq']);
    expect(check.results.map((r) => [r.n, r.met])).toEqual([
      [1, true],
      [2, false],
      [3, true],
    ]);
    expect(check.classification).toBe('minor_changes');
    expect(check.checkedAt <= SEED_NOW).toBe(true);
  });
});

describe('seed: AI and care, and Making Unite better', () => {
  it('AI and care has no people yet, three fair probes, groups by region, and 9 days left to challenge', async () => {
    const a = (await store.get('assemblies', ASSEMBLY_IDS.aiAndCare))!;
    expect(await store.count('memberships', { assemblyId: a.id })).toBe(0);
    expect(await store.count('conversations', { assemblyId: a.id })).toBe(0);
    expect(a.probes).toHaveLength(3);
    for (const p of [a.question, ...a.probes]) expect(findLeadingPhrases(p)).toEqual([]);
    expect(a.affectedGroups.length).toBeGreaterThanOrEqual(5);
    for (const g of a.affectedGroups) expect(g).toMatchObject({ aboutKey: 'region' });
    const days = (new Date(a.pledge!.challengeEndsAt!).getTime() - new Date(SEED_NOW).getTime()) / 86_400_000;
    expect(days).toBe(9);
    if (a.fromThemeId) expect(a.fromThemeId).toBe(OPEN_IDS.careTheme);
  });

  it('Making Unite better has no people and no points', async () => {
    for (const c of ['memberships', 'conversations', 'points', 'statements', 'themes'] as const) {
      expect(await store.count(c, { assemblyId: ASSEMBLY_IDS.feedback })).toBe(0);
    }
  });
});

describe('seed: times', () => {
  it('everything that happened is dated on or before 13 November 2026', async () => {
    const stamps: string[] = [];
    for (const c of await store.list('conversations')) stamps.push(c.startedAt, c.completedAt!);
    for (const r of await store.list('reactions')) stamps.push(r.createdAt);
    for (const s of await store.list('statements')) stamps.push(s.createdAt, s.updatedAt);
    for (const r of await store.list('reasons')) stamps.push(r.createdAt);
    for (const m of await store.list('roomMessages')) stamps.push(m.createdAt);
    for (const c of await store.list('priorityChoices')) stamps.push(c.updatedAt);
    for (const d of await store.list('decisions')) stamps.push(d.createdAt, d.updatedAt);
    for (const s of stamps) expect(s <= SEED_NOW).toBe(true);
    // Spread over weeks, not all at one moment.
    const days = new Set((await store.list('conversations', { assemblyId: ASSEMBLY_IDS.earning })).map((c) => c.completedAt!.slice(0, 10)));
    expect(days.size).toBeGreaterThan(20);
  });
});
