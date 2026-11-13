import type { PersonSpec, ThemeSpec } from './types.js';

/**
 * The shared volunteering tool: 36 invented volunteers and organisers from member groups of the
 * (invented) Northern Volunteer Centres Network, across the north of England and north Wales.
 */

const V = 'I volunteer';
const ORG = 'I organise volunteers for a group';
const BOTH = 'Both';
const N = 'No paid staff';
const S = '1 to 10 paid staff';
const L = 'More than 10 paid staff';
const who = (role: string, group_size: string) => ({ role, group_size });

export const VOLUNTEERING_PEOPLE: PersonSpec[] = [
  {
    key: 'aisha',
    name: 'Aisha',
    about: who(V, S),
    points: [
      ['barrier', 'a', 'repeat', 'Four background checks in two years. Same form, same passport photo, same six-week wait every time.'],
      ['matters', 'c', 'hours', 'I’d like my hours to count for something when I apply for jobs.'],
      ['wish', 'a', 'justhelp', 'Turn up on Saturday, help at the food bank, go home. No forms.'],
    ],
  },
  {
    key: 'bryn',
    name: 'Bryn',
    about: who(V, N),
    points: [
      ['barrier', 'n', 'language', 'Everything’s in English first and Welsh if you ask. Half our volunteers think in Welsh.'],
      ['moment', 'a', 'day', 'Drove an old neighbour to the hospital in Wrexham, waited three hours, drove her back.'],
      ['barrier', 'c', 'travel', 'That hospital run is sixty miles. I don’t claim the petrol because the form is a nightmare.'],
    ],
  },
  {
    key: 'ceri',
    name: 'Ceri',
    about: who(ORG, N),
    points: [
      ['barrier', 'a', 'small', 'We’re six volunteers and a biscuit tin. If it takes more than ten minutes to set up, we won’t.'],
      ['matters', 'c', 'privacy', 'I don’t want our older volunteers’ details sitting on some central list.'],
      ['idea', 'a', 'phone', 'Make it work on a phone. Nobody in our group has a laptop at the hall.'],
    ],
  },
  {
    key: 'delroy',
    name: 'Delroy',
    about: who(V, L),
    points: [
      ['moment', 'a', 'day', 'Saturday I sorted tins at the food bank from nine till one. Best bit of my week, honestly.'],
      ['barrier', 'n', 'repeat', 'Started at the youth club in March. They wanted references again, though I’d given them to the food bank in January.'],
      ['matters', 'a', 'hours', 'I’ve given hundreds of hours. Nowhere is that written down that I can show someone.'],
    ],
  },
  {
    key: 'eilidh',
    name: 'Eilidh',
    about: who(BOTH, S),
    points: [
      ['matters', 'a', 'privacy', 'I want to know who has looked at my details, and when.'],
      ['idea', 'c', 'onelogin', 'One login for every group I help. I’ve got five passwords for five rotas.'],
      ['doubt', 'n', null, 'If it all goes in one system, what happens when the system goes wrong?'],
    ],
  },
  {
    key: 'farah',
    name: 'Farah',
    about: who(V, S),
    points: [
      ['barrier', 'a', 'language', 'My mum wants to help at the mosque food bank. She can’t read the English forms, so I fill them in.'],
      ['idea', 'c', 'translate', 'Forms in the language people speak at home. Mum would sign up herself then.'],
      ['matters', 'n', 'hours', 'I put my hours on my uni application. They asked for proof and I had nothing.'],
    ],
  },
  {
    key: 'gwen',
    name: 'Gwen',
    about: who(ORG, S),
    points: [
      ['barrier', 'a', 'repeat', 'Every group runs its own checks. We’ve got volunteers who give up before they ever start.'],
      ['barrier', 'c', 'small', 'The last system we bought needed a two-day training course. Two people went. Both have left.'],
      ['idea', 'a', 'once', 'Show us a check another group has done, and how old it is. We’ll decide if it’s enough.'],
    ],
  },
  {
    key: 'hassan',
    name: 'Hassan',
    about: who(V, N),
    points: [
      ['idea', 'n', 'once', 'Check me once and let me show it to whoever I like.'],
      ['moment', 'a', 'day', 'Community garden in the morning, homework club after school. Two groups, two rotas, two group chats.'],
      ['barrier', 'c', 'travel', 'The bus to the garden is four pounds twenty return. Some weeks I just don’t go.'],
    ],
  },
  {
    key: 'iqra',
    name: 'Iqra',
    about: who(V, S),
    points: [
      ['matters', 'a', 'hours', 'A record of my hours would help me get a job. Right now it’s just my word.'],
      ['barrier', 'c', 'language', 'My nan speaks Urdu and Punjabi. Every leaflet she gets is in English.'],
      ['wish', 'a', 'justhelp', 'Pick a shift on my phone in the morning, do it in the afternoon. That simple.'],
    ],
  },
  {
    key: 'jolanta',
    name: 'Jolanta',
    about: who(V, L),
    points: [
      ['barrier', 'n', 'language', 'My English is fine for talking, but forms with legal words, I need my daughter.'],
      ['matters', 'a', 'privacy', 'I don’t want every group to see my address. Only the ones I choose.'],
      ['moment', 'c', 'day', 'Thursday I cook at the lunch club. Forty dinners, mostly for old men who live alone.'],
    ],
  },
  {
    key: 'kasia',
    name: 'Kasia',
    about: who(ORG, S),
    points: [
      ['idea', 'a', 'translate', 'Polish from the start. Half the volunteers at our Polish club would sign up tomorrow.'],
      ['barrier', 'c', 'small', 'I do the rota on Sunday nights after my kids are asleep. I need it fast.'],
      ['matters', 'a', 'turnup', 'When someone doesn’t turn up, forty people don’t get lunch.'],
    ],
  },
  {
    key: 'lowri',
    name: 'Lowri',
    about: who(BOTH, N),
    points: [
      ['idea', 'n', 'translate', 'Welsh on the same screen as the English, not hidden behind a button.'],
      ['barrier', 'a', 'repeat', 'I volunteer for three groups. Three checks, three inductions, three lanyards.'],
      ['doubt', 'c', null, 'A shared tool sounds great until someone decides our records are theirs to sell. Who owns it?'],
    ],
  },
  {
    key: 'malik',
    name: 'Malik',
    about: who(V, L),
    points: [
      ['matters', 'a', 'privacy', 'If a group drops me, I want to be able to take my record away from them too.'],
      ['barrier', 'a', 'travel', 'I’m on Universal Credit. The bus to volunteer costs me more than my lunch.'],
      ['matters', 'c', 'hours', 'My hours are proof I can turn up. That matters when you’ve been out of work.'],
    ],
  },
  {
    key: 'nasreen',
    name: 'Nasreen',
    about: who(ORG, L),
    points: [
      ['matters', 'a', 'turnup', 'I need to know someone’s reliable before I put them with vulnerable families.'],
      ['barrier', 'c', 'repeat', 'We redo checks because we can’t see what another group did. It’s not that we don’t trust them.'],
      ['doubt', 'n', null, 'Rating volunteers makes me uneasy. People have bad months.'],
    ],
  },
  {
    key: 'oliver',
    name: 'Oliver',
    about: who(V, S),
    points: [
      ['moment', 'a', 'day', 'Two hours at the hospice shop sorting donations. I priced a wedding dress at forty pounds.'],
      ['barrier', 'a', 'repeat', 'At seventy-two I’ve been checked more times than a parcel.'],
      ['wish', 'c', 'justhelp', 'Help where I’m needed that week, without signing up somewhere new each time.'],
    ],
  },
  {
    key: 'pat',
    name: 'Pat',
    about: who(ORG, N),
    points: [
      ['barrier', 'a', 'small', 'We tried a free app once. Nobody could work out the password reset, so it died.'],
      ['idea', 'n', 'phone', 'If it works like the messaging apps on a phone, our lot will use it. If it needs a computer, no.'],
      ['barrier', 'c', 'travel', 'Our drivers pay their own petrol. I feel terrible, but there’s no money for it.'],
    ],
  },
  {
    key: 'qasim',
    name: 'Qasim',
    about: who(V, S),
    points: [
      ['barrier', 'a', 'travel', 'I volunteer across town because that’s where I’m needed. The fares add up to twenty quid a month.'],
      ['matters', 'c', 'hours', 'If I give the hours, the record should be mine, not the charity’s.'],
      ['idea', 'a', 'once', 'My check should travel with me, like my bus pass.'],
    ],
  },
  {
    key: 'rhiannon',
    name: 'Rhiannon',
    about: who(ORG, S),
    points: [
      ['barrier', 'a', 'language', 'We lose older Welsh-speaking volunteers at the sign-up stage. They phone instead, then give up.'],
      ['idea', 'c', 'phone', 'Sign-up has to work on an old phone with bad signal. That’s rural Wales.'],
      ['matters', 'n', 'turnup', 'Reliability matters, but I’d rather talk to someone than read a score.'],
    ],
  },
  {
    key: 'shirley',
    name: 'Shirley',
    about: who(V, N),
    points: [
      ['moment', 'a', 'day', 'Knitted for the baby bank all morning, then did the teas at the church hall. Lovely day.'],
      ['doubt', 'a', null, 'I’m not good with computers. Will there still be a paper form?'],
      ['barrier', 'c', 'repeat', 'The church hall wanted my details again, and I’ve made the teas there for nine years.'],
    ],
  },
  {
    key: 'tariq',
    name: 'Tariq',
    about: who(BOTH, S),
    points: [
      ['idea', 'a', 'once', 'Do the check once, properly, and let each group see the result if I say so.'],
      ['matters', 'n', 'hours', 'My hours got me my job at the council. I had to dig out old emails to prove them.'],
      ['barrier', 'c', 'small', 'Our treasurer is eighty. If she can’t use it, we can’t use it.'],
    ],
  },
  {
    key: 'una',
    name: 'Una',
    about: who(V, L),
    points: [
      ['matters', 'a', 'privacy', 'I volunteer at a domestic abuse charity. My details being passed around could be dangerous for me.'],
      ['barrier', 'a', 'repeat', 'Each group asked for my whole address history again. Five years of addresses, five times.'],
      ['wish', 'c', 'justhelp', 'Being able to help without explaining my whole life to each new group.'],
    ],
  },
  {
    key: 'viktor',
    name: 'Viktor',
    about: who(V, S),
    points: [
      ['barrier', 'a', 'language', 'I came from Ukraine two years ago. I read English slowly. The forms are long and the words are hard.'],
      ['matters', 'c', 'hours', 'Volunteering helped my English and my CV. I want the hours written down.'],
      ['moment', 'n', 'day', 'Today I fixed bikes at the repair café. Six bikes, one very happy child.'],
    ],
  },
  {
    key: 'wendy',
    name: 'Wendy',
    about: who(ORG, N),
    points: [
      ['barrier', 'a', 'small', 'I’m the only organiser and I work full time. Ten minutes is all I have.'],
      ['matters', 'c', 'turnup', 'Knowing who’s coming on Saturday is the whole job, really.'],
      ['barrier', 'a', 'travel', 'Volunteers ask if we pay bus fares. We can’t. Some stop coming.'],
    ],
  },
  {
    key: 'yasmin',
    name: 'Yasmin',
    about: who(V, S),
    points: [
      ['idea', 'a', 'onelogin', 'One place for all my rotas. I double-booked myself twice last month.'],
      ['matters', 'c', 'privacy', 'I should be able to see who looked at my record. It’s my information.'],
      ['barrier', 'n', 'repeat', 'I gave up on volunteering at the hospital. The checks took four months.'],
    ],
  },
  {
    key: 'zofia',
    name: 'Zofia',
    about: who(V, L),
    points: [
      ['barrier', 'a', 'language', 'My mother wants to help at the Polish Saturday school. The forms are only in English, so she doesn’t.'],
      ['matters', 'c', 'hours', 'Every hour I give, I write in a notebook. A notebook is not proof.'],
      ['wish', 'a', 'justhelp', 'One form, in Polish, and then I can help anywhere.'],
    ],
  },
  {
    key: 'adebayo',
    name: 'Adebayo',
    about: who(BOTH, S),
    points: [
      ['barrier', 'a', 'repeat', 'I run a youth football club and I help at the food bank. Two checks, same month, same me.'],
      ['matters', 'n', 'turnup', 'With kids, reliability matters more than anything.'],
      ['idea', 'c', 'once', 'Prove it once, then let me decide who sees it.'],
    ],
  },
  {
    key: 'bilal',
    name: 'Bilal',
    about: who(V, N),
    points: [
      ['barrier', 'a', 'travel', 'I’m a student. Petrol for the soup run comes out of my food money.'],
      ['matters', 'c', 'hours', 'I want my volunteering on record, so employers see more than my grades.'],
      ['doubt', 'n', null, 'Will groups get pushy if they can see I volunteer somewhere else as well?'],
    ],
  },
  {
    key: 'colin',
    name: 'Colin',
    about: who(ORG, L),
    points: [
      ['matters', 'a', 'privacy', 'Groups need to see a check is valid. They don’t need to see everything in it.'],
      ['barrier', 'n', 'small', 'Our staff can learn anything. It’s the tiny groups we partner with that would struggle.'],
      ['matters', 'c', 'turnup', 'Ratings sound useful until someone gets a bad one for being ill.'],
    ],
  },
  {
    key: 'dorota',
    name: 'Dorota',
    about: who(V, S),
    points: [
      ['barrier', 'c', 'language', 'I translate for the other Polish volunteers. Every new form, I’m on the phone for an hour.'],
      ['matters', 'a', 'privacy', 'Who sees my record should be my choice, every time.'],
      ['moment', 'a', 'day', 'Packed food parcels till twelve, then took two round to people who can’t come in.'],
    ],
  },
  {
    key: 'elaine',
    name: 'Elaine',
    about: who(ORG, N),
    points: [
      ['barrier', 'a', 'small', 'Volunteers manage the volunteers here. Nobody has time to learn a new system.'],
      ['idea', 'c', 'phone', 'Something I can do on the bus home. That’s when I do the admin.'],
      ['barrier', 'n', 'travel', 'Bus fares are why our younger volunteers drift off.'],
    ],
  },
  {
    key: 'frank',
    name: 'Frank',
    about: who(V, N),
    points: [
      ['moment', 'a', 'day', 'Drove the minibus for the lunch club. Twelve passengers, four stops, one lost hat.'],
      ['barrier', 'c', 'travel', 'I put sixty quid of diesel in the minibus myself last month.'],
      ['doubt', 'n', null, 'Happy to try a new thing. I just don’t want it to need an email address for everyone.'],
    ],
  },
  {
    key: 'gloria',
    name: 'Gloria',
    about: who(V, S),
    points: [
      ['barrier', 'n', 'repeat', 'Moved from the shelter to the food bank and started again from zero, like I was a stranger.'],
      ['matters', 'a', 'hours', 'My hours are mine. I want them when I leave a group, not left behind.'],
      ['wish', 'c', 'justhelp', 'Help on a Tuesday, see it written down by Wednesday, no chasing.'],
    ],
  },
  {
    key: 'huw',
    name: 'Huw',
    about: who(ORG, S),
    points: [
      ['barrier', 'a', 'language', 'We’re expected to offer Welsh. Most tools don’t, so we print everything twice.'],
      ['matters', 'c', 'turnup', 'I want to know if someone’s coming, not a star rating of them.'],
      ['idea', 'a', 'phone', 'Ten minutes, on a phone, without a manual. If it does that, we’re in.'],
    ],
  },
  {
    key: 'imogen',
    name: 'Imogen',
    about: who(V, L),
    points: [
      ['matters', 'a', 'hours', 'I need a record of hours for my college application. Signed off by the group, held by me.'],
      ['idea', 'n', 'onelogin', 'One profile, and I choose which groups can see it.'],
      ['barrier', 'c', 'travel', 'Mum drives me because there’s no bus on Sundays. Not everyone has a mum with a car.'],
    ],
  },
  {
    key: 'janet',
    name: 'Janet',
    about: who(ORG, N),
    points: [
      ['barrier', 'a', 'small', 'I’m sixty-eight and I run the befriending group. Make it simple or I’ll stick with my notebook.'],
      ['matters', 'a', 'turnup', 'Some of our befrienders are the only visitor a person gets. They have to turn up.'],
      ['doubt', 'c', null, 'If the network starts charging for it later, we’ll be stuck.'],
    ],
  },
  {
    key: 'kieran',
    name: 'Kieran',
    about: who(V, S),
    points: [
      ['moment', 'c', 'day', 'Two hours at the park clean-up, then the pub with the others. Best Sunday in ages.'],
      ['barrier', 'a', 'repeat', 'Signed up for a one-off litter pick and they wanted a full background check. For litter.'],
      ['idea', 'n', 'once', 'If I’m checked for one thing, let it count for the next.'],
    ],
  },
];

export const VOLUNTEERING_THEMES: ThemeSpec[] = [
  {
    key: 'hours',
    kind: 'matters',
    name: 'My hours are mine',
    sentences: [
      { text: 'Volunteers want a record of the hours they give that they can show to employers, colleges and benefit offices.', from: ['aisha/2', 'iqra/1', 'farah/3', 'bilal/2', 'imogen/1'] },
      { text: 'They say the record should belong to them and go with them when they leave a group.', from: ['gloria/2', 'qasim/2', 'delroy/3'] },
    ],
  },
  {
    key: 'privacy',
    kind: 'matters',
    name: 'I want to know who has looked at my details',
    sentences: [{ text: 'People want to choose which groups see their record, see who has looked at it, and take access away.', from: ['eilidh/1', 'jolanta/2', 'malik/1', 'yasmin/2', 'dorota/2', 'una/1'] }],
  },
  {
    key: 'turnup',
    kind: 'matters',
    name: 'They have to turn up',
    sentences: [
      { text: 'Organisers say knowing who will turn up is the heart of the job, because people depend on it.', from: ['janet/2', 'kasia/3', 'wendy/2', 'nasreen/1'] },
      { text: 'Several are wary of scoring volunteers, and would rather talk to someone.', from: ['rhiannon/3', 'huw/2', 'colin/3'] },
    ],
  },
  {
    key: 'repeat',
    kind: 'barrier',
    name: 'Three checks, three inductions, three lanyards',
    sentences: [
      { text: 'Volunteers who help more than one group go through the same checks again and again, sometimes waiting months.', from: ['lowri/2', 'aisha/1', 'adebayo/1', 'yasmin/3', 'una/2'] },
      { text: 'Organisers say they repeat checks because they cannot see what another group already did.', from: ['nasreen/2', 'gwen/1'] },
    ],
  },
  {
    key: 'small',
    kind: 'barrier',
    name: 'Nobody has time to learn a new system',
    sentences: [{ text: 'Groups with no paid staff say they have minutes, not days, and past systems died because nobody could use them.', from: ['elaine/1', 'ceri/1', 'wendy/1', 'pat/1', 'janet/1', 'gwen/2'] }],
  },
  {
    key: 'language',
    kind: 'barrier',
    name: 'The forms are only in English',
    sentences: [{ text: 'Welsh, Urdu, Punjabi, Polish and Ukrainian speakers, or their families, are put off or need help because forms are only in English.', from: ['zofia/1', 'bryn/1', 'farah/1', 'rhiannon/1', 'viktor/1', 'dorota/1'] }],
  },
  {
    key: 'travel',
    kind: 'barrier',
    name: 'Costs me more than my lunch',
    sentences: [{ text: 'Bus fares and petrol come out of volunteers’ own pockets, and some stop coming because of it.', from: ['malik/2', 'bilal/1', 'qasim/1', 'hassan/3', 'wendy/3', 'frank/2'] }],
  },
  {
    key: 'day',
    kind: 'day',
    name: 'Best bit of my week',
    sentences: [{ text: 'A volunteering day is driving, cooking, sorting and fixing, and people describe it warmly.', from: ['delroy/1', 'jolanta/3', 'viktor/3', 'frank/1', 'kieran/1'] }],
  },
  {
    key: 'justhelp',
    kind: 'day',
    name: 'Help where I’m needed',
    sentences: [{ text: 'A good day is turning up to help without new forms or explaining yourself again.', from: ['oliver/3', 'aisha/3', 'una/3', 'zofia/3'] }],
  },
  {
    key: 'once',
    kind: 'idea',
    name: 'Check me once',
    sentences: [{ text: 'People suggest one check that the volunteer holds and chooses to show to each group.', from: ['hassan/1', 'tariq/1', 'qasim/3', 'adebayo/3', 'kieran/3', 'gwen/3'] }],
  },
  {
    key: 'phone',
    kind: 'idea',
    name: 'Make it work on a phone',
    sentences: [{ text: 'Organisers of small groups do their admin on a phone, often on the move, and want the tool to work there first.', from: ['ceri/3', 'pat/2', 'elaine/2', 'rhiannon/2', 'huw/3'] }],
  },
  {
    key: 'translate',
    kind: 'idea',
    name: 'Forms in the language people speak at home',
    sentences: [{ text: 'People ask for Welsh and Polish on the same screen as English, and forms in the languages families speak.', from: ['farah/2', 'kasia/1', 'lowri/1'] }],
  },
  {
    key: 'onelogin',
    kind: 'idea',
    name: 'One login for every group I help',
    sentences: [{ text: 'Volunteers who help several groups want one profile and one place for all their rotas.', from: ['eilidh/2', 'yasmin/1', 'imogen/2'] }],
  },
];
