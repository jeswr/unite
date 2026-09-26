// Fictional seed content. Every person, role, amount and date here is invented
// for the demo; none of it describes a real community, institution or budget.

const person = (label) => ({ kind: 'seed', label: `${label} (fictional)` });
const role = (label) => ({ kind: 'expert-role', label });

export const PROPOSAL = {
  id: 'proposal-community-tools',
  title: 'Make community tools easier to use',
  question:
    'How should the pilot use a small, fixed budget to make Solid community apps easier for newcomers over the next six months?',
  remit:
    'This fictional pilot can decide how to spend its own small community budget. It cannot bind any Solid project, standards body, company or government, and it does not speak for everyone who uses these tools.',
  options: [
    {
      id: 'option-keep-current',
      title: 'Keep current practice',
      summary: 'Volunteers keep fixing usability problems as they are reported. No dedicated budget is spent.',
      relativeCost: 'none',
      costEstimate: 'No new spending; volunteer time continues',
      benefits: ['No new coordination or funding risk', 'Volunteers keep full control of their priorities'],
      tradeoffs: ['Fixes stay uneven across apps', 'Newcomers keep meeting the same setup problems'],
      evidenceNeeded: ['How many newcomers give up during setup today, and why?'],
      worseOff: [
        'Newcomers without someone technical to help them',
        'Volunteers who already answer most support requests',
      ],
    },
    {
      id: 'option-onboarding-kit',
      title: 'Shared onboarding kit and accessibility fixes',
      summary:
        'Fund a plain-language setup guide, one shared sign-up pattern, and accessibility fixes in the three most-used apps.',
      relativeCost: 'medium',
      costEstimate: 'About €18,000 over six months (fictional)',
      benefits: [
        'Helps every newcomer, not only people switching providers',
        'Keyboard and screen-reader users benefit directly',
      ],
      tradeoffs: ['Only three apps are covered at first', 'A shared sign-up pattern may not suit specialist apps'],
      evidenceNeeded: [
        'Which three apps do newcomers actually open first?',
        'Will app maintainers accept outside accessibility changes?',
      ],
      worseOff: ['Maintainers and users of apps outside the first three', 'People who need a switching tool soon'],
    },
    {
      id: 'option-switching-tool',
      title: 'Provider-switching tool',
      summary: 'Build a guided tool for moving data and sharing settings between pod providers.',
      relativeCost: 'high',
      costEstimate: 'About €40,000, more than the pilot budget (fictional)',
      benefits: ['Reduces lock-in to any one provider', 'Makes the promise of data portability concrete'],
      tradeoffs: [
        'Mostly serves people who already have a pod, not newcomers',
        'Depends on providers supporting the same features',
      ],
      evidenceNeeded: [
        'How many people have tried to switch provider and failed?',
        'Do providers handle access controls compatibly?',
      ],
      worseOff: ['Newcomers who are still stuck at sign-up', 'Small providers who cannot afford compatibility work'],
    },
  ],
};

export const ASPIRATIONS = [
  {
    id: 'asp-screen-reader-signup',
    title: 'Sign-up that works with my screen reader',
    topic: 'accessibility',
    horizon: 'year',
    hard: 'The sign-up page for my pod traps keyboard focus, so I need sighted help to finish creating an account.',
    different: 'I can create an account and give an app access on my own, using a keyboard and a screen reader.',
    protect: 'Keep the option of asking a person for help. Some of us rely on it.',
    inspiredBy: null,
    author: person('Sam'),
  },
  {
    id: 'asp-switch-without-loss',
    title: 'Moving my data without losing my contacts',
    topic: 'switching',
    horizon: 'five-years',
    hard: 'When I moved to a new pod provider, my contacts app lost its sharing settings and friends lost access.',
    different: 'Switching provider is a guided step that tells me what will and will not come with me.',
    protect: 'My friends’ access should never silently widen during a move.',
    inspiredBy: null,
    author: person('Ines'),
  },
  {
    id: 'asp-first-day',
    title: 'A first day that makes sense',
    topic: 'onboarding',
    horizon: 'year',
    hard: 'Students in my evening class are asked to choose a “provider” and an “identity” before they know what either means.',
    different: 'Newcomers start with one familiar task and learn the concepts when they need them.',
    protect: 'Do not hide choices that matter, such as where data is stored.',
    inspiredBy: null,
    author: person('Priya'),
  },
  {
    id: 'asp-affordable-hosting',
    title: 'Hosting a small group without a large bill',
    topic: 'hosting',
    horizon: 'five-years',
    hard: 'Our allotment society wants its own pod server, but the cost and upkeep are too much for a volunteer treasurer.',
    different: 'Small groups can share low-cost hosting with clear, predictable bills.',
    protect: 'Members who cannot pay should not be locked out.',
    inspiredBy: null,
    author: person('Kwame'),
  },
  {
    id: 'asp-who-can-see',
    title: 'Knowing who can see my health notes',
    topic: 'privacy',
    horizon: 'year',
    hard: 'I keep health notes in my pod but cannot tell which apps can still read them.',
    different: 'One plain page shows every app and person with access, and I can remove access in one step.',
    protect: 'Nothing about my health should be visible to the community, even in summaries.',
    inspiredBy: null,
    author: person('Mei'),
  },
  {
    id: 'asp-shared-plan',
    title: 'Editing a shared plan together',
    topic: 'collaboration',
    horizon: 'none',
    hard: 'Our tenants’ group edits one document by emailing copies, and we lose track of the latest version.',
    different: 'We edit one plan together, see who changed what, and each keep our own copy.',
    protect: 'People who only use a phone must be able to take part.',
    inspiredBy: null,
    author: person('Tomasz'),
  },
];

export const CLAIMS = [
  {
    id: 'claim-provider-first',
    kind: 'fact',
    text: 'Newcomers must choose a pod provider before they can use most community apps.',
    basis: 'Checkable by walking through the pilot’s current sign-up flow.',
  },
  {
    id: 'claim-dropout',
    kind: 'estimate',
    text: 'About 4 in 10 newcomers stop during sign-up.',
    basis: 'Invented for the demo. A real pilot would need a measured count and a description of how it was measured.',
  },
  {
    id: 'claim-kit-cost',
    kind: 'estimate',
    text: 'The onboarding kit could be delivered in six months for about €18,000.',
    basis: 'Fictional estimate from the accessibility auditor role, who has a disclosed interest in this option.',
  },
  {
    id: 'claim-newcomers-first',
    kind: 'value',
    text: 'Helping newcomers should come before helping people who already have a pod.',
    basis: 'A priority judgement. Experts can inform it; affected participants decide it.',
  },
];

export const EXPERTS = [
  {
    id: 'expert-accessibility',
    role: 'Accessibility auditor (fictional role)',
    advisesOn: 'Whether proposed fixes meet accessibility guidelines, and how much effort they realistically take.',
    interest: 'Hypothetical disclosed interest: runs a consultancy that could be paid to deliver the onboarding kit.',
  },
  {
    id: 'expert-hosting',
    role: 'Pod hosting operator (fictional role)',
    advisesOn: 'Whether providers can interoperate, and what hosting and migration really cost.',
    interest:
      'Hypothetical disclosed interest: operates a hosting service that could gain users if switching becomes easy.',
  },
];

export const QUESTIONS = [
  {
    id: 'question-assistive-tech',
    text: 'Which assistive technologies do current participants use? Fixes should be tested with those, not assumed.',
    to: 'expert-accessibility',
    optionId: 'option-onboarding-kit',
    status: 'open',
    author: role('Accessibility auditor (fictional role)'),
  },
  {
    id: 'question-upstream',
    text: 'Will app maintainers take on long-term upkeep of the fixes, or will the pilot need to pay for maintenance?',
    to: 'expert-accessibility',
    optionId: 'option-onboarding-kit',
    status: 'open',
    author: role('Accessibility auditor (fictional role)'),
  },
  {
    id: 'question-acl-compat',
    text: 'Do providers implement access controls in compatible ways? If not, a switching tool may move data but lose permissions.',
    to: 'expert-hosting',
    optionId: 'option-switching-tool',
    status: 'open',
    author: role('Pod hosting operator (fictional role)'),
  },
];

export const RESPONSES = [
  {
    id: 'response-seed-jonas',
    optionId: 'option-onboarding-kit',
    stance: 'concern',
    reason: 'A shared sign-up pattern could hide which provider I am trusting with my data.',
    author: person('Jonas'),
  },
  {
    id: 'response-seed-priya',
    optionId: 'option-onboarding-kit',
    stance: 'support',
    reason: 'Setup is exactly where my students give up.',
    author: person('Priya'),
  },
  {
    id: 'response-seed-sam',
    optionId: 'option-onboarding-kit',
    stance: 'concern',
    reason: 'Blind users were not asked which apps to fix first. Please do not pick the three apps without us.',
    author: person('Sam'),
  },
  {
    id: 'response-seed-mei',
    optionId: 'option-switching-tool',
    stance: 'info',
    reason: 'Can providers even export access rules today?',
    author: person('Mei'),
  },
  {
    id: 'response-seed-ines',
    optionId: 'option-switching-tool',
    stance: 'support',
    reason: 'I left one provider and lost my contacts’ sharing settings.',
    author: person('Ines'),
  },
  {
    id: 'response-seed-tomasz',
    optionId: 'option-keep-current',
    stance: 'concern',
    reason: '“Keep going as we are” means asking the same few volunteers to do more.',
    author: person('Tomasz'),
  },
];

export const MAIN_COMMITMENT_ID = 'commitment-pilot-response';

export const COMMITMENTS = [
  {
    id: MAIN_COMMITMENT_ID,
    title: 'Pilot response to “Make community tools easier to use”',
    owner: 'Pilot stewarding group (fictional)',
    authority: 'Community pilot budget, not a public mandate',
    proposedBudget: 18000,
    responseDue: '2026-11-30',
    decisionRule:
      'The stewarding group decides after reading every concern and open question. It publishes its reasons, including why any concern was not addressed. Support from demo participants informs the decision but does not settle it.',
    responseRecorded: false,
  },
  {
    id: 'commitment-translated-guide',
    title: 'Translate the setup guide into three languages',
    owner: 'Documentation working group (fictional)',
    authority: 'Volunteer working group; no budget of its own',
    proposedBudget: null,
    responseDue: '2026-08-31',
    decisionRule: 'The working group said it would publish a yes, no or not-yet answer with reasons by the due date.',
    responseRecorded: false,
  },
];

// What counts as evidence for each step of the delivery trail.
export const ACCEPTANCE = {
  'decision-recorded': 'A named owner, reasons, a date and a funding position are recorded, with concerns attached.',
  'resources-committed': 'The budget holder confirms the amount and when it will be released (simulated; no real money).',
  'in-progress': 'The first work item is published with a named person responsible and a target date.',
  delivered: 'The agreed acceptance check passes, for example: the three apps pass a keyboard and screen-reader checklist agreed with the people who raised concerns.',
  evaluated: 'A follow-up describes what changed for newcomers, measured the same way as before, including what did not work.',
};
