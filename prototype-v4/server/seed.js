// Fictional sample content. Every sample post is marked `sample: true` and
// shown with a "Sample" label; none of these people exist. Samples never hold
// stances: the starting statements begin with zero responses.
//
// Rooms are starting places, not a classification of human needs. Their IDs
// are kept from earlier versions (work, care, places, future) so links and
// exports stay stable; only the displayed names and prompts changed.

export const ROOMS = [
  {
    id: 'work',
    name: 'Time & everyday life',
    prompt: 'An ordinary day you would love to live: meals, rest, making things, the pace of it, time with people. What would you keep, and what would you change?',
  },
  {
    id: 'care',
    name: 'Care & support',
    prompt: 'Looking after others and being looked after: what already helps, what gets in the way, and what you would rather decide for yourself.',
  },
  {
    id: 'places',
    name: 'Places & nature',
    prompt: 'Homes, streets, rivers and landscapes where you spend your days, and how they could stay good to live in.',
  },
  {
    id: 'future',
    name: 'Imagining together',
    prompt: 'A moment from a future you would like, a doubt about big visions, or how different good lives could fit side by side.',
  },
];

export const ROOM_IDS = ROOMS.map((room) => room.id);

// `key` links replies and statement sources inside this file; the store
// replaces keys with generated IDs.
export const SAMPLE_POSTS = [
  {
    key: 'tomasz', room: 'work', author: 'Tomasz',
    text: 'The best part of my week is Sunday breakfast with my kids: no alarm, pancakes that take far too long. My shifts change every week, so I miss it more often than not. More money would honestly help, but what I really want is to know my hours ahead and have mornings like that more often.',
  },
  {
    key: 'ines', room: 'work', author: 'Inês',
    text: 'I run a small bakery and I love the early mornings: the quiet, the smell, the regulars who come in half asleep. I would not want a future that "frees" me from that. What I would change is the paperwork that eats my evenings.',
  },
  {
    key: 'kwame', room: 'work', author: 'Kwame', replyTo: 'ines',
    text: 'Retired teacher here. Same for me with the allotment: I do not want a machine to dig it for me. I would happily hand over the forms, though. Maybe the question is which parts of a day people want to keep doing themselves.',
  },
  {
    key: 'hana', room: 'care', author: 'Hana',
    text: 'I look after my mother. Some of our best moments are just sitting in the garden while she tells the same stories again. I do not want that turned into a timesheet. What I need is a few reliable hours of cover so I can see a friend without arranging it three weeks ahead.',
  },
  {
    key: 'deepa', room: 'care', author: 'Deepa',
    text: 'My energy changes from day to day. A good day for me might be a slow one at home, and that should count as a good day. I am wary of any "helpful" system I cannot say no to. Support should be there when I ask and quiet when I do not.',
  },
  {
    key: 'luis', room: 'places', author: 'Luis',
    text: 'There is a bend in the river near us where kids swim in summer. It has flooded twice in five years. I want it still to be there for my grandchildren, and I want the people who live here to have a real say in how it is repaired, not just funding rules written far away.',
  },
  {
    key: 'mei', room: 'places', author: 'Mei',
    text: 'My top-floor flat reaches 34°C in summer and I cannot sleep. The rent is already too high to move. A good evening would be sitting somewhere shaded and cool with my neighbours. Mostly I would just like to sleep.',
  },
  {
    key: 'seun', room: 'future', author: 'Oluwaseun',
    text: 'When I try to picture a good future I see ordinary things: long lunches, a workshop where anyone can learn to fix a bike, nobody panicking about bills. I find it hard to believe we get there without governments doing a lot, but I would want many places deciding things, not one centre.',
  },
  {
    key: 'anna', room: 'future', author: 'Anna',
    text: 'I am sceptical of big visions. They often turn out to mean someone else\'s idea of a good life. I would rather start with small things that already work, like our street\'s tool library, and see what spreads. And people must be free to opt out.',
  },
];

// One starting draft per room, written by the demo authors from the sample
// posts above. It is labelled as a sample draft and carries no stances.
export const SAMPLE_STATEMENTS = {
  work: {
    text: 'Many people want more unhurried time for things they already enjoy, such as breakfast with family or early mornings at work they love. Predictable time matters. People want help with some parts of their day and to keep doing others themselves.',
    differences: [
      'Whether more money or more predictable time would help most.',
      'Which tasks people would hand over and which they would keep.',
    ],
    sources: ['tomasz', 'ines', 'kwame'],
  },
  care: {
    text: 'Care includes moments worth protecting, not only tasks. People want reliable support they can ask for, and the freedom to decline it. A slow day at home can be a good day.',
    differences: ['How to arrange dependable cover without turning care into paperwork or surveillance.'],
    sources: ['hana', 'deepa'],
  },
  places: {
    text: 'People want the places they love, from a river bend to a cool street at night, to stay good to live in, with the people who live there having a real say in how they change.',
    differences: [
      'How much should be decided locally versus by wider plans and funding rules.',
      'What comes first when heat and housing costs both press.',
    ],
    sources: ['luis', 'mei'],
  },
  future: {
    text: 'A good future may look like ordinary days lived well, with many places able to decide things and people free to opt out.',
    differences: [
      'Whether governments or small local beginnings should do most of the work.',
      'Whether big shared visions help, or risk imposing one idea of a good life.',
    ],
    sources: ['seun', 'anna'],
  },
};
