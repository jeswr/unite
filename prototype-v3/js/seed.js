// Fictional seed content. Every person, role, cost and date here is invented
// for the demo; none of it describes a real place, institution or budget.
//
// The aspirations illustrate the wider shared-futures space. The proposal,
// evidence and commitments are ONE worked example inside it, and the example
// keeps three kinds of thing apart: aspirations (for discussion), a community
// experiment the example group can fund itself, and a recommendation that
// only matters if a separate institution adopts and funds it.

const person = (label) => ({ kind: 'seed', label: `${label} (fictional)` });
const role = (label) => ({ kind: 'expert-role', label });

export const EXAMPLE_BUDGET = 2000;

export const PROPOSAL = {
  id: 'proposal-learning-for-everyone',
  title: 'Example: Learning opportunities for everyone',
  question:
    'How could a small group of learners and neighbours widen access to learning for adults who missed out, over the next 90 days, and what should it ask of others?',
  remit:
    'This is a fictional example. The example group can spend its own small budget (US$2,000) on a community experiment and can publish recommendations. It cannot set policy for any employer, school, government or country, and its participants speak only for themselves. A recommendation takes effect only if an institution with that authority separately adopts and funds it.',
  options: [
    {
      id: 'option-current-provision',
      title: 'Keep current provision',
      scope: 'current',
      summary:
        'Point people to what already exists: schools, colleges, libraries and online courses. The example group spends nothing new.',
      relativeCost: 'none',
      costEstimate: 'No new spending by the example group',
      benefits: ['No new coordination or funding risk', 'Existing courses keep their teachers and certificates'],
      tradeoffs: [
        'Courses stay at times, prices and places that many adults cannot manage',
        'Nothing new is learned about what would help',
      ],
      evidenceNeeded: ['Who is currently not using the courses that exist, and what stops them?'],
      worseOff: ['Adults who work shifts, care for others or live far from a college', 'People who were put off learning at school'],
    },
    {
      id: 'option-learning-circles',
      title: 'Community learning circles with openly available materials',
      scope: 'experiment',
      summary:
        'Run a 90-day experiment: small peer learning circles meeting weekly in a library room, a community centre and online, using free, openly licensed materials and a volunteer facilitator. The budget covers the costs that stop people coming.',
      relativeCost: 'low',
      costEstimate: 'About US$2,000 for 90 days: rooms, travel, childcare, data and printing (fictional estimate)',
      benefits: [
        'Small enough to try now, and to stop if it does not work',
        'Meets at times and places chosen with the people it is for',
      ],
      tradeoffs: [
        'Reaches dozens of people, not thousands',
        'Relies on volunteer facilitators who may not stay',
        'Circles do not give a recognised qualification',
      ],
      evidenceNeeded: [
        'Do people who missed out actually join and keep coming?',
        'Are free materials good enough, and accessible to disabled learners?',
      ],
      worseOff: ['People who need a recognised certificate for work', 'Volunteers, if the circles grow faster than support for them'],
    },
    {
      id: 'option-paid-learning-time',
      title: 'Recommend paid learning time',
      scope: 'recommendation',
      summary:
        'Write and publish a recommendation that employers and public bodies give adults paid hours for learning. The example group cannot adopt or fund this; it would need a separate institutional sponsor.',
      relativeCost: 'high',
      costEstimate: 'Not funded by the example group. The real cost depends on who adopts it and how.',
      benefits: [
        'Addresses the lack of time, which a circle alone cannot fix',
        'Could reach far more people if an institution adopts it',
      ],
      tradeoffs: [
        'Nothing changes unless someone with authority adopts it',
        'May take years, and may be changed on the way',
      ],
      evidenceNeeded: [
        'Who could sponsor it, and on what terms?',
        'How would it reach people without a regular employer?',
      ],
      worseOff: [
        'Freelance, informal and unpaid care workers, who may have no employer to give paid time',
        'Small employers who cannot cover the hours',
      ],
    },
  ],
};

export const ASPIRATIONS = [
  {
    id: 'asp-evening-learning',
    title: 'Learning that fits around my shifts',
    topic: 'learning',
    horizon: 'year',
    hard: 'I left school at fifteen. Every course I find runs in the daytime or costs a week’s wages, and I work rotating shifts.',
    different: 'I can learn bookkeeping near home, at hours I can manage, with people who do not make me feel behind.',
    protect: 'Do not make it depend on a smartphone or a fast connection. Mine is shared with my children.',
    inspiredBy: null,
    author: person('Ines'),
  },
  {
    id: 'asp-shared-care',
    title: 'Care that does not fall on one person',
    topic: 'care',
    horizon: 'five-years',
    hard: 'I look after my father alone. His appointments are always in my working hours, and I am running out of leave.',
    different: 'Caring is shared between family, neighbours and services, and carers get time and recognition for it.',
    protect: 'My father still decides about his own care. Help should not take that from him.',
    inspiredBy: null,
    author: person('Tomasz'),
  },
  {
    id: 'asp-steady-income',
    title: 'An income I can plan around',
    topic: 'livelihoods',
    horizon: 'year',
    hard: 'I do delivery work through an app. Some weeks pay the rent and some do not, and I cannot afford a month off to retrain.',
    different: 'I know roughly what I will earn, and I can change the kind of work I do without losing everything.',
    protect: 'The freedom to choose my own hours.',
    inspiredBy: null,
    author: person('Mei'),
  },
  {
    id: 'asp-cooler-streets',
    title: 'Streets where children can play in summer',
    topic: 'climate',
    horizon: 'longer',
    hard: 'Our block has no trees. In hot weeks the pavement is too hot for the children and older neighbours stay inside.',
    different: 'Shade, water and green space within a short walk, planned with the people who live here.',
    protect: 'Greening the street should not raise rents until the people who live here can no longer afford them.',
    inspiredBy: null,
    author: person('Jonas'),
  },
  {
    id: 'asp-home-and-neighbours',
    title: 'A home I can afford, and neighbours I know',
    topic: 'housing',
    horizon: 'five-years',
    hard: 'I moved for work. Rent takes most of my pay, I have moved three times in two years, and I barely know anyone nearby.',
    different: 'A secure home at a fair rent, and somewhere nearby to meet people without having to buy anything.',
    protect: 'People who are new to a place should be welcomed, not treated as the problem.',
    inspiredBy: null,
    author: person('Amara'),
  },
  {
    id: 'asp-heard-in-my-way',
    title: 'Being heard in a way that works for me',
    topic: 'voice',
    horizon: 'year',
    hard: 'Every consultation I hear about is an online form my screen reader cannot get through, or a meeting up a flight of stairs.',
    different: 'I can give my view in the way that works for me, and later see what was done with it and why.',
    protect: 'Keep in-person options. Not everyone is online, and some of us rely on a person to help.',
    inspiredBy: null,
    author: person('Sam'),
  },
];

export const CLAIMS = [
  {
    id: 'claim-open-materials',
    kind: 'fact',
    text: 'Openly licensed learning materials exist for many subjects and can be reused without licence fees.',
    basis: 'Checkable: each item states its licence terms. Whether a given item is accurate, current and accessible still has to be checked.',
  },
  {
    id: 'claim-circle-cost',
    kind: 'estimate',
    text: 'Three learning circles could run for 90 days on about US$2,000, most of it childcare, travel, data and room hire.',
    basis: 'Fictional estimate from the community delivery adviser role, which has a disclosed interest. Not based on a real budget.',
  },
  {
    id: 'claim-completion',
    kind: 'estimate',
    text: 'Perhaps half of the people who start a circle would still be coming at the end.',
    basis: 'Invented for the demo. A real experiment would count who starts and who finishes, and ask people who stopped why.',
  },
  {
    id: 'claim-reach-first',
    kind: 'value',
    text: 'Adults who missed out on learning earlier should be reached first, before people who already have many options.',
    basis: 'A priority judgement. Experts can inform it; the people affected decide it.',
  },
];

export const EXPERTS = [
  {
    id: 'expert-adult-learning',
    role: 'Adult learning and access adviser (fictional role)',
    advisesOn:
      'What helps adults who left education early to start and keep learning, and which barriers (time, cost, confidence, disability, language) matter most.',
    interest: 'Hypothetical disclosed interest: writes openly licensed course materials that the circles might use.',
  },
  {
    id: 'expert-work-delivery',
    role: 'Labour and community delivery adviser (fictional role)',
    advisesOn:
      'How paid learning time could work for workers and employers, and what running local circles really takes in rooms, volunteers and money.',
    interest: 'Hypothetical disclosed interest: works for a workers’ organisation that campaigns for paid learning time.',
  },
];

export const QUESTIONS = [
  {
    id: 'question-accessible-materials',
    text: 'Which of the free materials have been tried by learners who use screen readers, read slowly, or are learning in a second language?',
    to: 'expert-adult-learning',
    optionId: 'option-learning-circles',
    status: 'open',
    author: role('Adult learning and access adviser (fictional role)'),
  },
  {
    id: 'question-childcare',
    text: 'Is the childcare support in the estimate enough for parents to attend every week, or only some weeks?',
    to: 'expert-work-delivery',
    optionId: 'option-learning-circles',
    status: 'open',
    author: role('Labour and community delivery adviser (fictional role)'),
  },
  {
    id: 'question-no-employer',
    text: 'How would paid learning time reach people in informal, platform or unpaid care work, who have no employer to grant it?',
    to: 'expert-work-delivery',
    optionId: 'option-paid-learning-time',
    status: 'open',
    author: role('Labour and community delivery adviser (fictional role)'),
  },
];

export const RESPONSES = [
  {
    id: 'response-seed-sam',
    optionId: 'option-learning-circles',
    stance: 'concern',
    reason: 'If circles meet up a flight of stairs or use scanned handouts, disabled learners are shut out again. Ask us before choosing rooms and materials.',
    author: person('Sam'),
  },
  {
    id: 'response-seed-ines',
    optionId: 'option-learning-circles',
    stance: 'support',
    reason: 'An evening circle near home is the first thing that fits around my shifts.',
    author: person('Ines'),
  },
  {
    id: 'response-seed-jonas',
    optionId: 'option-learning-circles',
    stance: 'info',
    reason: 'Who checks that free materials are accurate and up to date?',
    author: person('Jonas'),
  },
  {
    id: 'response-seed-mei',
    optionId: 'option-paid-learning-time',
    stance: 'concern',
    reason: 'Paid learning time helps people with an employer. For freelancers like me it could widen the gap.',
    author: person('Mei'),
  },
  {
    id: 'response-seed-tomasz',
    optionId: 'option-paid-learning-time',
    stance: 'support',
    reason: 'Carers and shift workers only get time to learn if someone pays for it.',
    author: person('Tomasz'),
  },
  {
    id: 'response-seed-amara',
    optionId: 'option-current-provision',
    stance: 'concern',
    reason: '“Keep things as they are” means the people who already missed out keep missing out.',
    author: person('Amara'),
  },
];

export const MAIN_COMMITMENT_ID = 'commitment-learning-example';

export const COMMITMENTS = [
  {
    id: MAIN_COMMITMENT_ID,
    title: 'Example group’s response to “Learning opportunities for everyone”',
    owner: 'Example stewarding group (fictional)',
    authority: 'A US$2,000 example budget for a community experiment. Not a public mandate, and no power to set policy.',
    proposedBudget: EXAMPLE_BUDGET,
    responseDue: '2026-11-30',
    decisionRule:
      'The stewarding group decides after reading every concern and open question. It publishes its reasons, including why any concern was not addressed. It can fund only a community experiment; a recommendation is published for others to adopt. Support from demo participants informs the decision but does not settle it.',
    responseRecorded: false,
  },
  {
    id: 'commitment-step-free-venue',
    title: 'Answer the request for a step-free meeting room',
    owner: 'Venue volunteers (fictional)',
    authority: 'Volunteer group; no budget of its own',
    proposedBudget: null,
    responseDue: '2026-08-31',
    decisionRule: 'The venue volunteers said they would publish a yes, no or not-yet answer, with reasons, by the due date.',
    responseRecorded: false,
  },
];

// What counts as evidence for each step of the delivery trail.
export const ACCEPTANCE = {
  'decision-recorded': 'A named owner, reasons, a date and a funding position are recorded, with concerns attached.',
  'resources-committed': 'The budget holder confirms the amount and when it will be released (simulated; no real money).',
  'in-progress': 'The first circle’s time, place and facilitator are published, with a named person responsible and a step-free room confirmed.',
  delivered: 'The agreed check passes, for example: the planned circles met, materials were available in accessible formats, and the promised childcare and travel support was paid.',
  evaluated: 'A follow-up reports who started and who finished, what learners say changed, what it really cost, and what did not work, including what people who stopped said.',
};
