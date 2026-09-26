// Fictional sample content. Every sample post is marked `sample: true` and
// shown with a "Sample" label; none of these people exist. Samples never hold
// stances: the starting statements begin with zero responses.

export const ROOMS = [
  {
    id: 'work',
    name: 'Work & time',
    prompt: 'How should paid work, unpaid work and free time fit into a good life?',
  },
  {
    id: 'care',
    name: 'Care',
    prompt: 'Who looks after children, elders, sick and disabled people, and who looks after them?',
  },
  {
    id: 'places',
    name: 'Climate & living places',
    prompt: 'Homes, towns and landscapes we can live in for the long run.',
  },
  {
    id: 'future',
    name: 'Our shared future',
    prompt: 'The big picture: what kind of world are we building, and how could we get there?',
  },
];

export const ROOM_IDS = ROOMS.map((room) => room.id);

// `key` links replies and statement sources inside this file; the store
// replaces keys with generated IDs.
export const SAMPLE_POSTS = [
  {
    key: 'tomasz', room: 'work', author: 'Tomasz',
    text: 'I work rotating warehouse shifts. More money would be nice, but what I actually want is to know my hours two weeks ahead so I can see my kids play football. Any plan that says "guaranteed job" makes me nervous, though. I have seen schemes where you lose benefits unless you take whatever is offered.',
  },
  {
    key: 'ines', room: 'work', author: 'Inês',
    text: 'I run a bakery with six staff. If the public sector starts offering everyone a job at a good wage, I cannot compete for workers and small places like mine close. I would rather see stronger unemployment insurance and cheaper childcare. Let people choose, and let small firms survive.',
  },
  {
    key: 'kwame', room: 'work', author: 'Kwame', replyTo: 'ines',
    text: 'Retired teacher here. I understand the worry, but our school roof has leaked for three winters. There is real work nobody is paid to do. If public jobs only filled gaps like that, and people chose them freely, would that still crowd you out?',
  },
  {
    key: 'hana', room: 'care', author: 'Hana',
    text: 'I have looked after my mother full time for four years. It is work, and it is also love, and I do not want it turned into a timesheet. I would like it counted, with a pension and some respite, without someone checking whether I did enough hours.',
  },
  {
    key: 'deepa', room: 'care', author: 'Deepa',
    text: 'As a disabled person I get uneasy whenever people say "everybody contributes". It sounds kind until it becomes a test you can fail. Any future we design has to make rest, illness and simply being alive enough to deserve a decent life. No exceptions paperwork.',
  },
  {
    key: 'luis', room: 'places', author: 'Luis',
    text: 'Our valley flooded twice in five years. The repair money came from far away with rules written by people who had never seen the river. Pay local people to restore the wetlands and let us decide how. I do not trust big plans made somewhere else.',
  },
  {
    key: 'mei', room: 'places', author: 'Mei',
    text: 'I rent a top-floor flat that reaches 34°C in summer. Climate talk is often about farms and forests; for millions of us it is about rent and heat. Insulation and shade for renters first, and without the landlord raising the rent afterwards.',
  },
  {
    key: 'seun', room: 'future', author: 'Oluwaseun',
    text: 'Pandemics and carbon do not respect borders, so some coordination has to be global. But I would never want one global employer. That is too much power in one place. Many democratic institutions that cooperate seems like the right shape to me.',
  },
  {
    key: 'anna', room: 'future', author: 'Anna',
    text: 'Honestly, I think markets plus a strong safety net already work where they are allowed to. My worry with bigger public institutions is capture: whoever runs them decides what counts as useful work. Show me how dissenters stay free before I sign up to anything.',
  },
];

// One starting draft per room, written by the demo authors from the sample
// posts above. It is labelled as a sample draft and carries no stances.
export const SAMPLE_STATEMENTS = {
  work: {
    text: 'People want predictable, fairly paid work and real time for life outside it. Any new public or community work should be chosen, never required to keep benefits, and should fill real local needs.',
    differences: [
      'Whether public jobs help communities or crowd out small businesses.',
      'Whether security should come mainly as jobs, as income, or both.',
    ],
    sources: ['tomasz', 'ines', 'kwame'],
  },
  care: {
    text: 'Unpaid care is real work and deserves recognition, pensions and respite. A decent life must never depend on proving that you contribute enough.',
    differences: ['How to count care without turning it into surveillance or paperwork.'],
    sources: ['hana', 'deepa'],
  },
  places: {
    text: 'Climate adaptation should be paid work decided close to the people affected, and renters should be protected from heat without being priced out.',
    differences: ['How much should be decided locally versus by wider plans and funding rules.'],
    sources: ['luis', 'mei'],
  },
  future: {
    text: 'Some problems need coordination across borders, but no single institution should hold all economic power, and people must stay free to dissent and to choose their work.',
    differences: [
      'Whether stronger public institutions or stronger markets with safety nets are the better route.',
      'Who decides what counts as useful work.',
    ],
    sources: ['seun', 'anna'],
  },
};
