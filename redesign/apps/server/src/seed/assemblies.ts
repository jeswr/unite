import { stableId, type AboutQuestion, type AffectedGroup, type Pledge } from '@unite/shared';
import { makeAssembly, makeInvite, type SeedCtx } from './builders.js';

/** The reference date of the seed (section 9): 13 November 2026. */
export const SEED_NOW = '2026-11-13T09:00:00.000Z';

/** Fixed ids of the five seeded assemblies, for the other seed files and for tests. */
export const ASSEMBLY_IDS = {
  open: stableId('asm', 'open'),
  earning: stableId('asm', 'earning-and-learning'),
  volunteering: stableId('asm', 'volunteering-tool'),
  aiAndCare: stableId('asm', 'ai-and-care'),
  feedback: stableId('asm', 'making-unite-better'),
} as const;

export const ASSEMBLY_SLUGS = {
  open: 'open',
  earning: 'earning-and-learning',
  volunteering: 'volunteering-tool',
  aiAndCare: 'ai-and-care',
  feedback: 'making-unite-better',
} as const;

/** The invitation code for each hosted example, so tests and the video can join as invited. */
export const INVITE_CODES = {
  earning: 'RIVERBEND-2026',
  volunteering: 'NORTHERN-VOLUNTEERS',
  aiAndCare: 'CARE-FUTURES',
} as const;

/* ------------------------------------------------------------- open listening */

export const OPEN_ABOUT: AboutQuestion[] = [
  { key: 'region', label: 'Where do you live?', options: ['Africa', 'Asia', 'Europe', 'Latin America and the Caribbean', 'Middle East', 'North America', 'Oceania'] },
  { key: 'age', label: 'How old are you?', options: ['Under 25', '25 to 49', '50 to 64', '65 or over'] },
];

/* ------------------------------------------------------------- earning and learning */

export const EARNING_ABOUT: AboutQuestion[] = [
  {
    key: 'work',
    label: 'Which is closest to your work at the moment?',
    options: ['I work shifts or nights', 'I work regular daytime hours', 'I am out of work', 'I run or manage a local business', 'I am studying', 'Something else'],
  },
  { key: 'care', label: 'Do you look after children or someone else at home?', options: ['Yes', 'No'] },
  { key: 'age', label: 'How old are you?', options: ['Under 25', '25 to 49', '50 or over'] },
];

export const EARNING_GROUPS: AffectedGroup[] = [
  { key: 'shift_workers', label: 'Shift workers', aboutKey: 'work', aboutValue: 'I work shifts or nights', target: 10 },
  { key: 'parents_carers', label: 'Parents and carers', aboutKey: 'care', aboutValue: 'Yes', target: 10 },
  { key: 'under_25', label: 'Under 25', aboutKey: 'age', aboutValue: 'Under 25', target: 10 },
  { key: 'over_50', label: 'Over 50', aboutKey: 'age', aboutValue: '50 or over', target: 8 },
  { key: 'out_of_work', label: 'Out of work', aboutKey: 'work', aboutValue: 'I am out of work', target: 6 },
  { key: 'local_employers', label: 'Local employers', aboutKey: 'work', aboutValue: 'I run or manage a local business', target: 4 },
];

export const EARNING_PLEDGE: Pledge = {
  setAside: '£250,000 of the 2027–28 adult skills budget, and the college’s evening and weekend timetable.',
  remit: 'Adult learning, council childcare hours, and the council’s own apprenticeships.',
  offTable: 'Wages at private employers and national benefit rules, because neither host controls them.',
  decisionLevel: 2,
  groupThreshold: 0.6,
  minParticipants: 40,
  capacity: 5,
  replyBy: '2026-12-18',
  checkBody: 'panel',
  reviewAfterDays: 365,
  publishedAt: '2026-09-01T09:00:00.000Z',
  challengeEndsAt: '2026-09-15T09:00:00.000Z',
};

/* ------------------------------------------------------------- volunteering tool */

export const VOLUNTEERING_ABOUT: AboutQuestion[] = [
  { key: 'role', label: 'How are you involved?', options: ['I volunteer', 'I organise volunteers for a group', 'Both'] },
  { key: 'group_size', label: 'How big is the group you are most involved with?', options: ['No paid staff', '1 to 10 paid staff', 'More than 10 paid staff'] },
];

export const VOLUNTEERING_GROUPS: AffectedGroup[] = [
  { key: 'volunteers', label: 'Volunteers', aboutKey: 'role', aboutValue: 'I volunteer', target: 15 },
  { key: 'organisers', label: 'People who organise volunteers', aboutKey: 'role', aboutValue: 'I organise volunteers for a group', target: 10 },
  { key: 'small_groups', label: 'Groups with no paid staff', aboutKey: 'group_size', aboutValue: 'No paid staff', target: 8 },
];

export const VOLUNTEERING_PLEDGE: Pledge = {
  setAside: 'A build budget of £60,000 for 2026–27, and a named product owner, Dele Okafor, two days a week.',
  remit: 'What the shared volunteering tool does, how it handles volunteers’ records, and the order things are built in.',
  offTable: 'Changing any member group’s own safeguarding rules, because each group is responsible for its own.',
  decisionLevel: 2,
  groupThreshold: 0.6,
  minParticipants: 30,
  capacity: 5,
  replyBy: '2026-06-30',
  checkBody: 'panel',
  reviewAfterDays: 365,
  publishedAt: '2026-02-02T09:00:00.000Z',
  challengeEndsAt: '2026-02-16T09:00:00.000Z',
};

/* ------------------------------------------------------------- AI and care */

export const AI_CARE_ABOUT: AboutQuestion[] = [
  { key: 'region', label: 'Where do you live?', options: ['Africa', 'Asia', 'Europe', 'Latin America and the Caribbean', 'North America', 'Oceania'] },
  { key: 'role', label: 'How are you involved in care?', options: ['I work in care', 'I look after a family member', 'I receive care', 'I run or manage a care service', 'Something else'] },
];

export const AI_CARE_GROUPS: AffectedGroup[] = [
  { key: 'africa', label: 'People in Africa', aboutKey: 'region', aboutValue: 'Africa', target: 40 },
  { key: 'asia', label: 'People in Asia', aboutKey: 'region', aboutValue: 'Asia', target: 40 },
  { key: 'europe', label: 'People in Europe', aboutKey: 'region', aboutValue: 'Europe', target: 40 },
  { key: 'latin_america', label: 'People in Latin America and the Caribbean', aboutKey: 'region', aboutValue: 'Latin America and the Caribbean', target: 40 },
  { key: 'north_america', label: 'People in North America', aboutKey: 'region', aboutValue: 'North America', target: 30 },
  { key: 'oceania', label: 'People in Oceania', aboutKey: 'region', aboutValue: 'Oceania', target: 20 },
];

export const AI_CARE_PLEDGE: Pledge = {
  setAside:
    'A written answer agreed by the board of every member organisation, and the coalition’s 2027 policy programme, which is held open until that answer is published.',
  remit: 'The coalition’s joint position on AI in care, and the guidance it gives its member unions, providers and family carer groups.',
  offTable: 'National laws on care funding, and the product decisions of software companies, because the coalition controls neither.',
  decisionLevel: 2,
  groupThreshold: 0.6,
  minParticipants: 200,
  capacity: 5,
  replyBy: '2027-05-28',
  checkBody: 'independent',
  checkBodyName: 'The Hollin Trust for Care Research (an invented independent body)',
  reviewAfterDays: 365,
  publishedAt: '2026-11-08T09:00:00.000Z',
  challengeEndsAt: '2026-11-22T09:00:00.000Z',
};

/* ------------------------------------------------------------- making Unite better */

export const FEEDBACK_PLEDGE: Pledge = {
  setAside: 'Maintainer time every month to read every piece of feedback and to answer the top priorities.',
  remit: 'How Unite works: its pages, its wording, its rules and its published prompts.',
  offTable: 'Anything that would mean collecting more personal data than Unite does now, because its privacy promises come first.',
  decisionLevel: 2,
  groupThreshold: 0.6,
  minParticipants: 20,
  capacity: 3,
  replyBy: '2027-02-26',
  checkBody: 'panel',
  reviewAfterDays: 180,
};

/** Writes the five assemblies of section 9, with their pledges, questions, probes, about questions and groups. */
export async function seedAssemblies(ctx: SeedCtx): Promise<void> {
  await makeAssembly(ctx, {
    id: ASSEMBLY_IDS.open,
    slug: ASSEMBLY_SLUGS.open,
    title: 'The lives people want',
    question: 'What does a good ordinary day look like for you, and what gets in the way?',
    summary:
      'Open listening is always on. Anyone can talk about their own life, with no question set by anyone else. What people approve joins a public picture of the lives people want and what stands in the way.',
    kind: 'listening',
    scale: 'global',
    hostName: '',
    hostSlug: '',
    hostDescription: '',
    stage: 'listening',
    isExample: true,
    isOpenListening: true,
    aboutQuestions: OPEN_ABOUT,
  });

  await makeAssembly(ctx, {
    id: ASSEMBLY_IDS.earning,
    slug: ASSEMBLY_SLUGS.earning,
    title: 'Earning and learning in Riverbend',
    question: 'What would let people here keep earning and keep learning as work changes?',
    summary:
      'Riverbend Council and Riverbend College want to know what would let people in the town keep earning and keep learning as jobs change, and have set aside money and timetable to act on the answer.',
    kind: 'codecided',
    scale: 'local',
    hostName: 'Riverbend Council and Riverbend College',
    hostSlug: 'riverbend-council-and-college',
    hostDescription: 'The council and the further education college of Riverbend, an invented town.',
    stage: 'deciding',
    isExample: true,
    probes: [
      'When did you last learn something that helped you at work, and how did it happen?',
      'What would have to change in your week for you to take a course?',
      'What do you already know how to do that nobody has written down?',
    ],
    aboutQuestions: EARNING_ABOUT,
    affectedGroups: EARNING_GROUPS,
    pledge: EARNING_PLEDGE,
    pictureConfirmedAt: '2026-10-20T09:00:00.000Z',
    pictureConfirmedBy: 'steward',
  });
  await makeInvite(ctx, { id: stableId('inv', 'earning'), assemblyId: ASSEMBLY_IDS.earning, code: INVITE_CODES.earning, label: 'Riverbend residents and employers' });

  await makeAssembly(ctx, {
    id: ASSEMBLY_IDS.volunteering,
    slug: ASSEMBLY_SLUGS.volunteering,
    title: 'A shared volunteering tool',
    question: 'What should a shared volunteering tool do for volunteers and the groups they help?',
    summary:
      'The Northern Volunteer Centres Network is building one tool for its member groups and their volunteers, and asked them what it should do first. Five decisions came out of it.',
    kind: 'technology',
    scale: 'sector',
    hostName: 'Northern Volunteer Centres Network',
    hostSlug: 'northern-volunteer-centres-network',
    hostDescription: 'An invented network of volunteer centres and the groups they support.',
    stage: 'delivering',
    isExample: true,
    probes: [
      'Think of the last time you started helping a new group. What happened in the first week?',
      'What do you have to do again and again that you wish you did once?',
    ],
    aboutQuestions: VOLUNTEERING_ABOUT,
    affectedGroups: VOLUNTEERING_GROUPS,
    pledge: VOLUNTEERING_PLEDGE,
    pictureConfirmedAt: '2026-04-10T09:00:00.000Z',
    pictureConfirmedBy: 'steward',
  });
  await makeInvite(ctx, { id: stableId('inv', 'volunteering'), assemblyId: ASSEMBLY_IDS.volunteering, code: INVITE_CODES.volunteering, label: 'Member groups and their volunteers' });

  await makeAssembly(ctx, {
    id: ASSEMBLY_IDS.aiAndCare,
    slug: ASSEMBLY_SLUGS.aiAndCare,
    title: 'AI and care',
    question: 'In looking after people, what should AI do and what should stay with humans?',
    summary:
      'Opened after a theme in open listening kept coming back: care workers with too little time for each person, and families wondering what machines will be asked to do. The pledge can be challenged until 22 November.',
    kind: 'advisory',
    scale: 'global',
    hostName: 'Care Futures Coalition',
    hostSlug: 'care-futures-coalition',
    hostDescription: 'An invented coalition of care workers’ unions, care providers and family carer groups in six countries.',
    stage: 'pledged',
    isExample: true,
    probes: [
      'Think of the last time you looked after someone, or were looked after. Which part of it could only a person have done?',
      'Which part of that day took time away from the person being cared for?',
      'If a machine did part of the work, what would you want to know about it?',
    ],
    aboutQuestions: AI_CARE_ABOUT,
    affectedGroups: AI_CARE_GROUPS,
    pledge: AI_CARE_PLEDGE,
  });
  await makeInvite(ctx, { id: stableId('inv', 'ai-and-care'), assemblyId: ASSEMBLY_IDS.aiAndCare, code: INVITE_CODES.aiAndCare, label: 'Coalition members' });

  await makeAssembly(ctx, {
    id: ASSEMBLY_IDS.feedback,
    slug: ASSEMBLY_SLUGS.feedback,
    title: 'Making Unite better',
    question: 'What would make Unite work better for you?',
    summary: 'Unite is run by its own loop. This assembly will decide what changes first, once the maintainers confirm the pledge.',
    kind: 'advisory',
    scale: 'platform',
    hostName: 'The Unite maintainers',
    hostSlug: 'unite-maintainers',
    hostDescription: 'The people who build and run Unite.',
    stage: 'proposed',
    isExample: false,
    probes: ['Think of the last time you used Unite. What were you trying to do, and what happened?', 'What did you expect to find that was not there?'],
    pledge: FEEDBACK_PLEDGE,
  });
}
