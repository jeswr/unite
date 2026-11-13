import type { ReactionValue } from '@unite/shared';

/**
 * Riverbend after the picture: the statements, how people answered, reasons, the two rooms, the
 * evidence, the objection, the report and the priority choices.
 */

export type StatementKey = 'S1' | 'S2' | 'S2b' | 'S3' | 'S4' | 'S5' | 'S6' | 'S7' | 'S8';

export interface EarningStatement {
  key: StatementKey;
  text: string;
  themes: string[];
  /** Point references `personKey/n`. */
  from: string[];
  createdAt: string;
  status: 'common_ground' | 'differ' | 'not_enough';
}

/** The statements of section 9, word for word, in the order they were written. */
export const EARNING_STATEMENTS: EarningStatement[] = [
  {
    key: 'S1',
    text: 'People who work nights or rotating shifts should be able to take any core course at a time that fits their shift.',
    themes: ['classes', 'catchup'],
    from: ['kofi/2', 'sandra/1', 'bev/1', 'tomasz/1', 'ewa/1', 'dean/1', 'gemma/1', 'ewa/2', 'priya/3'],
    createdAt: '2026-10-21T10:00:00.000Z',
    status: 'common_ground',
  },
  {
    key: 'S2',
    text: 'Nobody should have to lose pay to retrain for a job that is disappearing.',
    themes: ['earning'],
    from: ['ibrahim/1', 'ade/2', 'rosa/2', 'kev/1', 'carl/2', 'precious/2'],
    createdAt: '2026-10-21T10:01:00.000Z',
    status: 'differ',
  },
  {
    key: 'S3',
    text: 'Skills people already have from work and from caring should count toward a qualification without sitting the course again.',
    themes: ['counts'],
    from: ['grace/3', 'paul/3', 'darren/3', 'stuart/2', 'sam/1', 'mei/2'],
    createdAt: '2026-10-21T10:02:00.000Z',
    status: 'common_ground',
  },
  {
    key: 'S4',
    text: 'The college should teach in workplaces and community halls, and not only on campus.',
    themes: ['bring'],
    from: ['lucy/3', 'kofi/4', 'marek/3', 'hamid/3', 'gareth/4'],
    createdAt: '2026-10-21T10:03:00.000Z',
    status: 'common_ground',
  },
  {
    key: 'S5',
    text: 'Everyone should be taught to use AI tools as a basic skill, like reading.',
    themes: ['aiuse'],
    from: ['owen/2', 'jo/3', 'sunita/3', 'nicole/3', 'kev/2', 'priya/4', 'mo/4'],
    createdAt: '2026-10-21T10:04:00.000Z',
    status: 'differ',
  },
  {
    key: 'S6',
    text: 'Childcare should be available during any funded class.',
    themes: ['childcare', 'creche'],
    from: ['aaliyah/1', 'shabnam/1', 'kerry/1', 'zainab/1', 'lucy/2', 'kerry/2', 'shabnam/3'],
    createdAt: '2026-10-21T10:05:00.000Z',
    status: 'common_ground',
  },
  {
    key: 'S7',
    text: 'Courses should be chosen by what local employers say they need.',
    themes: ['askus', 'nojob'],
    from: ['jas/3', 'femi/1', 'mei/1', 'darren/4', 'chloe/1'],
    createdAt: '2026-10-21T10:06:00.000Z',
    status: 'differ',
  },
  {
    key: 'S2b',
    text: 'Workers in roles their employer expects to change should get paid learning hours, with the cost shared between the employer and the skills fund.',
    themes: ['earning', 'paidhours'],
    from: ['ibrahim/1', 'ibrahim/2', 'tomasz/4', 'helen/1', 'precious/4', 'gemma/3', 'jas/2'],
    createdAt: '2026-10-30T09:00:00.000Z',
    status: 'common_ground',
  },
  {
    key: 'S8',
    text: 'People under 25 should help choose what the college teaches.',
    themes: ['young'],
    from: ['chloe/2', 'aaliyah/3', 'ryan/3'],
    createdAt: '2026-11-02T09:00:00.000Z',
    status: 'not_enough',
  },
];

/**
 * The people who, by how they answered, form the smaller of the two opinion groups: mostly the
 * employers and those who think like them on pay, AI and who chooses courses. Everyone else in
 * Riverbend forms the larger group. (Kept here so the reactions below can be read; the groups
 * themselves are computed from the reactions by `opinionGroups`.)
 */
export const EARNING_GROUP_B = ['jas', 'mo', 'helen', 'femi', 'mei', 'gareth', 'jo', 'terry', 'owen', 'paul', 'chloe', 'nicole', 'sunita', 'liam', 'stuart'];

export interface ReactionPlan {
  /** Who answered; everyone when absent. */
  only?: string[];
  /** Who did not answer. */
  skip?: string[];
  a: ReactionValue;
  b: ReactionValue;
  except: Record<string, ReactionValue>;
}

/** How each person answered each statement: a usual answer for each group, and who answered otherwise. */
export const EARNING_REACTIONS: Record<StatementKey, ReactionPlan> = {
  S1: { a: 'agree', b: 'agree', except: { maureen: 'unsure', joyce: 'unsure', sam: 'disagree', gareth: 'disagree', mo: 'disagree', helen: 'disagree', jo: 'disagree' } },
  S2: { a: 'agree', b: 'disagree', except: { zainab: 'disagree', nadia: 'disagree', maureen: 'unsure', lucy: 'unsure', paul: 'agree', liam: 'agree', nicole: 'unsure' } },
  S2b: {
    skip: ['marek', 'hamid', 'faith', 'joyce', 'maureen', 'sam', 'dean', 'lucy', 'nadia', 'zainab', 'carl', 'terry', 'stuart', 'sunita'],
    a: 'agree',
    b: 'agree',
    except: { kev: 'unsure', chloe: 'disagree', jo: 'disagree', liam: 'disagree' },
  },
  S3: { a: 'agree', b: 'agree', except: { kev: 'unsure', ryan: 'unsure', dean: 'unsure', carl: 'unsure', priya: 'disagree', shabnam: 'disagree', terry: 'disagree', mei: 'disagree', liam: 'disagree', femi: 'disagree' } },
  S4: {
    skip: ['joyce', 'sam', 'mo'],
    a: 'agree',
    b: 'agree',
    except: { kerry: 'unsure', aaliyah: 'unsure', bev: 'unsure', priya: 'disagree', ade: 'disagree', chloe: 'disagree', nicole: 'disagree', helen: 'disagree' },
  },
  S5: {
    a: 'disagree',
    b: 'agree',
    except: {
      ewa: 'agree', yusuf: 'agree', aaliyah: 'agree', ryan: 'agree', dean: 'agree', lucy: 'agree', tomasz: 'agree', ibrahim: 'agree', precious: 'agree',
      kerry: 'unsure', grace: 'unsure',
      gareth: 'disagree', mo: 'disagree', terry: 'disagree',
    },
  },
  S6: { a: 'agree', b: 'agree', except: { marek: 'unsure', dean: 'unsure', carl: 'unsure', kev: 'disagree', yusuf: 'disagree', paul: 'disagree', stuart: 'disagree', jas: 'disagree', sunita: 'disagree' } },
  S7: {
    skip: ['sam'],
    a: 'disagree',
    b: 'agree',
    except: {
      kofi: 'agree', bev: 'agree', hamid: 'agree', marek: 'agree', faith: 'agree', sandra: 'agree', carl: 'agree',
      ryan: 'unsure', tomasz: 'unsure',
      chloe: 'unsure', sunita: 'unsure', owen: 'disagree',
    },
  },
  S8: { only: ['ryan', 'aaliyah', 'ewa', 'kerry', 'dean', 'chloe', 'owen'], a: 'agree', b: 'agree', except: { kerry: 'unsure', dean: 'unsure', owen: 'unsure' } },
};

/** When each statement's answers came in: [first day, last day]. */
export const REACTION_WINDOWS: Record<StatementKey, [string, string]> = {
  S1: ['2026-10-21', '2026-11-06'],
  S2: ['2026-10-21', '2026-10-28'],
  S3: ['2026-10-21', '2026-11-06'],
  S4: ['2026-10-21', '2026-11-07'],
  S5: ['2026-10-21', '2026-11-08'],
  S6: ['2026-10-22', '2026-11-08'],
  S7: ['2026-10-22', '2026-11-09'],
  S2b: ['2026-10-30', '2026-11-10'],
  S8: ['2026-11-02', '2026-11-12'],
};

/** Reasons for and against, in the order they arrived. */
export const EARNING_REASONS: { key: string; statement: StatementKey; person: string; side: 'for' | 'against'; text: string; at: string }[] = [
  { key: 'S5-1', statement: 'S5', person: 'owen', side: 'for', text: 'I’d rather know how to use these tools than be replaced by someone who does. Teach it early and to everyone.', at: '2026-10-22T19:12:00.000Z' },
  { key: 'S5-2', statement: 'S5', person: 'kev', side: 'against', text: 'Like reading? Reading doesn’t change every six months. Teach people to think and check, not to use this year’s app.', at: '2026-10-22T23:40:00.000Z' },
  { key: 'S5-3', statement: 'S5', person: 'jo', side: 'for', text: 'If I understand the software, I’m the one who checks it. That’s a job. If I don’t, I’m the one it replaces.', at: '2026-10-23T12:05:00.000Z' },
  { key: 'S5-4', statement: 'S5', person: 'sandra', side: 'against', text: 'I need a level 3 in care, not a lesson on chatbots. Please don’t spend the care money on this.', at: '2026-10-24T09:30:00.000Z' },
  { key: 'S5-5', statement: 'S5', person: 'femi', side: 'for', text: 'My cleaners already get their rotas and payslips through an app. Basic know-how would save a lot of panicked phone calls.', at: '2026-10-25T08:15:00.000Z' },
  { key: 'S5-6', statement: 'S5', person: 'gareth', side: 'against', text: 'Every few years there’s a new must-have skill. Five years ago it was coding. The money should go on things that last.', at: '2026-10-26T17:50:00.000Z' },
  { key: 'S5-7', statement: 'S5', person: 'mo', side: 'against', text: 'Plenty of people still can’t fill in an online form. Start there before AI.', at: '2026-10-28T14:20:00.000Z' },
  { key: 'S5-8', statement: 'S5', person: 'nicole', side: 'for', text: 'Our surgery brought in an online system with no training at all. A short basic course would have saved weeks of mess.', at: '2026-10-31T13:10:00.000Z' },
  { key: 'S5-9', statement: 'S5', person: 'terry', side: 'against', text: 'The diagnostics computer was wrong about my gearbox. Learn the trade first, then the tool.', at: '2026-11-03T07:45:00.000Z' },
  { key: 'S5-10', statement: 'S5', person: 'chloe', side: 'for', text: 'It’s not optional any more. Everyone my age uses it already, just badly. Teach it properly.', at: '2026-11-05T21:30:00.000Z' },
  { key: 'S7-1', statement: 'S7', person: 'helen', side: 'for', text: 'If courses don’t lead to a job here, people do them and leave. Ask the employers what they will actually hire for.', at: '2026-10-22T11:00:00.000Z' },
  { key: 'S7-2', statement: 'S7', person: 'darren', side: 'against', text: 'Employers asked for print and parcel staff for thirty years. Then the machines came. They don’t know the future either.', at: '2026-10-22T16:25:00.000Z' },
  { key: 'S7-3', statement: 'S7', person: 'jas', side: 'for', text: 'I’ve got a job going right now for someone who can work on electric cars. Nobody local is trained for it.', at: '2026-10-23T18:40:00.000Z' },
  { key: 'S7-4', statement: 'S7', person: 'priya', side: 'against', text: 'Employers will ask for what they need this year. Learners need things that will still count in ten.', at: '2026-10-24T20:05:00.000Z' },
  { key: 'S7-5', statement: 'S7', person: 'ade', side: 'against', text: 'If only employers choose, it’s training for their jobs in our own time. We should have a say too.', at: '2026-10-27T10:35:00.000Z' },
  { key: 'S7-6', statement: 'S7', person: 'mei', side: 'for', text: 'Short courses that match real vacancies get people working sooner. That’s what most people tell me they want.', at: '2026-10-29T09:55:00.000Z' },
  { key: 'S7-7', statement: 'S7', person: 'grace', side: 'against', text: 'No employer asked for carers to become nurses. We had to push for it ourselves.', at: '2026-11-01T06:50:00.000Z' },
  { key: 'S7-8', statement: 'S7', person: 'paul', side: 'for', text: 'I don’t need a hobby. I need a course that somebody will hire me after.', at: '2026-11-04T15:15:00.000Z' },
  { key: 'S7-9', statement: 'S7', person: 'shabnam', side: 'against', text: 'What about people who want to start something of their own? No employer is going to ask for that.', at: '2026-11-07T12:30:00.000Z' },
];

/* ------------------------------------------------------------------ the closed room on S2 */

export const ROOM_S2 = {
  topic: 'Should anyone have to lose pay to retrain for a job that is disappearing?',
  members: ['ibrahim', 'kerry', 'precious', 'helen', 'mo', 'femi'],
  startedAt: '2026-10-29T18:30:00.000Z',
  endsAt: '2026-10-29T19:15:00.000Z',
  briefing: {
    summary:
      'People answered this statement very differently. Most workers agreed; most employers disagreed. This room looks at why, and whether a different wording could work for both.',
    forSide: [
      'People cannot retrain if they cannot pay the rent or the mortgage while they do it.',
      'If a job is disappearing, the person losing it did nothing wrong.',
    ],
    againstSide: ['Small employers cannot pay staff to be away and pay for cover as well.', '“Nobody” is very wide: it would cover any course, for any job, paid by someone.'],
  },
  /** [minutes after the start, author key or 'facilitator', text]. Facilitator turns use the fixed wording. */
  messages: [
    [0, 'facilitator', 'welcome'],
    [1, 'ibrahim', 'I’ll start. I said agree. If my job’s going, I can’t take six months on nothing to learn a new one. Three kids.'],
    [3, 'helen', 'I understand that. But “nobody should lose pay”: who pays? I run a care agency. I can’t pay forty people to sit in a classroom.'],
    [5, 'precious', 'The hospital gives the doctors study leave. Why not us? It’s the same building.'],
    [7, 'mo', 'There are three of us at the café. If one’s on a course, I’m paying them and paying cover. That’s the week’s profit gone.'],
    [9, 'ibrahim', 'So it can’t all be on the small firms, fair enough. But it can’t all be on us either.'],
    [11, 'helen', 'I’d go halves. If the skills fund paid half the hours, I’d pay the other half. I said that in my conversation.'],
    [12, 'femi', 'For me the word “nobody” is the problem. Nobody at all? Even someone who wants to retrain as a pilot?'],
    [14, 'facilitator', 'invite:Kerry'],
    [16, 'kerry', 'Thanks. I’m out of work, so it’s a bit different for me. My worry is my money changing if I study. But that’s the benefit rules, and they’re off the table.'],
    [18, 'precious', 'Going back to what Femi said: it does say a job that’s disappearing. Not any job you fancy.'],
    [20, 'femi', 'Who decides it’s disappearing? My cleaners keep being told robots are coming. I’ve yet to see one do a stairwell.'],
    [22, 'facilitator', 'half_time'],
    [24, 'ibrahim', 'The firm decides, really. They know when the robots are coming. At our place they told the managers a year before they told us.'],
    [26, 'mo', 'So if an employer knows its own jobs are changing, it should pay something. That I could live with. Not the café down the road paying for it.'],
    [28, 'helen', 'Something like: if your employer expects your role to change, you get paid hours to learn, and the cost is shared.'],
    [30, 'kerry', 'Shared with who, though?'],
    [31, 'helen', 'The employer and the skills fund. The quarter of a million is skills money, isn’t it?'],
    [33, 'precious', 'Paid learning hours. I like that it says hours. You can fit hours round a rota.'],
    [35, 'femi', 'I’d agree to that version. The first one I can’t.'],
    [40, 'facilitator', 'wording'],
    [41, 'helen', 'Workers in roles their employer expects to change should get paid learning hours, with the cost shared between the employer and the skills fund.'],
    [42, 'ibrahim', 'I’d still want more than that. But I’d back it.'],
    [43, 'mo', 'Me too. Put it up.'],
    [44, 'kerry', 'It doesn’t do much for me while I’m not working. But it’s better than the first one for most people here.'],
    [45, 'facilitator', 'final'],
  ] as [number, string, string][],
  answers: [
    ['ibrahim', 'agree', 'I’d go further, but the new wording is fair.'],
    ['precious', 'agree', undefined],
    ['kerry', 'unsure', 'Neither version helps people who are out of work.'],
    ['helen', 'disagree', 'Not as first worded. I agree with the new wording.'],
    ['mo', 'disagree', 'The new wording, yes.'],
    ['femi', 'unsure', undefined],
  ] as [string, ReactionValue, string | undefined][],
  outcome: {
    reasonsFor: ['People cannot retrain if they cannot pay the rent while they do it.', 'Hospital doctors get study leave; other staff should too.'],
    reasonsAgainst: ['Small employers cannot pay staff to be away and pay for cover as well.', '“Nobody” is too wide: it should be about jobs that are actually changing.'],
    questionsForExperts: [
      'How do other places share the cost of paid learning hours between employers and public money?',
      'How much notice do employers usually have before roles change?',
    ],
  },
};

/* ------------------------------------------------------------------ the scheduled room on S5 */

export const ROOM_S5 = {
  topic: 'Should everyone be taught to use AI tools as a basic skill, like reading?',
  members: ['kev', 'sandra', 'carl', 'owen', 'jo', 'gareth'],
  briefing: {
    summary:
      'People in Riverbend split on this. Some see AI tools as the new basic skill and want to be the ones checking the software, not replaced by it. Others say the tools change too fast, and the money should go on skills that last.',
    forSide: [
      'Knowing how to use and check the tools may decide who keeps a job and who is replaced.',
      'People are already using these tools at work and at home with no training at all.',
      'A short basic course could save weeks of confusion when new systems arrive.',
    ],
    againstSide: [
      'The tools change every few months; reading does not.',
      'Money spent on this is money not spent on care, trades and other qualifications people asked for.',
      'Many people still need help with basic online forms first.',
    ],
  },
};

export const EVIDENCE = [
  {
    key: 'exposure',
    question: 'Which kinds of work are most affected by AI tools, and does that mean the jobs disappear?',
    answer:
      'Studies so far find that office and clerical work is the most exposed, more than manual, care or trade work. Most of them expect many jobs to change, with AI doing parts of a job, rather than whole jobs disappearing quickly. They also say it is too early to be sure.',
    confidence: 'medium' as const,
    disputed: 'How fast this will happen is disputed. Some researchers expect much bigger losses within ten years; others expect slow change, as with earlier computer systems.',
    expertName: 'Hannah',
    expertRole: 'Researcher in work and technology at a university (invented for this example)',
    sources: [
      { title: 'Generative AI and Jobs: A global analysis of potential effects on job quantity and quality (2023), International Labour Organization', url: 'https://www.ilo.org' },
      { title: 'OECD Employment Outlook 2023: Artificial Intelligence and the Labour Market, OECD', url: 'https://www.oecd.org' },
    ],
  },
  {
    key: 'training',
    question: 'Does a general course in using AI tools help people keep or find work, compared with training for a particular job?',
    answer:
      'There is little direct evidence yet about general AI courses. Evidence on adult training in general suggests that courses linked to a real job, or taught at work, more often lead to work than general courses. Short basic digital courses help most when people use the skill straight away.',
    confidence: 'low' as const,
    disputed: 'Some adult educators argue that a basic grasp of how these tools work, and where they go wrong, is now as general as using a computer, and should not be tied to one job.',
    expertName: 'Ruth',
    expertRole: 'Adult learning adviser who has run college evening programmes (invented for this example)',
    sources: [
      { title: 'Getting Skills Right: Future-Ready Adult Learning Systems (2019), OECD', url: 'https://www.oecd.org' },
      { title: 'The Future of Jobs Report 2023, World Economic Forum', url: 'https://www.weforum.org' },
    ],
  },
];

/* ------------------------------------------------------------------ the slow room on S7 */

/**
 * A slow room (section 12.2) on S7, open for five days from two days before the seed's "now".
 * Its six members are in no other unclosed room, three from each side. Each wrote where they
 * stood before they could read the others; two have not written yet and were invited once the
 * first day had passed.
 */
export const ROOM_S7_SLOW = {
  topic: 'Should courses be chosen by what local employers say they need?',
  members: ['priya', 'jas', 'grace', 'mei', 'paul', 'shabnam'],
  startedAt: '2026-11-11T09:00:00.000Z',
  days: 5,
  briefing: {
    summary:
      'People in Riverbend split on this. Employers and people looking for work mostly agreed: courses should lead to jobs that exist here. Others said employers only know what they need this year, and learners need a say in what lasts.',
    forSide: [
      'Courses that match real vacancies get people into work sooner.',
      'If a course does not lead to a job here, people take it and then move away.',
    ],
    againstSide: [
      'Employers did not see the last big changes coming either, and asked for jobs that then disappeared.',
      'Some things people want to learn, such as nursing or starting a business, no employer will ask for.',
    ],
  },
  /** [hours after the start, author key or 'facilitator', text]. Facilitator turns use the slow fixed wording. */
  messages: [
    [0, 'facilitator', 'welcome'],
    [7.2, 'mei', 'I said agree, mostly. I can’t find anyone qualified in lashes and it’s half my bookings. But my girls need classes that fit school hours, and no employer is going to think to ask for that.'],
    [12.7, 'priya', 'I said disagree. I teach the evening classes. Three years ago we ran a course the distribution centre asked for. They hired four people from it, then automated the site. Ask employers, yes. Don’t let them choose on their own.'],
    [21.8, 'grace', 'Disagree. If you ask the care homes, they’ll ask for more level 2 carers, because that’s cheap. I want the nursing access course in the evenings. Not one of them would ask for that.'],
    [22.25, 'jas', 'Agree. I’ve had an advert up since August for someone who can work on electric cars. Nobody local is trained for it. If the college asked me, I’d tell them, and I’d take two apprentices on.'],
    [24.05, 'facilitator', 'invite:Paul'],
    [24.35, 'facilitator', 'invite:Shabnam'],
  ] as [number, string, string][],
};

/* ------------------------------------------------------------------ objection and report */

export const OBJECTION_S4 = {
  person: 'liam',
  text: 'If the college teaches at a workplace, the employer will decide who goes. The people who need it most won’t get picked.',
  at: '2026-10-23T20:10:00.000Z',
  reply:
    'Courses taught at a workplace or a hall would still be booked through the college and open to anyone in Riverbend, not only that employer’s staff. The council and the college have confirmed this would be a condition of using a workplace. If it changes, this objection can be raised again.',
  repliedBy: 'Steward',
  resolvedAt: '2026-10-26T11:00:00.000Z',
};

export const REPORT_COUNTS = {
  person: 'sam',
  kind: 'missing' as const,
  text: 'The summary only talks about skills from paid work. Some of us said caring for family should count too, and that’s missing.',
  at: '2026-10-16T21:05:00.000Z',
  outcomeNote:
    'Upheld. The summary had left out skills from caring. A sentence was added, citing the points it rests on: “Skills from looking after family, such as managing medicines and appointments, are not counted either.”',
  resolvedAt: '2026-10-18T10:30:00.000Z',
};

/* ------------------------------------------------------------------ priorities */

/** Thirty-one people’s choices of up to three common-ground statements. */
export const EARNING_PRIORITIES: [string, StatementKey[]][] = [
  ...(['ibrahim', 'rosa', 'precious', 'gemma', 'ewa', 'lena'].map((p) => [p, ['S1', 'S2b', 'S6']]) as [string, StatementKey[]][]),
  ...(['sandra', 'stuart', 'grace', 'marek', 'hamid'].map((p) => [p, ['S1', 'S3']]) as [string, StatementKey[]][]),
  ...(['faith', 'martina', 'yusuf'].map((p) => [p, ['S1', 'S6']]) as [string, StatementKey[]][]),
  ...(['kofi', 'dean', 'carl'].map((p) => [p, ['S1']]) as [string, StatementKey[]][]),
  ...(['kerry', 'aaliyah', 'lucy'].map((p) => [p, ['S2b', 'S6', 'S4']]) as [string, StatementKey[]][]),
  ...(['helen', 'darren', 'paul'].map((p) => [p, ['S2b', 'S3']]) as [string, StatementKey[]][]),
  ...(['shabnam', 'zainab'].map((p) => [p, ['S6', 'S3']]) as [string, StatementKey[]][]),
  ...(['femi', 'jas'].map((p) => [p, ['S2b', 'S4']]) as [string, StatementKey[]][]),
  ['gareth', ['S3', 'S4']],
  ['mo', ['S4']],
  ...(['ade', 'tomasz'].map((p) => [p, ['S2b', 'S6']]) as [string, StatementKey[]][]),
];
