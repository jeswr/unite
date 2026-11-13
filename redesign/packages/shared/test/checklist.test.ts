import { describe, expect, it } from 'vitest';
import { pledgeProblems, stageChecklist, type Assembly, type Pledge, type StageFacts } from '../src/index.js';

const pledge: Pledge = {
  setAside: 'Money',
  remit: 'Learning',
  offTable: 'Wages',
  decisionLevel: 2,
  groupThreshold: 0.6,
  minParticipants: 4,
  capacity: 2,
  replyBy: '2026-12-18',
  checkBody: 'panel',
  reviewAfterDays: 365,
};
const base: Assembly = {
  id: 'asm_AAAAAAAAAAAA',
  slug: 'x',
  title: 'X',
  question: 'What would help?',
  summary: '',
  kind: 'advisory',
  scale: 'local',
  hostName: 'H',
  hostSlug: 'h',
  hostDescription: '',
  stage: 'proposed',
  isExample: false,
  isOpenListening: false,
  probes: [],
  aboutQuestions: [],
  affectedGroups: [{ key: 'young', label: 'Under 25', aboutKey: 'age', aboutValue: 'Under 25', target: 10 }],
  pledge,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  version: 1,
};
const facts: StageFacts = {
  completedConversations: 0,
  heardByGroup: {},
  openReports: 0,
  commonGroundStatements: 0,
  openRooms: 0,
  openObjections: 0,
  invitedParticipants: 0,
  priorityChoosers: 0,
  decisions: 0,
  decisionsAwaitingAnswer: 0,
  acceptedWithoutPlan: 0,
  acceptedWithoutCheck: 0,
};
const now = new Date('2026-11-13T09:00:00Z');

describe('pledgeProblems', () => {
  it('is empty for a complete pledge', () => expect(pledgeProblems(pledge)).toEqual([]));
  it('names what is missing', () => {
    expect(pledgeProblems(null)).toEqual(['There is no pledge yet']);
    expect(pledgeProblems({ ...pledge, remit: ' ', checkBody: 'independent' })).toHaveLength(2);
  });
});

describe('stageChecklist', () => {
  it('rule 6: proposed needs a complete pledge', () => {
    expect(stageChecklist(base, facts, now).clear).toBe(true);
    const c = stageChecklist({ ...base, pledge: null }, facts, now);
    expect(c.clear).toBe(false);
    expect(c.items.find((i) => i.key === 'pledge_complete')?.met).toBe(false);
    expect(stageChecklist({ ...base, pledge: { ...pledge, setAside: '' } }, facts, now).clear).toBe(false);
  });
  it('proposed refuses leading wording', () => {
    expect(stageChecklist({ ...base, probes: ["Don't you think buses matter?"] }, facts, now).clear).toBe(false);
  });
  it('pledged waits for the challenge period', () => {
    const a = { ...base, stage: 'pledged' as const, pledge: { ...pledge, challengeEndsAt: '2026-11-22T09:00:00.000Z' } };
    expect(stageChecklist(a, facts, now).clear).toBe(false);
    expect(stageChecklist(a, facts, new Date('2026-11-23T00:00:00Z')).clear).toBe(true);
  });
  it('listening needs enough people and half of each group', () => {
    const a = { ...base, stage: 'listening' as const };
    expect(stageChecklist(a, { ...facts, completedConversations: 4, heardByGroup: { young: 4 } }, now).clear).toBe(false);
    expect(stageChecklist(a, { ...facts, completedConversations: 4, heardByGroup: { young: 5 } }, now).clear).toBe(true);
  });
  it('deciding: half chose, or two weeks before the reply date', () => {
    const a = { ...base, stage: 'deciding' as const };
    const f = { ...facts, invitedParticipants: 10, priorityChoosers: 4, decisions: 1 };
    expect(stageChecklist(a, f, now).clear).toBe(false);
    expect(stageChecklist(a, { ...f, priorityChoosers: 5 }, now).clear).toBe(true);
    expect(stageChecklist(a, f, new Date('2026-12-04T00:00:00Z')).clear).toBe(true);
  });
  it('review is the last stage', () => {
    const c = stageChecklist({ ...base, stage: 'review' }, facts, now);
    expect(c.next).toBeUndefined();
    expect(c.clear).toBe(false);
  });
});
