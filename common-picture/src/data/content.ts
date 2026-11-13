// Invented example content for the good days, the slow room, the answers, Rehema's route and editions.
import type { LayerId, ThemeId, Words } from './types';

/** The demonstration's fixed "today", so every screen renders the same way for recording. */
export const TODAY = new Date('2026-11-13T12:00:00Z');
export const TODAY_LABEL = '13 November 2026';

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000);
}

// ---------------------------------------------------------------- Good days from elsewhere

export type Matter = 'Time' | 'Movement' | 'Care' | 'Safety' | 'Work' | 'Home';

export interface GoodDay {
  id: string;
  layer: LayerId;
  matter: Matter;
  words: Words;
}

export const GOOD_DAYS: GoodDay[] = [
  {
    id: 'gd1',
    layer: 'kisumu',
    matter: 'Time',
    words: {
      lang: 'sw',
      original: 'Ninafunga duka saa kumi na moja, ninapika na watoto wananisaidia kumenya. Tunakula pamoja, kisha tunasikiliza redio.',
      translation: 'I close the stall at five, I cook and the children help me peel. We eat together, then we listen to the radio.',
    },
  },
  {
    id: 'gd2',
    layer: 'krakow',
    matter: 'Time',
    words: {
      lang: 'pl',
      original: 'Kończę pracę o piętnastej, odbieram syna i idziemy nad Wisłę na rower. Nikt nigdzie się nie spieszy.',
      translation: 'I finish work at three, collect my son and we go to the river to ride bikes. Nobody is in a hurry to be anywhere.',
    },
  },
  {
    id: 'gd3',
    layer: 'medellin',
    matter: 'Movement',
    words: {
      lang: 'es',
      original: 'Bajo de la loma en veinte minutos, llego a la obra con energía y vuelvo antes de que oscurezca.',
      translation: 'I come down the hill in twenty minutes, get to the site with energy, and come back before dark.',
    },
  },
  {
    id: 'gd4',
    layer: 'dhaka',
    matter: 'Movement',
    words: {
      lang: 'bn',
      original: 'বৃষ্টির পরেও গলিতে পানি জমে না। মেয়ে হেঁটে স্কুলে যায়, আমি সময়মতো কাজে পৌঁছাই।',
      translation: 'Even after rain, water does not collect in the lane. My daughter walks to school and I reach work on time.',
    },
  },
  {
    id: 'gd5',
    layer: 'glasgow',
    matter: 'Care',
    words: {
      lang: 'en',
      original: 'Somebody pops in on my dad at lunchtime, he goes to the club on a Thursday, and I can do a full shift without my phone buzzing.',
    },
  },
  {
    id: 'gd6',
    layer: 'krakow',
    matter: 'Care',
    words: {
      lang: 'pl',
      original: 'W przychodni ktoś mnie wita po imieniu i mówi, ile poczekam. Wychodzę spokojna.',
      translation: 'At the clinic someone greets me by name and tells me how long I will wait. I leave calm.',
    },
  },
  {
    id: 'gd7',
    layer: 'medellin',
    matter: 'Safety',
    words: {
      lang: 'es',
      original: 'Mi hija vuelve del colegio nocturno caminando con sus amigas, la calle tiene luz y yo me duermo tranquila.',
      translation: 'My daughter walks home from night school with her friends, the street is lit, and I fall asleep at ease.',
    },
  },
  {
    id: 'gd8',
    layer: 'kisumu',
    matter: 'Safety',
    words: {
      lang: 'sw',
      original: 'Taa za soko zinawaka, ninafunga saa tatu usiku na kutembea nyumbani bila hofu.',
      translation: 'The market lights are on, I close at nine at night and walk home without fear.',
    },
  },
  {
    id: 'gd9',
    layer: 'cusco',
    matter: 'Work',
    words: {
      lang: 'qu',
      original: 'Ayllupi ayniwan llamk’anchik, chaymanta kuskalla mikhunchik.',
      translation: 'We work in ayni with the community, and then we eat together.',
      glosses: [{ word: 'ayni', gloss: 'help given and returned over time' }],
    },
  },
  {
    id: 'gd10',
    layer: 'dhaka',
    matter: 'Work',
    words: {
      lang: 'bn',
      original: 'আট ঘণ্টা কাজ, তারপর বাড়ি। মাসের শেষেও চাল কিনতে চিন্তা হয় না।',
      translation: 'Eight hours of work, then home. Even at the end of the month I do not worry about buying rice.',
    },
  },
  {
    id: 'gd11',
    layer: 'glasgow',
    matter: 'Home',
    words: {
      lang: 'en',
      original: 'The flat is warm when I get in, the windows are dry, and the bus stop is two minutes from the door.',
    },
  },
  {
    id: 'gd12',
    layer: 'cusco',
    matter: 'Home',
    words: {
      lang: 'qu',
      original: 'Pukyumanta ch’uya yaku hamun, wawakunapas qhali kanku.',
      translation: 'Clean water comes from the spring, and the children are healthy.',
    },
  },
];

// ---------------------------------------------------------------- The slow room

export const ROOM = {
  title: "A grower's fair price is a city family's food bill",
  tensionId: 'price',
  opened: '2026-11-11',
  closes: '2026-11-17',
  question: 'Where do you stand on this tension, and what in your own days makes you stand there?',
  visitorExample: "I'd pay a bit more for food if I knew it reached the person who grew it, but not if it goes to the middle.",
};

export interface RoomMessage {
  id: string;
  layer: LayerId;
  seat: string;
  day: number;
  words: Words;
}

export const ROOM_MESSAGES: RoomMessage[] = [
  {
    id: 'm1',
    layer: 'kisumu',
    seat: 'Seat 1 · Kisumu',
    day: 1,
    words: {
      lang: 'sw',
      original: 'Mimi ni mkulima. Bei ikiwa ya haki, naweza kumpeleka mtoto shule bila mkopo. Lakini naelewa mama wa mjini naye anahesabu kila shilingi.',
      translation: 'I am a farmer. If the price is fair, I can send my child to school without a loan. But I understand that a mother in town also counts every shilling.',
    },
  },
  {
    id: 'm2',
    layer: 'dhaka',
    seat: 'Seat 2 · Dhaka',
    day: 1,
    words: {
      lang: 'bn',
      original: 'আমি শহরে থাকি, মাসের শেষে চাল কিনতে কষ্ট হয়। কৃষক ন্যায্য দাম পাক, কিন্তু মাঝখানের লোকেরা যেন সব না নেয়।',
      translation: 'I live in the city; at the end of the month it is hard to buy rice. Let the farmer get a fair price, but the people in the middle should not take it all.',
    },
  },
  {
    id: 'm3',
    layer: 'krakow',
    seat: 'Seat 3 · Kraków',
    day: 1,
    words: {
      lang: 'pl',
      original: 'Wolę zapłacić trochę więcej, jeśli wiem, że pieniądze trafiają do rolnika, a nie do pośrednika. Ale moja mama na emeryturze nie może.',
      translation: 'I would rather pay a little more if I know the money goes to the farmer and not the middleman. But my mother, on her pension, cannot.',
    },
  },
  {
    id: 'm4',
    layer: 'medellin',
    seat: 'Seat 4 · Medellín',
    day: 2,
    words: {
      lang: 'es',
      original: 'Crecí en una finca cafetera. Cuando el precio es justo, el pueblo entero respira. Cuando no, los jóvenes se van a la ciudad.',
      translation: 'I grew up on a coffee farm. When the price is fair, the whole village breathes. When it is not, the young people leave for the city.',
    },
  },
  {
    id: 'm5',
    layer: 'glasgow',
    seat: 'Seat 5 · Glasgow',
    day: 2,
    words: {
      lang: 'en',
      original: "Honestly, a fair price sounds right, but the food shop is already the thing I cut first. I'd want to know who else is paying for it.",
    },
  },
  {
    id: 'm6',
    layer: 'kisumu',
    seat: 'Seat 6 · Kisumu',
    day: 2,
    words: {
      lang: 'sw',
      original: 'Mimi ninanunua na kuuza sokoni. Bei ikipanda sana, wateja wangu hununua nusu. Tunahitaji njia ambayo mkulima na mnunuzi wote wanapata.',
      translation: 'I buy and sell at the market. If the price rises a lot, my customers buy half. We need a way in which the farmer and the buyer both gain.',
    },
  },
  {
    id: 'm7',
    layer: 'dhaka',
    seat: 'Seat 7 · Dhaka',
    day: 3,
    words: {
      lang: 'bn',
      original: 'আমার বাবা গ্রামে ধান চাষ করেন, আমি শহরে কাজ করি। আমি দুই দিকই দেখি।',
      translation: 'My father grows rice in the village and I work in the city. I see both sides.',
    },
  },
];

export const ROOM_SO_FAR =
  'Day 3. A short summary of the messages so far, which each of the seven can mark “not what was said”: all seven want growers paid fairly; five of seven say the gap is taken in the middle; two say they cannot pay more this year. Nobody in the room has said food should cost less at growers’ expense.';

// ---------------------------------------------------------------- Talk it through

export const TALK = {
  statement: 'When food prices are set, a fair price for growers should come first, even if food costs a little more in the city.',
  /** Reasons given by people who answered "agree" — shown to someone who disagrees. */
  agreeReasons: [
    {
      layer: 'medellin' as LayerId,
      words: {
        lang: 'es',
        original: 'Si el campo no vive, la ciudad tampoco come. Mi familia dejó la finca porque el café no pagaba.',
        translation: 'If the countryside cannot live, the city does not eat either. My family left the farm because coffee did not pay.',
      },
    },
    {
      layer: 'kisumu' as LayerId,
      words: {
        lang: 'sw',
        original: 'Ninapanda, ninapalilia, ninavuna. Bei ya chini inamaanisha kazi yangu haina thamani.',
        translation: 'I plant, I weed, I harvest. A low price means my work has no worth.',
      },
    },
    {
      layer: 'cusco' as LayerId,
      words: {
        lang: 'qu',
        original: 'Allpata uywaspa kawsanchik; pisi chaninqa allpatapas sayk’uchin.',
        translation: 'We live by caring for the land; a low price wears out the land too.',
      },
    },
  ],
  /** Reasons given by people who answered "disagree" — shown to someone who agrees. */
  disagreeReasons: [
    {
      layer: 'dhaka' as LayerId,
      words: {
        lang: 'bn',
        original: 'মাসের শেষে প্রতিটা টাকা গুনি। দাম একটু বাড়লেও বাচ্চার দুধ কমাতে হয়।',
        translation: 'At the end of the month I count every taka. Even a small rise means cutting my child’s milk.',
      },
    },
    {
      layer: 'glasgow' as LayerId,
      words: {
        lang: 'en',
        original: "Fair to growers, yes. But 'a little more' isn't little when you're already choosing between the meter and the shopping.",
      },
    },
    {
      layer: 'krakow' as LayerId,
      words: {
        lang: 'pl',
        original: 'Rolnik i tak nie dostanie tych pieniędzy. Zapłacę więcej, a zarobi sieć sklepów.',
        translation: 'The farmer will not get that money anyway. I will pay more and the supermarket chain will earn it.',
      },
    },
  ],
  example: 'The bit about the farm emptying is true for my grandparents’ village too.',
};

// ---------------------------------------------------------------- Pledges, asks and the register

export interface Host {
  id: string;
  name: string;
  where: string;
  kind: string;
  pledge: 'To answer' | 'To answer and to measure';
  pledged: string;
  answerBy: string;
  remit: string;
}

export const HOSTS: Host[] = [
  {
    id: 'lakeside',
    name: 'County Government of Lakeside',
    where: 'An invented county government in western Kenya',
    kind: 'County government',
    pledge: 'To answer',
    pledged: '2026-09-02',
    answerBy: '2027-06-30',
    remit: 'County roads and markets, clinics and dispensaries, water supply.',
  },
  {
    id: 'southern',
    name: 'Southern City Council',
    where: 'An invented city council in southern Poland',
    kind: 'City government',
    pledge: 'To answer and to measure',
    pledged: '2026-07-20',
    answerBy: '2027-03-31',
    remit: 'Trams and buses, homes on city land, care visits and day centres, city-run clinics.',
  },
  {
    id: 'harbour',
    name: 'Common Harbour Pension Fund',
    where: 'An invented workplace pension fund',
    kind: 'Pension fund',
    pledge: 'To answer',
    pledged: '2026-08-14',
    answerBy: '2027-01-31',
    remit: 'Where the fund invests its members’ savings.',
  },
];

export interface Ask {
  id: string;
  to: string;
  ask: string;
  signs: string[];
}

export const ASKS: Ask[] = [
  {
    id: 'journey',
    to: 'City and county governments',
    ask: 'Shorten the daily journey to work, in the rains and in the traffic.',
    signs: [
      'The main market road can be used the morning after heavy rain.',
      'The usual journey to the biggest workplaces, timed each quarter, gets shorter.',
      'Fewer people in the next round say the journey takes half their day.',
    ],
  },
  {
    id: 'queue',
    to: 'Health services and the bodies that run clinics',
    ask: 'Respect in the queue.',
    signs: [
      'Everyone is given a time when they arrive.',
      'Someone who speaks your language is there, or an interpreter by phone.',
      'In the next round, more people describe being looked at and listened to.',
    ],
  },
  {
    id: 'alone',
    to: 'City governments',
    ask: 'No older person left alone all day.',
    signs: [
      'Every older person living alone who wants a weekly visit gets one.',
      'A place to go in the daytime within a short walk of home.',
    ],
  },
  {
    id: 'homes',
    to: 'Pension funds',
    ask: 'Homes near work that people on ordinary pay can rent.',
    signs: [
      'The share of the fund in homes at rents people on ordinary pay can manage, published every year.',
      'How far those homes are from work, measured in journey time.',
    ],
  },
];

export type AnswerStatus = 'Accepted' | 'Changed' | 'Delayed' | 'Refused' | 'Late';

export interface RegisterEntry {
  id: string;
  host: string;
  ask: string;
  status: AnswerStatus;
  due: string;
  answered?: string;
  answer: string;
  check: { verdict: string; note: string };
}

export const REGISTER: RegisterEntry[] = [
  {
    id: 'r1',
    host: 'lakeside',
    ask: 'journey',
    status: 'Changed',
    due: '2026-10-31',
    answered: '2026-10-02',
    answer:
      'We will raise and drain the main market road before the long rains. We cannot promise the whole network: trunk roads are national, not county.',
    check: { verdict: 'Not yet checkable', note: 'Check due after the long rains, April 2027.' },
  },
  {
    id: 'r2',
    host: 'lakeside',
    ask: 'queue',
    status: 'Accepted',
    due: '2026-10-31',
    answered: '2026-10-02',
    answer:
      'Arrival tickets with a time at all county clinics by March 2027, and a Dholuo and Kiswahili speaker at the front desk of the two largest.',
    check: { verdict: 'Not yet checkable', note: 'Check due April 2027.' },
  },
  {
    id: 'r3',
    host: 'southern',
    ask: 'alone',
    status: 'Accepted',
    due: '2026-08-31',
    answered: '2026-08-15',
    answer: 'Weekly visits for every older person living alone who asks, and a day centre in each of the four districts by October 2026.',
    check: { verdict: 'Delivered with changes', note: 'See the check panel below.' },
  },
  {
    id: 'r4',
    host: 'southern',
    ask: 'journey',
    status: 'Delayed',
    due: '2026-10-31',
    answered: '2026-10-28',
    answer: 'We are studying tram priority at the six worst junctions first. A costed answer will come with the 2027 plan, by 31 March 2027.',
    check: { verdict: 'Not yet checkable', note: 'New date recorded: 31 March 2027.' },
  },
  {
    id: 'r5',
    host: 'southern',
    ask: 'queue',
    status: 'Late',
    due: '2026-10-30',
    answer: 'No answer yet.',
    check: { verdict: '—', note: 'A missing answer is shown as late, with the number of days.' },
  },
  {
    id: 'r6',
    host: 'harbour',
    ask: 'homes',
    status: 'Refused',
    due: '2026-11-30',
    answered: '2026-11-06',
    answer:
      'Our trustees’ duty is to members’ retirement income, so we will not set a target for homes at ordinary rents. We will publish every year where we hold housing and at what rents.',
    check: { verdict: 'Recorded', note: 'A refusal with reasons is an answer. It stays on the register, and the part offered (publishing) will be checked.' },
  },
];

export const CHECK_PANEL = {
  title: 'Check panel: Southern City Council, “No older person left alone all day”',
  drawn: 'Five people drawn by lot from people who served in earlier rooms in Kraków (invented).',
  categories: ['Delivered as pledged', 'Delivered with changes', 'Not delivered'],
  verdict: 'Delivered with changes',
  tally: '4 of 5',
  members: [
    {
      seat: 'Member 1',
      verdict: 'Delivered with changes',
      words: { lang: 'pl', original: 'Wizyty są co tydzień, sprawdziłam u sąsiadki. Ale świetlice są tylko w dwóch dzielnicach.', translation: 'The visits are weekly; I checked with my neighbour. But the day centres are only in two districts.' },
    },
    {
      seat: 'Member 2',
      verdict: 'Delivered with changes',
      words: { lang: 'pl', original: 'Obiecali cztery dzielnice, są dwie. To nie jest „wykonane”.', translation: 'They promised four districts; there are two. That is not “done”.' },
    },
    {
      seat: 'Member 3',
      verdict: 'Not delivered',
      words: { lang: 'pl', original: 'Mój ojciec czekał sześć tygodni na pierwszą wizytę.', translation: 'My father waited six weeks for the first visit.' },
    },
    {
      seat: 'Member 4',
      verdict: 'Delivered with changes',
      words: { lang: 'pl', original: 'Wizyty działają. Świetlice: połowa.', translation: 'The visits work. The day centres: half.' },
    },
    {
      seat: 'Member 5',
      verdict: 'Delivered with changes',
      words: { lang: 'pl', original: 'Zgadzam się z większością, ale termin trzeba zapisać na nowo.', translation: 'I agree with the majority, but the date has to be written down again.' },
    },
  ],
};

// ---------------------------------------------------------------- Rehema's route

export interface RouteStep {
  id: string;
  when: string;
  title: string;
  text: string;
  screen?: { kind: 'sms' | 'voice' | 'keypad' | 'call' | 'radio'; lines: Words[] };
}

export const REHEMA: RouteStep[] = [
  {
    id: 's1',
    when: 'Day 1, morning',
    title: 'A radio programme mentions a number',
    text: 'Rehema sells vegetables in a town in western Kenya and has a basic phone. The morning show on local radio says anyone can describe their day by ringing a free number.',
    screen: {
      kind: 'radio',
      lines: [{ lang: 'sw', original: 'Piga namba hii, kata simu, nasi tutakupigia bure.', translation: 'Ring this number, hang up, and we will call you back for free.' }],
    },
  },
  {
    id: 's2',
    when: 'Day 1, 10:02',
    title: 'She rings and hangs up',
    text: 'One ring is enough. It costs her nothing.',
    screen: { kind: 'call', lines: [{ lang: 'en', original: 'Calling… · Call ended · 0:01' }] },
  },
  {
    id: 's3',
    when: 'Day 1, 10:03',
    title: 'It calls her back, free',
    text: 'The callback means the conversation is paid for at the other end.',
    screen: { kind: 'call', lines: [{ lang: 'en', original: 'Incoming call · Free callback' }] },
  },
  {
    id: 's4',
    when: 'Day 1, 10:03',
    title: 'A voice says it is a computer and what happens to her words',
    text: 'Before any question, the voice says what it is, what will happen to her words, and how to stop.',
    screen: {
      kind: 'voice',
      lines: [
        {
          lang: 'sw',
          original: 'Habari. Mimi ni kompyuta, si mtu. Maneno yako yatabaki kwa Kiswahili, na jina lako halitaonyeshwa popote. Ukitaka kuacha, kata simu tu.',
          translation: 'Hello. I am a computer, not a person. Your words will stay in Kiswahili, and your name will not be shown anywhere. If you want to stop, just hang up.',
        },
      ],
    },
  },
  {
    id: 's5',
    when: 'Day 1, 10:04',
    title: 'It asks about yesterday',
    text: 'Not about income or government: about a real day.',
    screen: {
      kind: 'voice',
      lines: [{ lang: 'sw', original: 'Niambie kuhusu jana. Siku yako ilianzaje?', translation: 'Tell me about yesterday. How did your day begin?' }],
    },
  },
  {
    id: 's6',
    when: 'Day 1, 10:16',
    title: 'Twelve minutes later it reads back four points',
    text: 'She keeps three by pressing 1 and changes one by pressing 2 and saying it again.',
    screen: {
      kind: 'keypad',
      lines: [
        { lang: 'sw', original: '1. Barabara ya sokoni inakuwa tope mvua ikinyesha. — Bonyeza 1: bakiza', translation: '1. The road to the market turns to mud when it rains. — Pressed 1: keep' },
        { lang: 'sw', original: '2. Nilichelewa saa mbili jana. → Nilipoteza wateja wa asubuhi kwa sababu ya kuchelewa.', translation: '2. I was two hours late yesterday. → Changed to: I lost my morning customers because I was late.' },
        { lang: 'sw', original: '3. Nataka kurudi nyumbani kabla ya giza, nile na watoto. — 1: bakiza', translation: '3. I want to get home before dark and eat with the children. — Kept' },
        { lang: 'sw', original: '4. Bei ya mboga haipandi, lakini mbolea inapanda. — 1: bakiza', translation: '4. The price of vegetables does not rise, but fertiliser does. — Kept' },
      ],
    },
  },
  {
    id: 's7',
    when: 'A month on',
    title: 'A text message: others near her said something similar',
    text: 'The message tells her that her point about the road in the rains is shared, and where to hear the district picture.',
    screen: {
      kind: 'sms',
      lines: [
        {
          lang: 'sw',
          original: 'Watu wengi karibu nawe walisema kitu kama hiki: barabara ya sokoni wakati wa mvua. Sikiliza redio Jumamosi jioni kwa picha ya wilaya. Jibu STOP kusitisha.',
          translation: 'Many people near you said something like this: the market road in the rains. Listen to the radio on Saturday evening for the district picture. Reply STOP to stop.',
        },
      ],
    },
  },
  {
    id: 's8',
    when: 'A month on, Saturday',
    title: 'The radio programme reads out the district’s picture',
    text: 'What is said almost everywhere, what is said differently, what is in tension and who has not yet been heard.',
    screen: {
      kind: 'radio',
      lines: [{ lang: 'sw', original: 'Hii ndiyo picha ya wilaya yetu, kwa mfano wa maonyesho…', translation: 'This is our district’s picture, as a demonstration example…' }],
    },
  },
  {
    id: 's9',
    when: 'A year later',
    title: 'Another text: the county’s reply',
    text: 'The (invented) county has pledged to answer, and this is its reply to the priority her point is part of.',
    screen: {
      kind: 'sms',
      lines: [
        {
          lang: 'sw',
          original: 'Kaunti ya Lakeside (mfano wa kubuni) iliahidi kujibu. Jibu lake: itainua na kuchimba mitaro ya barabara kuu ya soko kabla ya mvua ndefu. Piga namba ileile kusikia zaidi.',
          translation: 'Lakeside County (an invented example) pledged to answer. Its reply: it will raise the main market road and dig its drains before the long rains. Ring the same number to hear more.',
        },
      ],
    },
  },
];

// ---------------------------------------------------------------- Editions

export interface HistoryEvent {
  edition: string;
  what: string;
}

export interface StatementHistory {
  id: string;
  theme?: ThemeId;
  now: string;
  status: 'In the picture' | 'Retired' | 'New';
  pilot: number | null;
  edition0: number | null;
  events: HistoryEvent[];
}

export const PILOT = 'Pilot round (hypothetical), May 2026';
export const EDITION0 = 'Edition 0 · demonstration, November 2026';

export const HISTORIES: StatementHistory[] = [
  {
    id: 'h-move',
    theme: 'move',
    now: 'Getting to work and back without losing half the day',
    status: 'In the picture',
    pilot: 48,
    edition0: 66,
    events: [
      { edition: PILOT, what: 'Entered as “Shorter journeys to work”.' },
      { edition: EDITION0, what: 'Wording changed after people in Kisumu and Dhaka said “shorter” missed the rains. Support moved from 48% to 66% of people (drawn sample).' },
    ],
  },
  {
    id: 'h-respect',
    theme: 'respect',
    now: 'Being treated with respect when you wait for care or papers',
    status: 'In the picture',
    pilot: 51,
    edition0: 47,
    events: [
      { edition: PILOT, what: 'Entered as “Shorter waits at the clinic”.' },
      { edition: EDITION0, what: 'Reworded: people said the wait mattered less than how they were treated in it. The value words heshima, szacunek, respeto and সম্মান are kept in the original. Support moved from 51% to 47%; it still appears in 6 of 6 places and circles.' },
    ],
  },
  {
    id: 'h-lang',
    theme: 'ownlang',
    now: 'Being spoken to in my own language at the clinic and the office',
    status: 'New',
    pilot: null,
    edition0: 3,
    events: [{ edition: EDITION0, what: 'Entered. Raised by few people but in 3 of 6 places and circles; kept whole under “Said here”.' }],
  },
  {
    id: 'h-net',
    now: 'Faster internet at home',
    status: 'Retired',
    pilot: 22,
    edition0: null,
    events: [
      { edition: PILOT, what: 'Entered.' },
      { edition: EDITION0, what: 'Retired: when the points were read back, people kept what the internet was for (work from home, school) and dropped the internet itself. Those points now sit in other statements.' },
    ],
  },
];

export const EDITION_CHANGES = [
  'Places: the pilot had three; Edition 0 has five places and one circle.',
  'Doors: the pilot had only the open door; Edition 0 shows the drawn sample beside it.',
  'Retention test: 5 of 8 in the pilot (below the threshold of 6); 7 of 8 in Edition 0.',
  'One statement retired, one new, two reworded. Each change has a reason on its history.',
];
