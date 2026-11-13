import type { ReactionValue } from '@unite/shared';

/**
 * The volunteering tool from statements to a checked delivery. Timeline (2026): pledge published
 * 2 February; conversations 17 February to 31 March; picture confirmed 10 April; statements
 * 14 April; priorities closed 15 May; decisions written 20 May; every decision answered 24 June,
 * before the pledged reply date of 30 June; build proposals in July; Decision 1 delivered in
 * September and checked on 4 November.
 */

export type VKey = 'V1' | 'V2' | 'V3' | 'V4' | 'V5' | 'V6';

export const VOLUNTEERING_STATEMENTS: { key: VKey; text: string; themes: string[]; from: string[]; status: 'decided' | 'no_agreement' }[] = [
  {
    key: 'V1',
    text: 'A volunteer proves who they are once and can share that proof with any group they choose.',
    themes: ['once', 'repeat', 'privacy'],
    from: ['hassan/1', 'gwen/3', 'qasim/3', 'kieran/3', 'lowri/2', 'aisha/1', 'eilidh/1', 'una/2'],
    status: 'decided',
  },
  {
    key: 'V2',
    text: 'Hours given are recorded by the volunteer, confirmed by the group, and belong to the volunteer.',
    themes: ['hours'],
    from: ['delroy/3', 'gloria/2', 'qasim/2', 'farah/3', 'tariq/2', 'zofia/2'],
    status: 'decided',
  },
  {
    key: 'V3',
    text: 'A group with no paid staff can start using it in ten minutes without training.',
    themes: ['small', 'phone'],
    from: ['elaine/1', 'ceri/1', 'wendy/1', 'janet/1', 'pat/2', 'huw/3'],
    status: 'decided',
  },
  {
    key: 'V4',
    text: 'The tool works in Welsh, Urdu and Polish from the first release.',
    themes: ['language', 'translate'],
    from: ['bryn/1', 'farah/1', 'zofia/1', 'rhiannon/1', 'lowri/1', 'kasia/1'],
    status: 'decided',
  },
  {
    key: 'V5',
    text: 'The network pays volunteers’ travel costs through the tool.',
    themes: ['travel'],
    from: ['malik/2', 'bilal/1', 'qasim/1', 'pat/3', 'wendy/3', 'frank/2'],
    status: 'decided',
  },
  {
    key: 'V6',
    text: 'Groups should be able to see how reliable a volunteer has been with other groups.',
    themes: ['turnup'],
    from: ['nasreen/1', 'kasia/3', 'adebayo/2', 'janet/2'],
    status: 'no_agreement',
  },
];

/** How people answered: a usual answer, and who answered otherwise. Everyone answered every statement. */
export const VOLUNTEERING_REACTIONS: Record<VKey, { usual: ReactionValue; except: Record<string, ReactionValue> }> = {
  V1: { usual: 'agree', except: { ceri: 'disagree', frank: 'disagree', shirley: 'unsure', nasreen: 'unsure' } },
  V2: { usual: 'agree', except: { oliver: 'disagree', colin: 'unsure', huw: 'unsure', imogen: 'unsure' } },
  V3: { usual: 'agree', except: { kieran: 'disagree', delroy: 'unsure', una: 'unsure' } },
  V4: { usual: 'agree', except: { bilal: 'disagree', aisha: 'unsure', gloria: 'unsure' } },
  V5: { usual: 'agree', except: { gwen: 'disagree', tariq: 'disagree', eilidh: 'unsure', jolanta: 'unsure', kasia: 'unsure' } },
  V6: {
    usual: 'unsure',
    except: {
      nasreen: 'agree', kasia: 'agree', adebayo: 'agree', janet: 'agree', wendy: 'agree', gwen: 'agree', pat: 'agree', elaine: 'agree',
      una: 'disagree', malik: 'disagree', bilal: 'disagree', colin: 'disagree', rhiannon: 'disagree', huw: 'disagree', jolanta: 'disagree', imogen: 'disagree', yasmin: 'disagree', hassan: 'disagree',
    },
  },
};

/** Thirty people’s priority choices, made between 1 and 15 May 2026. */
export const VOLUNTEERING_PRIORITIES: [string, VKey[]][] = [
  ...(['aisha', 'delroy', 'lowri', 'una', 'yasmin', 'adebayo', 'kieran', 'eilidh'].map((p) => [p, ['V1', 'V2', 'V3']]) as [string, VKey[]][]),
  ...(['hassan', 'gloria', 'qasim', 'malik'].map((p) => [p, ['V1', 'V2']]) as [string, VKey[]][]),
  ...(['jolanta', 'zofia', 'dorota'].map((p) => [p, ['V1', 'V4']]) as [string, VKey[]][]),
  ...(['iqra', 'imogen', 'tariq'].map((p) => [p, ['V2']]) as [string, VKey[]][]),
  ...(['elaine', 'pat', 'wendy'].map((p) => [p, ['V3', 'V5']]) as [string, VKey[]][]),
  ...(['ceri', 'janet', 'gwen'].map((p) => [p, ['V1', 'V3', 'V5']]) as [string, VKey[]][]),
  ...(['bryn', 'rhiannon', 'huw'].map((p) => [p, ['V4']]) as [string, VKey[]][]),
  ...(['farah', 'kasia'].map((p) => [p, ['V2', 'V4']]) as [string, VKey[]][]),
  ['oliver', ['V1']],
];

export const PRODUCT_OWNER = 'Dele, product owner, for the Northern Volunteer Centres Network';
const ANSWERED_AT = '2026-06-24T15:00:00.000Z';
const CO_OP = 'Kestrel Lane Co-operative (an invented software co-operative)';

export interface DecisionContent {
  n: 1 | 2 | 3 | 4 | 5;
  statement: VKey;
  why: string;
  options: string[];
  dissent: string;
  tests: string[];
  delivery: ('technology' | 'social')[];
  status: 'delivered_minor_changes' | 'in_progress' | 'delayed' | 'refused';
  updatedAt: string;
  answer: { kind: 'accepted' | 'changed' | 'delayed' | 'refused'; reasons: string; changedTo?: string; delayedUntil?: string };
}

export const DECISIONS: DecisionContent[] = [
  {
    n: 1,
    statement: 'V1',
    why: 'Volunteers told us they had been through the same identity check up to five times for different groups, and some gave up before their first shift. Organisers said they repeat checks only because they cannot see what another group has already done.',
    options: [
      'Each group keeps running its own checks, as now.',
      'The network keeps one central record of checks that every member group can search.',
      'The volunteer holds proof of their check and chooses which groups can see it.',
    ],
    dissent:
      'Some organisers of groups that work with children want to keep running their own checks as well. Some volunteers worried that a shared record could be seen by people they would not choose. Both concerns are reflected in the tests.',
    tests: [
      'A volunteer checked by one group can start with a second group without a new identity check.',
      'The volunteer can see which groups have looked at their record.',
      'The volunteer can withdraw a group’s access at any time.',
    ],
    delivery: ['technology', 'social'],
    status: 'delivered_minor_changes',
    updatedAt: '2026-11-04T16:00:00.000Z',
    answer: {
      kind: 'accepted',
      reasons:
        'We accept this as written. It was the change volunteers asked for most, it is within the build budget, and it is what the tool is for. Groups that must run their own checks by law or for a funder can still do so: the tool will show them that a check was done elsewhere and when, and leave the choice to them.',
    },
  },
  {
    n: 2,
    statement: 'V2',
    why: 'Volunteers want a record of their hours they can show to employers, colleges and benefit offices. Today hours are kept in each group’s own spreadsheet, or in volunteers’ notebooks, and they are lost when a volunteer moves on.',
    options: ['Groups record hours and keep them, as now.', 'Volunteers record their own hours with no confirmation.', 'Volunteers record hours, the group confirms them, and the record belongs to the volunteer.'],
    dissent: 'A few organisers worry about the time it takes to confirm hours. The tests ask for confirming to take one tap.',
    tests: [
      'A volunteer can record hours given on a phone in under a minute.',
      'The group can confirm or query recorded hours with one tap.',
      'The volunteer can download their confirmed hours, and keep them after leaving a group.',
    ],
    delivery: ['technology'],
    status: 'in_progress',
    updatedAt: '2026-11-10T12:00:00.000Z',
    answer: {
      kind: 'accepted',
      reasons: 'We accept this as written. It costs little to build alongside Decision 1, and it gives volunteers something of their own to take away.',
    },
  },
  {
    n: 3,
    statement: 'V3',
    why: 'Most member groups have no paid staff. Organisers told us earlier systems failed because they needed training nobody had time for. If small groups cannot start in minutes, the tool will not reach the volunteers who need it.',
    options: ['Build for larger groups first and add a simple version later.', 'Build phone and desktop versions together.', 'Build the phone version first, then desktop.'],
    dissent: 'Organisers in larger groups wanted desktop at the same time, because their staff work at desks.',
    tests: [
      'An organiser of a group with no paid staff, given only the web address, can set up the group and add a first volunteer in ten minutes.',
      'Nobody needs a manual, a video or a training session to do so.',
      'It works on a five-year-old phone with a weak signal.',
    ],
    delivery: ['technology'],
    status: 'in_progress',
    updatedAt: '2026-11-06T10:00:00.000Z',
    answer: {
      kind: 'changed',
      changedTo:
        'A group with no paid staff can start using it on a phone in ten minutes without training. The desktop version follows, meeting the same ten-minute test, by June 2027.',
      reasons:
        'We have changed this to phone first, desktop later. Organisers of small groups told us they do volunteer admin on their phones, often on the bus or at the venue. Building both at once would have used the money we need for Decision 4. We would rather do one version properly than two badly. Larger groups can use the phone version on a desktop browser in the meantime, though it will not look its best.',
    },
  },
  {
    n: 4,
    statement: 'V4',
    why: 'Welsh, Urdu and Polish speakers, and their families, told us the English-only forms put them off or made them depend on someone else to sign up.',
    options: ['English only.', 'Machine translation of every screen.', 'Welsh, Urdu and Polish, checked by people fluent in each language.'],
    dissent: 'Some volunteers asked why these three languages and not others, such as Ukrainian and Punjabi. The network has said other languages will be considered at the review.',
    tests: [
      'Every screen a volunteer sees, including the consent and safeguarding wording, is available in Welsh, Urdu and Polish.',
      'The wording in each language has been checked by at least two people fluent in it.',
      'A volunteer can switch language on any screen without losing what they have entered.',
    ],
    delivery: ['technology', 'social'],
    status: 'delayed',
    updatedAt: ANSWERED_AT,
    answer: {
      kind: 'delayed',
      delayedUntil: '2027-03-31',
      reasons:
        'We will do this, but not in the first release, and we are sorry. The consent and safeguarding wording must be right in every language, and the quote we had for checking it by qualified translators was £14,000, more than the budget we have left this year. We have asked member groups in Wrexham, Bradford and Rotherham for fluent volunteers to help review the wording, and set the money aside in the 2027–28 budget. Until then sign-up is in English only, which we know still shuts some people out.',
    },
  },
  {
    n: 5,
    statement: 'V5',
    why: 'Volunteers pay their own bus fares and petrol, and organisers said some people stop coming because of it.',
    options: ['The network pays travel costs through the tool.', 'Each group pays its own volunteers’ costs, as now.', 'The tool shows each group’s travel policy before a volunteer signs up.'],
    dissent: 'Many volunteers, and several organisers, strongly want travel costs paid.',
    tests: ['A volunteer can claim travel costs in the tool and be paid within 14 days.', 'Every claim is paid from a network budget, not the group’s own funds.'],
    delivery: ['technology'],
    status: 'refused',
    updatedAt: ANSWERED_AT,
    answer: {
      kind: 'refused',
      reasons:
        'We refuse this. The network has no budget line for travel costs: our funding covers the tool and the centres, not volunteers’ expenses. Whether to pay expenses is each member group’s own decision, and the pledge left that outside what this assembly could decide. Promising payments through the tool would mean promising money we do not have. What we will do instead: from the first release, each group’s page will show its travel policy, what it pays and what it does not, before a volunteer signs up, so nobody finds out after their first shift that they will be out of pocket. We will also publish how many groups pay travel, so funders can see the gap.',
    },
  },
];

export const PROPOSALS = [
  {
    key: 'd1-chosen',
    decision: 1,
    proposerName: CO_OP,
    proposerRole: 'Software co-operative: three developers and a designer',
    summary: 'Each volunteer keeps proof of their check in their own account and shares it with a group by sending a link. Every look is logged and shown to the volunteer, and the volunteer can switch any group’s access off.',
    plan:
      'Weeks 1 to 3: the volunteer account and the “checked” proof, with the date of the check and the group that did it. Weeks 4 to 6: sharing by link, the access log and withdrawing access. Weeks 7 to 8: try it with two member groups in Bradford, fix what they find, then release to all groups. Much of the code will be written with AI coding agents; Nkechi, the co-operative’s lead developer, reviews every change and is accountable for each one. Guidance for groups on accepting a check done elsewhere is written with the network’s volunteer centre managers.',
    cost: '£18,500 of the £60,000 build budget',
    testCoverage: [
      { n: 1, how: 'A group that receives a shared link sees the check, its date and who did it, and can accept the volunteer without a new check.' },
      { n: 2, how: 'Each time a group opens the record, the volunteer’s access log shows the group’s name and the date.' },
      { n: 3, how: 'A “Stop sharing” button beside each group removes its access at once; the group sees that access was withdrawn.' },
    ],
    status: 'chosen' as const,
    faithfulConfirmedAt: '2026-07-22T10:00:00.000Z',
  },
  {
    key: 'd1-other',
    decision: 1,
    proposerName: 'Pennine Records Ltd (an invented software company)',
    proposerRole: 'Software company that builds membership systems',
    summary: 'A central register of checks held by the network, which any member group can search by a volunteer’s name and date of birth.',
    plan:
      'Adapt the company’s existing membership register for volunteering checks. Member groups search it before taking someone on. The volunteer can ask the network for a copy of what is held about them.',
    cost: '£12,000 of the £60,000 build budget, plus £3,000 a year',
    testCoverage: [
      { n: 1, how: 'Any group can search the register and see that a check exists.' },
      { n: 2, how: 'Volunteers can request a report of searches made on their record.' },
      { n: 3, how: 'Not covered: groups could still search the register after a volunteer asked them not to.' },
    ],
    status: 'not_chosen' as const,
  },
  {
    key: 'd2-chosen',
    decision: 2,
    proposerName: CO_OP,
    proposerRole: 'Software co-operative: three developers and a designer',
    summary: 'Volunteers log hours on their phone; the group gets a one-tap confirm or query; confirmed hours sit in the volunteer’s account and can be downloaded.',
    plan: 'Build on the volunteer account from Decision 1. Hours are stored in the format of the shared volunteering data standard so other tools can read them.',
    cost: '£9,000 of the £60,000 build budget',
    testCoverage: [
      { n: 1, how: 'A three-field form on the phone: group, date, hours.' },
      { n: 2, how: 'A notification to the group’s organiser with Confirm and Query buttons.' },
      { n: 3, how: 'A download of confirmed hours as a file the volunteer keeps, which stays available after leaving a group.' },
    ],
    status: 'chosen' as const,
    faithfulConfirmedAt: '2026-07-22T10:00:00.000Z',
  },
  {
    key: 'd3-chosen',
    decision: 3,
    proposerName: CO_OP,
    proposerRole: 'Software co-operative: three developers and a designer',
    summary: 'A phone-first sign-up for small groups: four screens, no manual, tested by timing real organisers.',
    plan: 'Design the sign-up with six small groups, timing each organiser from the web address to their first volunteer added. Cut steps until every organiser finishes in ten minutes. Desktop layout follows in 2027.',
    cost: '£11,000 of the £60,000 build budget',
    testCoverage: [
      { n: 1, how: 'Timed trials with organisers of groups with no paid staff, repeated after every change.' },
      { n: 2, how: 'No help text longer than one sentence; trials are run with no explanation given.' },
      { n: 3, how: 'Trials include a five-year-old phone on a throttled connection.' },
    ],
    status: 'chosen' as const,
    faithfulConfirmedAt: '2026-07-22T10:00:00.000Z',
  },
];

export const DELIVERY = [
  {
    key: 'd1-proof',
    decision: 1,
    title: 'Proof of a check that the volunteer holds and shares',
    kind: 'technology' as const,
    owner: 'Nkechi, Kestrel Lane Co-operative',
    dueDate: '2026-09-11',
    status: 'done' as const,
    updates: [
      { at: '2026-07-29T16:00:00.000Z', text: 'Started. The first version is switched on for two groups in Bradford only.' },
      { at: '2026-08-26T16:00:00.000Z', text: 'Tried with 14 volunteers moving between a food bank and a youth club. Two found the share link confusing, so its wording was changed.' },
      { at: '2026-09-10T16:00:00.000Z', text: 'Released to all member groups.' },
    ],
  },
  {
    key: 'd1-log',
    decision: 1,
    title: 'Access log and “Stop sharing” for volunteers',
    kind: 'technology' as const,
    owner: 'Nkechi, Kestrel Lane Co-operative',
    dueDate: '2026-09-25',
    status: 'done' as const,
    updates: [
      { at: '2026-09-04T16:00:00.000Z', text: 'The log shows which group opened the record and when. Stop sharing works straight away.' },
      {
        at: '2026-09-24T16:00:00.000Z',
        text: 'Released. The log shows the group but not which member of its staff looked: that needs groups to give each person their own login, which most small groups do not have yet.',
      },
    ],
  },
  {
    key: 'd1-guide',
    decision: 1,
    title: 'Guidance for groups on accepting a check done elsewhere',
    kind: 'social' as const,
    owner: 'Gwen, volunteer centre manager, with the network’s centre managers',
    dueDate: '2026-10-02',
    status: 'done' as const,
    updates: [
      { at: '2026-09-15T16:00:00.000Z', text: 'Draft shared with twelve member groups for comment.' },
      { at: '2026-10-01T16:00:00.000Z', text: 'Published in the tool and sent to every member group. Groups that work with children were consulted on the section about extra checks.' },
    ],
  },
  {
    key: 'd2-log',
    decision: 2,
    title: 'Record hours on a phone; groups confirm with one tap',
    kind: 'technology' as const,
    owner: 'Nkechi, Kestrel Lane Co-operative',
    dueDate: '2026-12-11',
    status: 'in_progress' as const,
    updates: [
      { at: '2026-10-05T16:00:00.000Z', text: 'Started after Decision 1 was released.' },
      { at: '2026-11-10T12:00:00.000Z', text: 'Recording works. Confirming is two taps, not one, because of a privacy check; the co-operative is working on it before the trial.' },
    ],
  },
  {
    key: 'd2-export',
    decision: 2,
    title: 'Download your confirmed hours',
    kind: 'technology' as const,
    owner: 'Nkechi, Kestrel Lane Co-operative',
    dueDate: '2027-01-29',
    status: 'planned' as const,
    updates: [
      {
        at: '2026-10-20T16:00:00.000Z',
        text: 'Planned. The download will follow the data standard for volunteering records, which is governed in Concord, so other tools and future employers can read it.',
      },
    ],
  },
  {
    key: 'd3-signup',
    decision: 3,
    title: 'Phone sign-up for groups with no paid staff',
    kind: 'technology' as const,
    owner: 'Kestrel Lane Co-operative, with six small groups',
    dueDate: '2026-12-18',
    status: 'in_progress' as const,
    updates: [
      { at: '2026-09-30T16:00:00.000Z', text: 'First timed trial with six organisers: the middle time was 19 minutes. The longest steps were adding a logo and choosing roles.' },
      { at: '2026-11-06T10:00:00.000Z', text: 'Second trial: middle time 14 minutes after cutting two steps. Still above ten minutes, so not done.' },
    ],
  },
];

/** The check of Decision 1 by five participants drawn by lot. */
export const CHECK_D1 = {
  panel: ['oliver', 'farah', 'delroy', 'ceri', 'tariq'],
  checkBody: 'Check panel of five participants drawn by lot',
  checkedAt: '2026-11-04T16:00:00.000Z',
  results: [
    { n: 1, met: true, note: 'Three panel members joined a second group using a shared link. None was asked for a new identity check.' },
    {
      n: 2,
      met: false,
      note: 'Not fully met. Volunteers can see which groups opened their record and when, but not which member of staff. Panel members said they expected to see the person, and the delivery notes say this is not built yet.',
    },
    { n: 3, met: true, note: 'Stopping sharing removed the group’s access at once, in all four tries.' },
  ],
  classification: 'minor_changes' as const,
  summary:
    'Delivered with minor changes. Tests 1 and 3 are met. Test 2 is met for groups but not yet for individual staff. The panel asks the network to show which member of staff looked once groups have individual logins, and to report on it at the review.',
};
