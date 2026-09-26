// Possible futures: three debatable economic models, compared plainly.
// The founder's public-service direction is labelled as a proposal, one of
// several; nothing in Unite's AI or feed treats it as the right answer.

import { h } from '../dom.js';
import { MODEL_NAMES } from '../ui.js';

const MODELS = [
  {
    id: 'public-service',
    badge: "Founder's proposal",
    summary: 'Everyone who wants paid work can find it through many democratic public and cooperative employers (towns, regions, care services, cooperatives), with strong local autonomy over what work is done.',
    day: 'Rosa, 34, spends three days a week with her town\'s flood-defence cooperative, which residents voted to fund, and two days studying nursing on a paid public place. When her father falls ill she moves to paid carer leave for six months. No one asks her to prove she has "contributed enough"; she picked this work from dozens of openings and can leave for a private job at any time.',
    strengths: [
      'Useful work that markets underpay (care, repair, restoration) gets done and paid.',
      'Many employers and local control reduce the risk of one power centre.',
      'A standing public job offer puts a floor under wages and conditions everywhere.',
    ],
    risks: [
      'Can slide into workfare if income support ever becomes conditional on taking a job.',
      'Local bodies can be captured by insiders or favour people already well connected.',
      'Needs large, lasting public funding; fiscal and inflation effects at scale are unproven.',
      'May crowd out small firms and existing voluntary groups if badly designed.',
    ],
    path: [
      'Paid, voluntary community roles on locally chosen projects.',
      'Public procurement and participatory budgets that favour local cooperatives.',
      'Regional public and cooperative employers with elected oversight.',
      'A legal right to an offer of paid, useful work, with income support never conditional on accepting it.',
    ],
  },
  {
    id: 'global-employer',
    badge: 'For debate',
    summary: 'A single worldwide public institution guarantees and organises work for everyone, with common standards across countries.',
    day: 'Tomás, 51, logs in to the global work service and chooses among assignments ranked by a central plan: a regional solar build, a school kitchen, a data-quality team. Pay and conditions are the same as for his cousin on another continent. When he disagrees with the plan, he can vote in elections for the world assembly that oversees it.',
    strengths: [
      'Equal standards everywhere; no race to the bottom between countries.',
      'Could coordinate truly global tasks such as decarbonisation and pandemic response.',
    ],
    risks: [
      'Concentrates enormous economic power in one institution, with no exit if it goes wrong.',
      'Distant from local knowledge; one planning error spreads everywhere.',
      'Hard to reconcile with self-determination, dissent and cultural difference.',
      'No realistic democratic route to create it without broad agreement between nations.',
    ],
    path: [
      'Shared global standards for decent work, negotiated between countries.',
      'Global funds for specific tasks (vaccines, climate adaptation).',
      'Gradual pooling of employment programmes, only where countries freely agree.',
      'A global employer would be the last step, and many people argue it should never be taken.',
    ],
  },
  {
    id: 'mixed',
    badge: 'For debate',
    summary: 'Markets and private firms remain central, with much stronger public guarantees (income floors, universal services, care leave) and support for cooperatives and worker ownership.',
    day: 'Aiyana, 27, works at a bicycle company that became employee-owned with a public loan. Her rent is capped, her childcare is free, and between jobs a generous insurance scheme covers her for a year. She volunteers at a repair café on Saturdays because she enjoys it, not because anyone requires it.',
    strengths: [
      'Builds on institutions many countries already have.',
      'Keeps many centres of initiative and a clear exit from any single employer.',
      'Cooperatives and worker ownership spread power without state control.',
    ],
    risks: [
      'Guarantees can be cut back by later governments.',
      'Useful but unprofitable work (care, restoration) may still go undone.',
      'Market power and inequality can return if rules weaken.',
    ],
    path: [
      'Strengthen income floors, unemployment insurance and paid care leave.',
      'Expand universal services such as childcare, transport and health.',
      'Public finance and procurement that favour cooperatives and employee buy-outs.',
      'Protect the guarantees in constitutions or long-term law.',
    ],
  },
];

const PATH = [
  ['Discuss', 'People talk openly about the future they want and where they disagree, as in this demo.'],
  ['Voluntary paid community work', 'Small, locally chosen projects pay people who want to take part. Nobody is required to.'],
  ['Public procurement and participatory budgets', 'Local governments buy from community enterprises and let residents decide part of the budget.'],
  ['Public and cooperative institutions', 'Lasting employers with democratic governance take on work that proves its worth.'],
  ['Wider democratic guarantees', 'Rights such as an offer of paid, useful work or universal services are adopted in law, if people vote for them.'],
  ['Negotiated international coordination', 'Countries agree shared standards and joint funds for problems no country can solve alone.'],
];

export function renderFutures(ctx) {
  const selected = MODELS.find((m) => m.id === ctx.route.model) ?? MODELS[0];
  return h('section', { class: 'view', 'aria-labelledby': 'futures-title' },
    h('header', { class: 'view-head' },
      h('p', { class: 'eyebrow' }, 'Possible futures'),
      h('h1', { id: 'futures-title' }, 'How could everyone contribute and be secure?'),
      h('p', { class: 'lede' }, 'Three debatable models, side by side. The public-service economy is the founder\'s proposal: one view among several, not the answer Unite\'s AI or feed steers towards. Agree, critique or reject any of them.'),
    ),
    h('nav', { 'aria-label': 'Models' }, h('ul', { class: 'tabs' }, MODELS.map((m) => h('li', null,
      h('a', { href: `#/futures/${m.id}`, 'aria-current': m.id === selected.id ? 'page' : null }, MODEL_NAMES[m.id]))))),
    modelCard(ctx, selected),
    commitments(),
    compare(),
    path(),
    precedents(),
  );
}

function modelCard(ctx, m) {
  const respond = (modelStance, starter) => ctx.openPublish({
    roomId: 'future', modelRef: m.id, modelStance, text: starter,
    title: `Respond to “${MODEL_NAMES[m.id]}”`,
    intro: 'Your post goes to a room of your choice, labelled with the model and your kind of response.',
  });
  return h('article', { class: 'card', 'aria-labelledby': `model-${m.id}` },
    h('p', null, h('span', { class: `badge ${m.id === 'public-service' ? 'violet' : ''}` }, m.badge)),
    h('h2', { id: `model-${m.id}` }, MODEL_NAMES[m.id]),
    h('p', { class: 'lede' }, m.summary),
    h('h3', null, 'An ordinary day (illustrative, fictional)'),
    h('p', { class: 'day' }, m.day),
    h('div', { class: 'model-grid' },
      h('section', { 'aria-labelledby': `str-${m.id}` }, h('h3', { id: `str-${m.id}` }, 'Strengths'), h('ul', null, m.strengths.map((s) => h('li', null, s)))),
      h('section', { 'aria-labelledby': `risk-${m.id}` }, h('h3', { id: `risk-${m.id}` }, 'Risks'), h('ul', null, m.risks.map((s) => h('li', null, s)))),
    ),
    h('h3', null, 'A staged way to get there'),
    h('ol', { class: 'path' }, m.path.map((s) => h('li', null, s))),
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'primary', onClick: () => respond('agree', 'I agree with this because ') }, 'Post agreement'),
      h('button', { type: 'button', onClick: () => respond('critique', 'My main worry is ') }, 'Post a critique'),
      h('button', { type: 'button', onClick: () => respond('question', 'What I would need to know is ') }, 'Ask a question'),
    ),
  );
}

function commitments() {
  return h('section', { class: 'card', 'aria-labelledby': 'commit-title' },
    h('h2', { id: 'commit-title' }, 'What any model discussed here must keep'),
    h('ul', { class: 'commitments' },
      h('li', null, 'Freedom to choose your work, and to change it.'),
      h('li', null, 'Freedom to reject any of these models, and to dissent without losing anything.'),
      h('li', null, 'Care, study, rest, illness and disability are never failures. A decent life never depends on compulsory work.'),
      h('li', null, 'Local people have a real say over what is done where they live.'),
    ),
  );
}

function compare() {
  const rows = [
    ['Who employs you', 'Many democratic public bodies and cooperatives, or a private firm', 'One global public institution', 'Mostly private firms and cooperatives'],
    ['Local say', 'Strong by design', 'Weak: set centrally', 'Varies'],
    ['If you want no paid work', 'Income and services continue', 'Depends on the plan', 'Income floor and services'],
    ['Biggest risk', 'Workfare or local capture', 'Concentrated power', 'Guarantees cut later'],
  ];
  return h('section', { 'aria-labelledby': 'compare-title', class: 'field' },
    h('h2', { id: 'compare-title' }, 'At a glance'),
    h('div', { class: 'table-wrap' }, h('table', null,
      h('caption', { class: 'visually-hidden' }, 'Comparison of three possible economic models'),
      h('thead', null, h('tr', null, h('td'), MODELS.map((m) => h('th', { scope: 'col' }, MODEL_NAMES[m.id])))),
      h('tbody', null, rows.map(([label, ...cells]) => h('tr', null, h('th', { scope: 'row' }, label), cells.map((c) => h('td', null, c))))),
    )),
  );
}

function path() {
  return h('section', { class: 'card', 'aria-labelledby': 'path-title' },
    h('h2', { id: 'path-title' }, 'One illustrative path, not a prediction'),
    h('ol', { class: 'path' }, PATH.map(([title, text]) => h('li', null, h('strong', null, title), `: ${text}`))),
    h('p', { class: 'small' }, 'None of this is inevitable or fiscally proven. Each step would need its own evidence, consent, funding and the chance to stop or reverse. People may choose to stop at any step.'),
  );
}

function precedents() {
  const link = (href, text) => h('a', { href, rel: 'noopener noreferrer' }, text);
  return h('section', { class: 'card quiet', 'aria-labelledby': 'prec-title' },
    h('h2', { id: 'prec-title' }, 'Partial precedents, not proof'),
    h('ul', { class: 'commitments small' },
      h('li', null, link('https://www.nobelprize.org/prizes/economic-sciences/2009/ostrom/facts/', 'Elinor Ostrom\'s work on governing shared resources'), ' shows communities managing commons through many overlapping (polycentric) institutions. It does not show that this scales to a whole economy.'),
      h('li', null, link('https://cles.org.uk/the-preston-model/', 'The Preston model (CLES)'), ' redirected local public spending towards local and cooperative suppliers. One city\'s results are not a blueprint for every place.'),
      h('li', null, link('https://www.mondragon-corporation.com/en/about-us/', 'Mondragon'), ' is a large federation of worker cooperatives in the Basque Country. It relies on specific history and culture, and has faced its own failures.'),
    ),
  );
}
