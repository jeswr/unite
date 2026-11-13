// What people said, as the picture states it, and the original words behind each statement.
// All of it is invented example content written to show the form.
import type { CareView, LayerId, Quote, ThemeId, WorkView, Words } from './types';

export interface Theme {
  id: ThemeId;
  /** The statement as it appears in the picture. */
  title: string;
  /** What matters in it, for grouping. */
  matter: 'time' | 'movement' | 'care' | 'safety' | 'work' | 'home' | 'water' | 'language';
  quotes: Quote[];
}

const q = (layer: LayerId, who: string, w: Words): Quote => ({ layer, who, ...w });

const HESHIMA = { word: 'heshima', gloss: 'respect; the dignity owed to a person' };
const SZACUNEK = { word: 'szacunek', gloss: 'respect; regard for a person' };
const RESPETO = { word: 'respeto', gloss: 'respect; being treated as a person of worth' };
const SHOMMAN = { word: 'সম্মান (shômman)', gloss: 'respect; honour' };

export const THEMES: Record<ThemeId, Theme> = {
  time: {
    id: 'time',
    title: 'Time with the people I love, while it is still light',
    matter: 'time',
    quotes: [
      q('kisumu', 'A market trader, 30–44, by phone', {
        lang: 'sw',
        original: 'Nilifika nyumbani watoto wameshalala. Siku nzuri ni ile ninakula nao chakula cha jioni.',
        translation: 'I got home and the children were already asleep. A good day is one where I eat supper with them.',
      }),
      q('krakow', 'A nurse, 30–44, on the web', {
        lang: 'pl',
        original: 'Wczoraj odebrałam córkę z przedszkola ostatnia, o wpół do szóstej. Chciałabym mieć dla niej popołudnie, nie tylko wieczór.',
        translation: 'Yesterday I collected my daughter from nursery last, at half past five. I would like to have an afternoon for her, not just an evening.',
      }),
      q('medellin', 'A bus driver, 45–64, by voice note', {
        lang: 'es',
        original: 'Los domingos son el único día que almuerzo con mis hijos. Quisiera que fuera más de un día.',
        translation: 'Sundays are the only day I have lunch with my children. I wish it were more than one day.',
      }),
      q('dhaka', 'A garment worker, 18–29, by phone', {
        lang: 'bn',
        original: 'কাল রাতে বাড়ি ফিরে দেখি মেয়ে ঘুমিয়ে পড়েছে। ভালো দিন মানে ওর সাথে একটু গল্প করা।',
        translation: 'Last night I got home and found my daughter asleep. A good day means talking with her a little.',
      }),
      q('glasgow', 'A care worker, 30–44, on the web', {
        lang: 'en',
        original: "I'd like to do the school run myself, both ways, at least twice a week.",
      }),
      q('cusco', 'A father, 30–44, with a listener', {
        lang: 'qu',
        original: 'Wawaykunawan chakraman rispa yachachiyta munani.',
        translation: 'I want to go to the fields with my children and teach them.',
      }),
    ],
  },
  move: {
    id: 'move',
    title: 'Getting to work and back without losing half the day',
    matter: 'movement',
    quotes: [
      q('kisumu', 'A vegetable seller, 30–44, by phone', {
        lang: 'sw',
        original: 'Mvua ikinyesha, barabara ya kwenda sokoni inakuwa tope tupu. Jana nilichelewa saa mbili.',
        translation: 'When it rains, the road to the market turns to mud. Yesterday I was two hours late.',
      }),
      q('krakow', 'An office worker, 18–29, on the web', {
        lang: 'pl',
        original: 'Tramwaj stał w korku czterdzieści minut. Dobry dzień to taki, w którym dojazd mnie nie zjada.',
        translation: 'The tram sat in traffic for forty minutes. A good day is one where the commute does not eat me.',
      }),
      q('medellin', 'A builder, 30–44, by phone', {
        lang: 'es',
        original: 'Gasto dos horas en dos buses para llegar a la obra. Llego cansado antes de empezar.',
        translation: 'I spend two hours on two buses to get to the building site. I arrive tired before I start.',
      }),
      q('dhaka', 'A shop assistant, 18–29, by voice note', {
        lang: 'bn',
        original: 'অফিসে যেতে জ্যামে আড়াই ঘণ্টা লাগে। বৃষ্টি হলে আরও বেশি।',
        translation: 'Getting to work takes two and a half hours in the traffic. More when it rains.',
      }),
      q('glasgow', 'A hospital porter, 45–64, by phone', {
        lang: 'en',
        original: "Two buses and a walk, an hour and a half each way, because I can't afford to live nearer the hospital.",
      }),
      q('cusco', 'A woman, 45–64, with a listener', {
        lang: 'qu',
        original: 'Iskay urata purini mercadoman.',
        translation: 'I walk two hours to the market.',
      }),
    ],
  },
  respect: {
    id: 'respect',
    title: 'Being treated with respect when you wait for care or papers',
    matter: 'care',
    quotes: [
      q('kisumu', 'A mother, 18–29, by voice note', {
        lang: 'sw',
        original: 'Kwenye zahanati tulisubiri tangu asubuhi. Sitaki kupendelewa, nataka heshima tu.',
        translation: 'At the clinic we waited from the morning. I do not want favours, I just want heshima.',
        glosses: [HESHIMA],
      }),
      q('krakow', 'A retired teacher, 65+, by phone', {
        lang: 'pl',
        original: 'W przychodni pani w okienku nawet na mnie nie spojrzała. Chodzi o zwykły szacunek.',
        translation: 'At the clinic the woman at the window did not even look at me. It is about ordinary szacunek.',
        glosses: [SZACUNEK],
      }),
      q('medellin', 'A street vendor, 45–64, by voice note', {
        lang: 'es',
        original: 'En el centro de salud te tratan como un número. Uno pide respeto, nada más.',
        translation: 'At the health centre they treat you like a number. You ask for respeto, nothing more.',
        glosses: [RESPETO],
      }),
      q('dhaka', 'A rickshaw puller, 45–64, by phone', {
        lang: 'bn',
        original: 'হাসপাতালের লাইনে সারা সকাল দাঁড়িয়ে ছিলাম। একটু সম্মান চাই, আর কিছু না।',
        translation: 'I stood in the hospital line all morning. I want a little shômman, nothing else.',
        glosses: [SHOMMAN],
      }),
      q('glasgow', 'A student, 18–29, on the web', {
        lang: 'en',
        original: 'The receptionist was kind, which made the wait bearable. That is all it takes.',
      }),
      q('cusco', 'An elder, 65+, with a listener', {
        lang: 'qu',
        original: 'Llaqtaman uraykuptiy, mana qhawariwankuchu.',
        translation: 'When I go down to the town, they do not look at me.',
      }),
    ],
  },
  safe: {
    id: 'safe',
    title: 'Walking home after dark without being afraid',
    matter: 'safety',
    quotes: [
      q('kisumu', 'A shopkeeper, 30–44, by phone', {
        lang: 'sw',
        original: 'Taa za barabarani zikiwaka, naweza kufunga duka saa tatu usiku bila wasiwasi.',
        translation: 'When the street lights work, I can close the shop at nine at night without worry.',
      }),
      q('krakow', 'A waiter, 18–29, on the web', {
        lang: 'pl',
        original: 'Wracam późno z pracy, ale u nas jest spokojnie. Tego nie chcę stracić.',
        translation: 'I come back late from work, but it is calm where we live. I do not want to lose that.',
      }),
      q('medellin', 'A mother, 30–44, on the web', {
        lang: 'es',
        original: 'Quiero que mi hija pueda volver del colegio nocturno sin que yo esté pendiente del celular.',
        translation: 'I want my daughter to come back from night school without me watching my phone.',
      }),
      q('dhaka', 'A student, 18–29, by voice note', {
        lang: 'bn',
        original: 'সন্ধ্যার পর গলিতে হাঁটতে ভয় লাগে। আলো থাকলে ভালো হতো।',
        translation: 'After dusk I am afraid to walk in the lane. It would be better with lights.',
      }),
      q('glasgow', 'A bar worker, 18–29, on the web', {
        lang: 'en',
        original: "I take the long way home past the chippy because it's lit.",
      }),
    ],
  },
  water: {
    id: 'water',
    title: 'Water you can trust, from the tap or the spring',
    matter: 'water',
    quotes: [
      q('kisumu', 'A grandmother, 45–64, with a listener', {
        lang: 'sw',
        original: 'Maji ya bomba yanakuja mara mbili kwa wiki. Siku nzuri ni ile sihitaji kununua maji ya mkokoteni.',
        translation: 'Tap water comes twice a week. A good day is one where I do not have to buy water from the handcart.',
      }),
      q('dhaka', 'A mother, 30–44, by voice note', {
        lang: 'bn',
        original: 'পানির লাইনে প্রতিদিন এক ঘণ্টা যায়। কল খুললেই পরিষ্কার পানি পেতে চাই।',
        translation: 'An hour goes in the water line every day. I want clean water just by opening the tap.',
      }),
      q('cusco', 'A woman, 30–44, with a listener', {
        lang: 'qu',
        original: 'Yakunchik pisiyapun, mayuqa manañam ñawpa hinachu.',
        translation: 'Our water has become scarce; the river is no longer as it was.',
      }),
    ],
  },
  ownlang: {
    id: 'ownlang',
    title: 'Being spoken to in my own language at the clinic and the office',
    matter: 'language',
    quotes: [
      q('cusco', 'A mother, 18–29, with a listener', {
        lang: 'qu',
        original: 'Hampina wasipi runasimipi rimapayawanankuta munani.',
        translation: 'I want them to speak to me in Quechua at the health post.',
      }),
      q('kisumu', 'A teacher, 30–44, on the web', {
        lang: 'sw',
        original: 'Daktari aliongea Kiingereza, mama yangu anaelewa Dholuo tu. Nilikuwa mkalimani wake.',
        translation: 'The doctor spoke English; my mother understands only Dholuo. I was her interpreter.',
      }),
      q('glasgow', 'A neighbour, 45–64, on the web', {
        lang: 'en',
        original: "My neighbour's just arrived and nobody at the GP speaks her language. Her wee boy translates for her.",
      }),
    ],
  },
  lonely: {
    id: 'lonely',
    title: 'Nobody old left alone all day',
    matter: 'care',
    quotes: [
      q('krakow', 'A pensioner, 65+, by phone', {
        lang: 'pl',
        original: 'W naszym bloku starsi ludzie siedzą sami całymi dniami. Samotność to tu prawdziwa bieda.',
        translation: 'In our block older people sit alone all day. Samotność is the real poverty here.',
        glosses: [{ word: 'samotność', gloss: 'loneliness; being left alone' }],
      }),
      q('glasgow', 'A son, 45–64, on the web', {
        lang: 'en',
        original: "My dad's on his own since Mum died. Some days the only voice he hears is the telly.",
      }),
    ],
  },
  damp: {
    id: 'damp',
    title: 'A home that is warm and dry through the winter',
    matter: 'home',
    quotes: [
      q('glasgow', 'A parent, 30–44, by phone', {
        lang: 'en',
        original: 'The black mould comes back every winter. I spend Sunday scrubbing the bedroom wall.',
      }),
    ],
  },
  lanes: {
    id: 'lanes',
    title: 'Lanes that do not flood after an hour of rain',
    matter: 'movement',
    quotes: [
      q('dhaka', 'A father, 30–44, by voice note', {
        lang: 'bn',
        original: 'একটু বৃষ্টি হলেই গলিতে হাঁটু পানি। বাচ্চারা স্কুলে যেতে পারে না।',
        translation: 'With even a little rain the lane is knee-deep in water. The children cannot get to school.',
      }),
    ],
  },
  youth: {
    id: 'youth',
    title: 'Somewhere for young people to be in the evening',
    matter: 'safety',
    quotes: [
      q('medellin', 'A youth worker, 18–29, on the web', {
        lang: 'es',
        original: 'Los pelados del barrio no tienen dónde estar por la tarde. Una cancha con luz cambia todo.',
        translation: 'The kids in the neighbourhood have nowhere to be in the afternoon. A pitch with lights changes everything.',
      }),
    ],
  },
  fish: {
    id: 'fish',
    title: 'Fish in the lake, as there used to be',
    matter: 'work',
    quotes: [
      q('kisumu', 'A fisher, 45–64, by phone', {
        lang: 'sw',
        original: 'Samaki ziwani wamepungua. Zamani tulirudi na mitumbwi imejaa.',
        translation: 'The fish in the lake have become fewer. In the past we came back with the boats full.',
      }),
    ],
  },
  fairprice: {
    id: 'fairprice',
    title: 'A fair price for a harvest, so growers can live from their work',
    matter: 'work',
    quotes: [
      q('kisumu', 'A farmer, 45–64, by phone', {
        lang: 'sw',
        original: 'Nauza sukuma wiki kwa bei ile ile ya miaka mitatu iliyopita, lakini mbolea imepanda.',
        translation: 'I sell sukuma wiki (greens) at the same price as three years ago, but fertiliser has gone up.',
      }),
      q('medellin', 'A daughter of coffee growers, 18–29, by voice note', {
        lang: 'es',
        original: 'Mi papá vende el café y el precio no le alcanza ni para pagar los jornaleros.',
        translation: 'My father sells the coffee and the price does not even cover the day labourers.',
      }),
      q('cusco', 'A farmer, 45–64, with a listener', {
        lang: 'qu',
        original: 'Papata pisi qullqillapi rantinku; llamk’asqanchikqa ancha.',
        translation: 'They buy our potatoes for very little money; our work is a great deal.',
      }),
    ],
  },
  cheapfood: {
    id: 'cheapfood',
    title: 'Food a city family can afford every week',
    matter: 'home',
    quotes: [
      q('dhaka', 'A cleaner, 30–44, by phone', {
        lang: 'bn',
        original: 'চালের দাম বাড়লে আমরা মাছ কেনা বন্ধ করে দিই।',
        translation: 'When the price of rice goes up, we stop buying fish.',
      }),
      q('glasgow', 'A single parent, 30–44, on the web', {
        lang: 'en',
        original: 'I go to three shops to get the cheap stuff. It takes my whole Saturday morning.',
      }),
      q('krakow', 'A cashier, 45–64, on the web', {
        lang: 'pl',
        original: 'Ceny w sklepie rosną szybciej niż pensja. Liczę każdy koszyk.',
        translation: 'Prices in the shop rise faster than my pay. I count every basket.',
      }),
    ],
  },
  newhomes: {
    id: 'newhomes',
    title: 'Homes built near work, so the journey shrinks',
    matter: 'home',
    quotes: [
      q('krakow', 'A programmer, 18–29, on the web', {
        lang: 'pl',
        original: 'Dojeżdżam godzinę, bo mieszkanie bliżej pracy kosztuje dwie pensje.',
        translation: 'I commute an hour because a flat nearer work costs two salaries.',
      }),
      q('medellin', 'A cook, 30–44, by voice note', {
        lang: 'es',
        original: 'Vivimos arriba en la loma; bajar al trabajo es una hora. Quisiera vivir cerca, pero un arriendo así no hay.',
        translation: 'We live up on the hill; getting down to work takes an hour. I would like to live nearer, but there is no rent like that.',
      }),
      q('glasgow', 'A nurse, 30–44, on the web', {
        lang: 'en',
        original: "I'd move nearer my work tomorrow if there was anything I could afford.",
      }),
    ],
  },
  green: {
    id: 'green',
    title: 'Keep the trees, squares and quiet that new building takes',
    matter: 'home',
    quotes: [
      q('krakow', 'A retired engineer, 65+, by phone', {
        lang: 'pl',
        original: 'Za blokiem był skwer z drzewami. Teraz stawiają tam kolejny budynek.',
        translation: 'Behind our block there was a square with trees. Now they are putting up another building there.',
      }),
      q('glasgow', 'A shift worker, 45–64, on the web', {
        lang: 'en',
        original: "The park at the end of our street is the only reason I'm still sane.",
      }),
    ],
  },
};

export const WORK_STATEMENTS: Record<Exclude<WorkView, 'unsaid'>, string> = {
  steady: 'A good day has steady work, even long hours, so the family wants for nothing.',
  limit: 'A good day has work that ends in time to live.',
  own: 'A good day is working for myself: my own stall, field or trade.',
  ayni: 'A good day is work shared with neighbours, turn by turn, given and returned (ayni).',
};

export const CARE_STATEMENTS: Record<Exclude<CareView, 'unsaid'>, string> = {
  home: 'Older people are cared for at home, by their family.',
  places: 'Older people need visits and places to go, so nobody is alone and no one daughter carries it all.',
  useful: 'Older people keep working and stay useful for as long as they wish.',
};

export interface Tension {
  id: string;
  title: string;
  a: ThemeId;
  b: ThemeId;
  note: string;
}

export const TENSIONS: Tension[] = [
  {
    id: 'price',
    title: "A grower's fair price is a city family's food bill",
    a: 'fairprice',
    b: 'cheapfood',
    note: 'Both sides describe an ordinary good day. What one needs to be paid, the other needs to pay less.',
  },
  {
    id: 'homes',
    title: 'Homes near work take the green and the quiet',
    a: 'newhomes',
    b: 'green',
    note: 'A shorter journey for some is built on the square that others walk in.',
  },
];

/** The standing statement: written by the circle through its own process, shown whole, never summarised. */
export const STANDING_STATEMENT = {
  layer: 'cusco' as LayerId,
  author: 'An invented Quechua-speaking community near Cusco',
  agreed: 'Agreed at a community gathering, 4 October 2026 (invented)',
  words: {
    lang: 'qu',
    original:
      'Ñuqanchik ayllupi tantanakuspa kayta nirqanchik: Allin p’unchawqa yakunchik ch’uya kaptinmi, allpanchik qhali kaptinmi, ayniwan llamk’aptinchikmi. Runaqa manam sapallanchu kawsan. Kay rimayninchikta ama hukllachaychikchu wakkunawan; kikinta churaychik.',
    translation:
      'Gathered together as our ayllu, we said this: a good day is when our water is clean, when our land is healthy, when we work in ayni. A person does not live alone. Do not merge these words of ours with others; set them down as they are.',
    glosses: [
      { word: 'ayllu', gloss: 'the community of related families and the land they share' },
      { word: 'ayni', gloss: 'help given and returned over time; for us a way of being with each other, not only a way of working' },
    ],
  } satisfies Words,
  framing:
    'This shows how a standing statement would appear. Real ones are written by communities through their own process, and the community holds its own data.',
};

export interface Reply {
  layer: LayerId | 'world';
  /** Which summary it sits beside. */
  beside: string;
  from: string;
  words: Words;
}

export const REPLIES: Reply[] = [
  {
    layer: 'world',
    beside: 'Said differently',
    from: 'Right of reply from the invented Quechua-speaking community near Cusco',
    words: {
      lang: 'qu',
      original: 'Aynitaqa "llamk’ay" nispallam qillqarqankichik. Ñuqanchikpaqqa kawsayninchikmi.',
      translation: 'You wrote ayni down only as "work". For us it is how we live.',
    },
  },
  {
    layer: 'kisumu',
    beside: 'Said almost everywhere',
    from: 'Right of reply from an invented market traders’ group in Kisumu',
    words: {
      lang: 'sw',
      original: 'Muhtasari unasema "barabara". Kwetu ni mitaro ya soko; maji yakijaa, wateja hawaji.',
      translation: 'The summary says "the road". For us it is the market drains; when the water fills them, customers do not come.',
    },
  },
];
