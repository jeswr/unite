// The scripted interviewer. It only asks. It never agrees, disagrees, advises or gives a view.

export type LangCode = 'sw' | 'pl' | 'es' | 'bn' | 'en';
export type StageId = 'day' | 'mattered' | 'inway' | 'goodday' | 'others' | 'tradeoff';

export interface Stage {
  id: StageId;
  label: string;
  prompt: string;
  original: Record<Exclude<LangCode, 'en'>, string>;
  example: string;
}

export const STAGES: Stage[] = [
  {
    id: 'day',
    label: 'A real day',
    prompt: "Let's start with a real day. Tell me about yesterday: what did it look like, from when you woke up?",
    original: {
      sw: 'Tuanze na siku halisi. Niambie kuhusu jana: siku yako ilikuwaje, tangu ulipoamka?',
      pl: 'Zacznijmy od prawdziwego dnia. Proszę opowiedzieć o wczoraj: jak wyglądał, od chwili przebudzenia?',
      es: 'Empecemos por un día real. Cuénteme de ayer: ¿cómo fue, desde que se despertó?',
      bn: 'একটা সত্যিকারের দিন দিয়ে শুরু করি। গতকালের কথা বলুন: ঘুম থেকে ওঠার পর থেকে দিনটা কেমন ছিল?',
    },
    example:
      'I got up at five, made breakfast for the kids and caught the first bus. I was at the stall by seven and sold most of the tomatoes before the rain came. I got home after dark and they were already asleep.',
  },
  {
    id: 'mattered',
    label: 'What mattered',
    prompt: 'What mattered most to you in that day?',
    original: {
      sw: 'Ni nini kilikuwa muhimu zaidi kwako katika siku hiyo?',
      pl: 'Co było dla Pana/Pani najważniejsze tego dnia?',
      es: '¿Qué fue lo que más le importó de ese día?',
      bn: 'সেই দিনে আপনার কাছে সবচেয়ে গুরুত্বপূর্ণ কী ছিল?',
    },
    example: 'Seeing my youngest before school mattered most. We had ten minutes together at the table.',
  },
  {
    id: 'inway',
    label: 'What got in the way',
    prompt: 'What got in the way, yesterday or on days like it?',
    original: {
      sw: 'Ni nini kilikuzuia, jana au siku kama hiyo?',
      pl: 'Co przeszkadzało, wczoraj albo w podobne dni?',
      es: '¿Qué se le atravesó, ayer o en días parecidos?',
      bn: 'গতকাল বা এমন দিনে কী বাধা হয়ে দাঁড়িয়েছিল?',
    },
    example: 'Money, mostly.',
  },
  {
    id: 'goodday',
    label: 'A good ordinary day',
    prompt: 'Now picture an ordinary good day a few years from now. Not a perfect day, an ordinary one. What happens in it?',
    original: {
      sw: 'Sasa fikiria siku nzuri ya kawaida miaka michache ijayo. Si siku kamili, ya kawaida tu. Nini kinatokea?',
      pl: 'Proszę wyobrazić sobie zwykły dobry dzień za kilka lat. Nie idealny, zwykły. Co się w nim dzieje?',
      es: 'Ahora imagine un día bueno y corriente dentro de unos años. No perfecto, corriente. ¿Qué pasa en él?',
      bn: 'এবার কয়েক বছর পরের একটা সাধারণ ভালো দিনের কথা ভাবুন। নিখুঁত নয়, সাধারণ। সেদিন কী হয়?',
    },
    example:
      'I would get to the stall in half an hour, sell at a fair price and be home while it is still light, in time to eat with my children.',
  },
  {
    id: 'others',
    label: 'Who else has to be all right',
    prompt: 'Who else has to be all right for that day to be good?',
    original: {
      sw: 'Ni nani mwingine anahitaji kuwa salama ili siku hiyo iwe nzuri?',
      pl: 'Komu jeszcze musi się dobrze wieść, żeby ten dzień był dobry?',
      es: '¿Quién más tiene que estar bien para que ese día sea bueno?',
      bn: 'সেই দিনটা ভালো হতে হলে আর কাকে ভালো থাকতে হবে?',
    },
    example:
      'My mother, who lives with us, needs to be looked after while I am out. And the farmers I buy from need a fair deal too.',
  },
  {
    id: 'tradeoff',
    label: 'One trade-off',
    prompt:
      'Sometimes one good thing costs another. If you could keep only one part of that good day, which would it be, and what would you let go?',
    original: {
      sw: 'Wakati mwingine jambo moja zuri linagharimu jingine. Kama ungeweza kubakiza sehemu moja tu ya siku hiyo, ingekuwa ipi, na ungeacha nini?',
      pl: 'Czasem jedna dobra rzecz kosztuje inną. Gdyby można było zatrzymać tylko jedną część tego dnia, która by to była i z czego by Pan/Pani zrezygnował(a)?',
      es: 'A veces una cosa buena cuesta otra. Si pudiera quedarse con una sola parte de ese día, ¿cuál sería y qué dejaría ir?',
      bn: 'কখনো একটা ভালো জিনিসের জন্য আরেকটা ছাড়তে হয়। সেই দিনের শুধু একটা অংশ রাখতে পারলে কোনটা রাখতেন, আর কী ছেড়ে দিতেন?',
    },
    example: 'I would keep being home before dark, even if it meant earning a bit less.',
  },
];

/** Stages of the full ten-stage conversation, and which ones this short demonstration asks. */
export const TEN_STAGES: { label: string; inDemo: boolean }[] = [
  { label: 'A real day', inDemo: true },
  { label: 'What mattered', inDemo: true },
  { label: 'What got in the way', inDemo: true },
  { label: 'A good ordinary day', inDemo: true },
  { label: 'Who else has to be all right', inDemo: true },
  { label: 'A trade-off', inDemo: true },
  { label: 'Ideas', inDemo: false },
  { label: 'Doubts', inDemo: false },
  { label: 'Here is what I heard', inDemo: true },
  { label: 'Adding to the picture', inDemo: true },
];

export const FOLLOW_UP_EXAMPLE =
  'Last Tuesday the bus fare went up again, so I walked the second half and lost an hour of selling.';

/** General words that mean different things in different places. Matched as whole words, any case. */
const GENERAL_WORDS: string[] = [
  // English
  'money', 'the government', 'government', 'the economy', 'economy', 'the system', 'politics', 'politicians', 'corruption', 'society', 'inflation', 'capitalism', 'prices',
  // Kiswahili
  'pesa', 'serikali', 'uchumi', 'siasa', 'ufisadi',
  // Polish
  'pieniądze', 'pieniędzy', 'rząd', 'gospodarka', 'system', 'polityka', 'korupcja',
  // Spanish
  'dinero', 'plata', 'gobierno', 'economía', 'sistema', 'política', 'corrupción',
  // Bengali
  'টাকা', 'সরকার', 'অর্থনীতি', 'রাজনীতি', 'দুর্নীতি',
];

/** Signs that the answer already describes an event in a day. */
const EVENT_CUES: string[] = [
  'yesterday', 'today', 'this morning', 'last week', 'last month', 'last night', 'on monday', 'on tuesday', 'on wednesday', 'on thursday', 'on friday', 'on saturday', 'on sunday', 'when i', 'i was', 'i had', 'i went', 'i paid', 'i walked', 'hours', 'minutes', "o'clock",
  'jana', 'leo', 'asubuhi', 'nili',
  'wczoraj', 'dzisiaj', 'rano', 'kiedy', 'godzin',
  'ayer', 'hoy', 'esta mañana', 'cuando', 'horas',
  'গতকাল', 'কাল', 'আজ', 'সকালে', 'ঘণ্টা',
];

const isLetter = (ch: string | undefined) => !!ch && /[\p{L}\p{M}]/u.test(ch);

function containsWord(text: string, word: string): boolean {
  const hay = text.toLocaleLowerCase();
  let from = 0;
  for (;;) {
    const i = hay.indexOf(word, from);
    if (i < 0) return false;
    if (!isLetter(hay[i - 1]) && !isLetter(hay[i + word.length])) return true;
    from = i + 1;
  }
}

const startsWithCue = (text: string, cue: string) => {
  // Kiswahili past-tense prefixes ("nili-", "nilipo-") are matched as word starts.
  const hay = text.toLocaleLowerCase();
  let from = 0;
  for (;;) {
    const i = hay.indexOf(cue, from);
    if (i < 0) return false;
    if (!isLetter(hay[i - 1])) return true;
    from = i + 1;
  }
};

/** The first general word in an answer, if any. */
export function generalWord(text: string): string | null {
  for (const w of GENERAL_WORDS) if (containsWord(text, w)) return w;
  return null;
}

export function hasEvent(text: string): boolean {
  return EVENT_CUES.some((c) => (c === 'nili' ? startsWithCue(text, c) : containsWord(text, c)));
}

/**
 * If an answer rests on a general word and describes no event, the interviewer follows it down:
 * it returns the follow-up question. Otherwise null.
 */
export function followUp(text: string): string | null {
  const w = generalWord(text);
  if (!w || hasEvent(text)) return null;
  return `You said “${w}”. Can you tell me about a time that showed up in your day?`;
}

export const FOLLOW_UP_ORIGINAL: Record<Exclude<LangCode, 'en'>, string> = {
  sw: 'Ulisema “{w}”. Unaweza kuniambia kuhusu wakati ambapo hilo lilijitokeza katika siku yako?',
  pl: 'Padło słowo „{w}”. Czy może Pan/Pani opowiedzieć o chwili, kiedy to pojawiło się w Pana/Pani dniu?',
  es: 'Usted dijo “{w}”. ¿Me puede contar de un momento en que eso apareció en su día?',
  bn: 'আপনি বললেন “{w}”। এটা আপনার দিনে কখন সামনে এসেছিল, সেই সময়ের কথা বলবেন?',
};
