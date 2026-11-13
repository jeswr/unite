import type { PersonSpec, ThemeSpec } from './types.js';
import { DARREN, GEMMA, JAS, KOFI } from './transcripts.js';

/**
 * Riverbend (an invented town): 48 invited participants, each with a completed conversation.
 * Every point is something that person said about their own week, in their own words.
 */

const S = 'I work shifts or nights';
const D = 'I work regular daytime hours';
const O = 'I am out of work';
const B = 'I run or manage a local business';
const ST = 'I am studying';
const E = 'Something else';
const U = 'Under 25';
const M = '25 to 49';
const F = '50 or over';
const who = (work: string, care: 'Yes' | 'No', age: string) => ({ work, care, age });

export const EARNING_PEOPLE: PersonSpec[] = [
  { key: 'kofi', name: 'Kofi', about: who(S, 'No', M), points: [], transcript: KOFI },
  {
    key: 'sandra',
    name: 'Sandra',
    about: who(S, 'Yes', F),
    points: [
      ['barrier', 'a', 'classes', 'I finish at eight in the morning. The level 3 course is Tuesday mornings at nine. I’d be asleep on the desk.'],
      ['matters', 'n', 'needed', 'I’ve done this twenty-two years. I can tell when someone’s poorly before the monitor does.'],
      ['barrier', 'a', 'counts', 'They want me to sit a course on moving and handling. I’ve taught half the agency staff how to do it.'],
      ['wish', 'c', 'goodday', 'Home by half eight, sleep till two, and still have the afternoon with my grandson.'],
    ],
  },
  {
    key: 'bev',
    name: 'Bev',
    about: who(S, 'Yes', F),
    points: [
      ['barrier', 'a', 'classes', 'My rota changes every three weeks. Any course with fixed nights, I’d miss a third of it.'],
      ['doubt', 'c', null, 'They keep saying driverless buses. I’ll believe it when one gets up Mill Lane in the snow.'],
      ['matters', 'a', 'family', 'My husband’s had two strokes. Time with my family isn’t a nice extra, it’s the whole point.'],
      ['idea', 'n', 'catchup', 'Record the classes so I can watch them on my break in the depot canteen.'],
    ],
  },
  {
    key: 'tomasz',
    name: 'Tomasz',
    about: who(S, 'Yes', M),
    points: [
      ['barrier', 'c', 'classes', 'Two weeks days, two weeks nights. Nothing at the college fits that.'],
      ['moment', 'a', 'daynow', 'Yesterday I picked eleven hundred lines and the scanner told me I was four percent slow.'],
      ['tradeoff', 'a', null, 'I would take less money for a job where a scanner is not watching me all day.'],
      ['idea', 'n', 'paidhours', 'If the company pays two hours a week for learning, I come. If not, I need the overtime.'],
    ],
  },
  {
    key: 'priya',
    name: 'Priya',
    about: who(D, 'No', M),
    points: [
      ['moment', 'a', 'daynow', 'Thursday night class: twelve enrolled, five came. Three texted to say their shift had been changed.'],
      ['matters', 'n', 'together', 'The best bit is when the room starts helping each other and I can stop talking.'],
      ['idea', 'a', 'catchup', 'Let people switch between the Tuesday and Thursday group when their rota changes. It costs nothing.'],
      ['doubt', 'c', null, 'Half my learners already use AI for their homework. I’m not sure if that’s cheating or just how it is now.'],
    ],
  },
  {
    key: 'gareth',
    name: 'Gareth',
    about: who(D, 'Yes', F),
    points: [
      ['matters', 'n', 'needed', 'I trained as an electrician. Wiring a house is still wiring a house, whatever the computer does.'],
      ['barrier', 'a', 'counts', 'I’ve got lads who can strip an engine but can’t get the paperwork that says so.'],
      ['doubt', 'a', null, 'I’m wary of chasing whatever’s in the news. Five years ago it was all coding bootcamps.'],
      ['idea', 'c', 'bring', 'Let us teach on the industrial estate. Half my students are already there at half four.'],
    ],
  },
  {
    key: 'lena',
    name: 'Lena',
    about: who(S, 'Yes', M),
    points: [
      ['barrier', 'a', 'classes', 'I’m on lates at the shop till ten. The classes start at six.'],
      ['barrier', 'c', 'earning', 'I can’t drop hours. The rent went up ninety quid in March.'],
      ['matters', 'n', 'family', 'Saturday morning swimming with my two is the one thing I don’t give up.'],
      ['moment', 'a', 'daynow', 'They put in self-checkouts. Now I’m the one who comes running when they beep.'],
    ],
  },
  { key: 'darren', name: 'Darren', about: who(O, 'No', F), points: [], transcript: DARREN },
  { key: 'jas', name: 'Jas', about: who(B, 'Yes', M), points: [], transcript: JAS },
  {
    key: 'mo',
    name: 'Mo',
    about: who(B, 'Yes', M),
    points: [
      ['tradeoff', 'a', null, 'I’d love my staff to learn, but there are three of us and Wednesday is market day.'],
      ['matters', 'a', 'needed', 'People come in for the chat as much as the coffee. No machine is doing that.'],
      ['idea', 'c', 'catchup', 'Short courses, two hours, at the start of the week when it’s quiet.'],
      ['doubt', 'n', null, 'Everyone says AI. I used it once to write the menu and it invented a soup.'],
    ],
  },
  {
    key: 'helen',
    name: 'Helen',
    about: who(B, 'No', F),
    points: [
      ['idea', 'c', 'paidhours', 'I’d pay for training hours if the council matched it. On my margins I can’t do it alone.'],
      ['matters', 'n', 'needed', 'Care is skilled work. I’d like the qualification to say so, and the pay to follow.'],
      ['doubt', 'a', null, 'The rota software is clever. It still sent a man to a lady who’d asked for women only.'],
      ['barrier', 'a', 'counts', 'My best senior has no certificates at all. On paper she isn’t qualified to train the new ones.'],
    ],
  },
  {
    key: 'femi',
    name: 'Femi',
    about: who(B, 'Yes', M),
    points: [
      ['idea', 'a', 'askus', 'I can’t find anyone who can run floor machines. The college has never once asked me what I need.'],
      ['matters', 'a', 'family', 'I started the business so I could do the school run. Mostly I can.'],
      ['tradeoff', 'c', null, 'Contracts are won on price. Every hour of training I pay for, I lose on the next tender.'],
    ],
  },
  {
    key: 'chloe',
    name: 'Chloe',
    about: who(ST, 'No', U),
    points: [
      ['barrier', 'a', 'nojob', 'My careers adviser said “something in digital”. That’s not a job, that’s a direction.'],
      ['idea', 'n', 'young', 'Ask people my age before you design the courses. We’re the ones who’ll be doing them longest.'],
      ['wish', 'a', 'goodday', 'A job that isn’t zero hours, and a flat I share with one person, not four.'],
      ['doubt', 'c', null, 'I use AI every day. I don’t know if that makes me better or worse at anything.'],
    ],
  },
  {
    key: 'ryan',
    name: 'Ryan',
    about: who(S, 'No', U),
    points: [
      ['moment', 'a', 'daynow', 'Ten hours on the line, then FIFA with my brother. That’s most days, honestly.'],
      ['matters', 'a', 'leave', 'I like that you know where you are at the warehouse. Turn up, do it, go home.'],
      ['idea', 'c', 'young', 'Put it on TikTok or something. Nobody my age is reading a college leaflet.'],
    ],
  },
  {
    key: 'aaliyah',
    name: 'Aaliyah',
    about: who(O, 'Yes', U),
    points: [
      ['barrier', 'n', 'childcare', 'No childcare during classes, so that’s that. My mum works too.'],
      ['wish', 'a', 'goodday', 'Drop my son at nursery, do a shift at the pharmacy, pick him up. Simple, but I’d love it.'],
      ['idea', 'a', 'young', 'Under 25 and out of work, you’re a number. Let some of us sit on whatever decides this.'],
      ['barrier', 'c', 'earning', 'If I do a course my Universal Credit might change. I can’t risk it with a little one.'],
    ],
  },
  {
    key: 'rosa',
    name: 'Rosa',
    about: who(S, 'Yes', M),
    points: [
      ['barrier', 'a', 'classes', 'I do split shifts, seven till eleven and four till ten. The gap in the middle is for my kids, not college.'],
      ['barrier', 'c', 'earning', 'Every hour in a classroom is an hour I’m not paid. Who pays the gas then?'],
      ['matters', 'a', 'together', 'I learned more from the other carers in my first week than from all the online modules.'],
      ['wish', 'n', 'goodday', 'A rota I know a month ahead. That’s all. Then I can plan anything.'],
    ],
  },
  {
    key: 'marek',
    name: 'Marek',
    about: who(S, 'No', F),
    points: [
      ['barrier', 'c', 'classes', 'English classes are at ten in the morning. I clean at the hospital from ten at night till six.'],
      ['matters', 'a', 'needed', 'When the ward is clean, the nurses say thank you. That is a good night.'],
      ['idea', 'a', 'bring', 'A teacher could come to the hospital canteen at six in the morning. Many of us would stay.'],
    ],
  },
  {
    key: 'shabnam',
    name: 'Shabnam',
    about: who(D, 'Yes', M),
    points: [
      ['barrier', 'a', 'childcare', 'The class was six till eight. Childminders finish at six. I did the maths.'],
      ['matters', 'c', 'family', 'I want my daughters to see me finish something.'],
      ['idea', 'n', 'creche', 'A crèche in the same building, even a small one. Then I’d sign up tomorrow.'],
    ],
  },
  {
    key: 'ade',
    name: 'Ade',
    about: who(O, 'Yes', M),
    points: [
      ['moment', 'a', 'daynow', 'Job centre at ten, two applications, then I collected the kids. Same as last week.'],
      ['barrier', 'a', 'earning', 'I’d retrain tomorrow if I could still pay the rent while I did it.'],
      ['barrier', 'n', 'nojob', 'Six years in a call centre and now it’s a chatbot. What do I retrain as, so it doesn’t happen again?'],
      ['doubt', 'c', null, 'I’m not against AI. I’m against finding out from a letter.'],
    ],
  },
  {
    key: 'maureen',
    name: 'Maureen',
    about: who(D, 'Yes', F),
    points: [
      ['matters', 'n', 'leave', 'I’m sixty-one. I don’t want a new career. I want the one I’ve got to last five more years.'],
      ['matters', 'a', 'family', 'Tuesdays I have my granddaughter. That’s not moving for anyone.'],
      ['matters', 'c', 'together', 'I tried online. Just me, a screen and a quiz. I want to learn with other people, not alone on a screen.'],
    ],
  },
  {
    key: 'liam',
    name: 'Liam',
    about: who(D, 'No', M),
    points: [
      ['moment', 'a', 'daynow', 'Half my calls now are people who already tried the chatbot and are furious by the time they get me.'],
      ['barrier', 'c', 'earning', 'I’d do a course in the evenings, but I’m doing overtime to save a deposit.'],
      ['matters', 'a', 'needed', 'I’m good at calming people down. I didn’t know that was a skill until someone said.'],
      ['doubt', 'n', null, 'Maybe the bot gets good enough that they don’t need me. Maybe it doesn’t. I’d like to know which.'],
    ],
  },
  {
    key: 'nadia',
    name: 'Nadia',
    about: who(D, 'Yes', M),
    points: [
      ['matters', 'a', 'family', 'I work school hours on purpose. Time with my family comes first and I’m not sorry.'],
      ['idea', 'c', 'catchup', 'Courses in the school holidays, when the building’s empty anyway.'],
      ['doubt', 'a', null, 'The council keeps launching schemes. I’ve never met anyone who’s been on one.'],
    ],
  },
  {
    key: 'stuart',
    name: 'Stuart',
    about: who(S, 'Yes', F),
    points: [
      ['barrier', 'a', 'classes', 'Earlies one week, lates the next. The forklift refresher was only ever on a Wednesday afternoon.'],
      ['barrier', 'n', 'counts', 'Thirty years on forklifts and I needed a new ticket because my old one was from a different firm.'],
      ['matters', 'c', 'leave', 'Honestly I’m happy. I’d like it to stay that way till I retire.'],
    ],
  },
  {
    key: 'yusuf',
    name: 'Yusuf',
    about: who(S, 'Yes', M),
    points: [
      ['barrier', 'c', 'classes', 'I drive for the app till two in the morning. Daytime is sleep and school pickups.'],
      ['barrier', 'a', 'earning', 'If I don’t drive, I don’t earn. No sick pay, no study leave, nothing.'],
      ['doubt', 'a', null, 'The app decides my rate. I don’t know how. Learning more won’t change that.'],
      ['idea', 'n', 'catchup', 'Short lessons I can do in the car between drops, with a real tutor once a week.'],
    ],
  },
  { key: 'gemma', name: 'Gemma', about: who(S, 'Yes', M), points: [], transcript: GEMMA },
  {
    key: 'ewa',
    name: 'Ewa',
    about: who(S, 'Yes', M),
    points: [
      ['barrier', 'a', 'classes', 'Nights, four on, four off. Every course wants the same evening every week.'],
      ['idea', 'n', 'catchup', 'Let me catch up when my rota changes, not start again from week one.'],
      ['matters', 'a', 'needed', 'I train all the new pickers. Nobody calls that teaching, but it is.'],
      ['wish', 'c', 'goodday', 'Day shifts, a bit more money, and my Polish counted so I can be a team leader.'],
    ],
  },
  {
    key: 'paul',
    name: 'Paul',
    about: who(O, 'No', F),
    points: [
      ['moment', 'a', 'daynow', 'The print works closed in June. I still wake at five. I walk the dog because I don’t know what else to do.'],
      ['barrier', 'c', 'nojob', 'Thirty-four years setting presses. Ask anyone what’ll be around in five years and they just shrug.'],
      ['barrier', 'a', 'counts', 'I can fix any machine you show me. I haven’t got a single certificate to prove it.'],
      ['tradeoff', 'n', null, 'I’m not after a career. I’m after a reason to get up, and I’d take less money for it.'],
    ],
  },
  {
    key: 'sunita',
    name: 'Sunita',
    about: who(D, 'Yes', F),
    points: [
      ['matters', 'a', 'needed', 'People tell me things at the counter they won’t tell the doctor. That counts for something.'],
      ['doubt', 'c', null, 'If a machine does the prescriptions, fine. Who notices the lady who’s stopped coming in?'],
      ['idea', 'n', 'aiuse', 'Teach us how to check what the computer says, not just which buttons to press.'],
    ],
  },
  {
    key: 'dean',
    name: 'Dean',
    about: who(S, 'No', M),
    points: [
      ['barrier', 'a', 'classes', 'Nights, twelve hours. The college closes before I wake up.'],
      ['moment', 'c', 'daynow', 'Most nights it’s me, the cameras and a flask. I’ve done three online courses at that desk.'],
      ['idea', 'a', 'catchup', 'Night classes. Actual night ones, two in the morning, online, for people like me.'],
    ],
  },
  {
    key: 'grace',
    name: 'Grace',
    about: who(S, 'Yes', M),
    points: [
      ['barrier', 'n', 'classes', 'I asked about the nursing access course. Days only. I work days. End of conversation.'],
      ['matters', 'a', 'needed', 'One lady only eats if I sit with her. That’s not on any care plan.'],
      ['barrier', 'c', 'counts', 'Ten years of care and a level 2 from 2016, and they want me at level 1. What I already know doesn’t count.'],
      ['wish', 'a', 'goodday', 'A nurse by forty. Working in the same town, knowing the same families.'],
    ],
  },
  {
    key: 'ibrahim',
    name: 'Ibrahim',
    about: who(S, 'Yes', M),
    points: [
      ['barrier', 'a', 'earning', 'Three kids and a mortgage. I can’t stop earning to learn, not even for six months.'],
      ['idea', 'n', 'paidhours', 'Pay the hours. Two hours a week on the clock and I’d do any course you like.'],
      ['doubt', 'c', null, 'They’ve put robots in at the new site. I don’t know if we’re next or if it’s just talk.'],
    ],
  },
  {
    key: 'kerry',
    name: 'Kerry',
    about: who(O, 'Yes', M),
    points: [
      ['barrier', 'a', 'childcare', 'Two under five. Any class means paying a childminder more than I’d earn after.'],
      ['idea', 'c', 'creche', 'A crèche on site. Even two hours. That’s the difference.'],
      ['matters', 'n', 'family', 'I want to work, but I want to be there for tea. That’s not much to ask.'],
      ['barrier', 'a', 'earning', 'If I study, my money changes and it takes eight weeks to sort. I can’t go eight weeks.'],
    ],
  },
  {
    key: 'hamid',
    name: 'Hamid',
    about: who(S, 'Yes', F),
    points: [
      ['barrier', 'a', 'classes', 'I start at the bakery at four. By seven in the evening I’m asleep in the chair.'],
      ['matters', 'n', 'needed', 'The machine mixes. I decide when the bread is ready. That part is still hands.'],
      ['idea', 'c', 'bring', 'Saturday afternoon at the mosque hall. People would come, and bring their cousins.'],
    ],
  },
  {
    key: 'jo',
    name: 'Jo',
    about: who(D, 'No', F),
    points: [
      ['moment', 'a', 'daynow', 'The new software does the bank reconciliation in a minute. Used to take me a morning.'],
      ['barrier', 'c', 'nojob', 'I’m not sure what’s left for me to do in two years. I’d rather know now.'],
      ['idea', 'a', 'aiuse', 'Show me properly how to use the thing. Then I’m the one who checks it, not the one it replaces.'],
      ['matters', 'n', 'leave', 'I quite like my job. If it has to change, I’d like it to change slowly.'],
    ],
  },
  {
    key: 'carl',
    name: 'Carl',
    about: who(S, 'No', M),
    points: [
      ['barrier', 'c', 'classes', 'Nights at the supermarket. The evening courses start exactly when I clock in.'],
      ['barrier', 'a', 'earning', 'I’d lose my night premium if I went on days to study. That’s a third of my wage.'],
      ['matters', 'n', 'together', 'I left school at fifteen. I’d only go back if there were other people like me in the room.'],
    ],
  },
  {
    key: 'faith',
    name: 'Faith',
    about: who(S, 'Yes', F),
    points: [
      ['barrier', 'a', 'classes', 'I do nights at the care home. A course on Tuesday mornings means no sleep that day.'],
      ['matters', 'c', 'family', 'Sunday is church and my grandchildren. I won’t give that up for a course.'],
      ['doubt', 'a', null, 'They talk about robots lifting residents. I’ve seen the hoist break. I’m not sure.'],
      ['wish', 'n', 'goodday', 'Finishing a shift and still having the energy to cook properly.'],
    ],
  },
  {
    key: 'nicole',
    name: 'Nicole',
    about: who(D, 'Yes', M),
    points: [
      ['moment', 'a', 'daynow', 'Phones open at eight. By ten past, every appointment’s gone and I’ve been sworn at twice.'],
      ['doubt', 'c', null, 'They’re bringing in an online triage thing. It might help me or it might replace me.'],
      ['idea', 'a', 'aiuse', 'Train us on it before it goes live, not after it’s gone wrong.'],
      ['matters', 'n', 'needed', 'I know which patients won’t ring back. A form doesn’t.'],
    ],
  },
  {
    key: 'mei',
    name: 'Mei',
    about: who(B, 'Yes', M),
    points: [
      ['idea', 'n', 'askus', 'Find out what the salons are short of. I can’t find anyone qualified in lashes and it’s half my bookings.'],
      ['barrier', 'a', 'counts', 'I trained in Hong Kong for three years. Here it counts for nothing.'],
      ['matters', 'c', 'family', 'My girls get the hours that fit school. That’s why they stay.'],
    ],
  },
  {
    key: 'andy',
    name: 'Andy',
    about: who(O, 'No', F),
    points: [
      ['barrier', 'a', 'nojob', 'My back’s done for scaffolding. Nobody’s told me what a fifty-five-year-old scaffolder does next.'],
      ['matters', 'c', 'needed', 'I’m good with lads. I could teach them safety better than any video.'],
      ['wish', 'a', 'goodday', 'Teaching apprentices two days a week. Thirty years of what not to do, put to some use.'],
    ],
  },
  {
    key: 'precious',
    name: 'Precious',
    about: who(S, 'Yes', M),
    points: [
      ['barrier', 'n', 'classes', 'Twelve-hour shifts, three a week, different days each week. No evening class works with that.'],
      ['barrier', 'a', 'earning', 'The nursing apprenticeship pays less than I get now. I’d be paying to learn.'],
      ['matters', 'a', 'needed', 'Patients remember who held their hand. They don’t remember the machine.'],
      ['idea', 'c', 'paidhours', 'If the trust paid two study hours a week, half the HCAs on my ward would sign up for nursing.'],
    ],
  },
  {
    key: 'terry',
    name: 'Terry',
    about: who(D, 'Yes', F),
    points: [
      ['matters', 'n', 'leave', 'Don’t fix what isn’t broken. The evening classes are fine if you can get to them.'],
      ['moment', 'a', 'daynow', 'Changed a gearbox this morning. The diagnostics computer said it was the sensor. It wasn’t.'],
      ['tradeoff', 'c', null, 'I’d rather the money went on buses that run late than on fancy new courses.'],
    ],
  },
  {
    key: 'zainab',
    name: 'Zainab',
    about: who(D, 'Yes', M),
    points: [
      ['barrier', 'a', 'childcare', 'I’m a teaching assistant and I still can’t find childcare for a six o’clock class. Funny, that.'],
      ['idea', 'n', 'creche', 'Use the school buildings in the evening. Kids in one room, parents learning next door.'],
      ['wish', 'c', 'goodday', 'Qualified teacher, my own class, home by five most days.'],
    ],
  },
  {
    key: 'kev',
    name: 'Kev',
    about: who(S, 'No', M),
    points: [
      ['barrier', 'a', 'earning', 'I’m not paying for a course out of what I earn. I’ve got nothing left by the twentieth.'],
      ['doubt', 'a', null, 'Learn AI? To do what? Tell the robot it’s doing well?'],
      ['matters', 'c', 'together', 'I’d go if my mates went. On my own, no chance.'],
    ],
  },
  {
    key: 'lucy',
    name: 'Lucy',
    about: who(D, 'Yes', M),
    points: [
      ['moment', 'c', 'daynow', 'Folded the same table of jumpers six times because people keep unfolding them. Then the school run.'],
      ['barrier', 'a', 'childcare', 'My husband works nights. Evenings I’m the only one with the kids.'],
      ['idea', 'n', 'bring', 'Teach it where we already are. The primary school after drop-off, we’re all standing there anyway.'],
    ],
  },
  {
    key: 'owen',
    name: 'Owen',
    about: who(O, 'No', M),
    points: [
      ['barrier', 'a', 'nojob', 'I did a degree in graphic design. Then the image generators came out. Great timing.'],
      ['idea', 'c', 'aiuse', 'Teach everyone the AI tools properly, like reading. I’d rather use them than be replaced by them.'],
      ['matters', 'a', 'needed', 'I want to make things people actually use, not spend all day applying for jobs.'],
    ],
  },
  {
    key: 'martina',
    name: 'Martina',
    about: who(S, 'Yes', F),
    points: [
      ['barrier', 'a', 'classes', 'I clean offices from five till nine, then again from six at night. Classes are in the middle of both.'],
      ['matters', 'c', 'family', 'My son has autism. Time with my family has to be planned like a military operation.'],
      ['wish', 'n', 'goodday', 'One job, not two. Home in the evening. That would be a good day.'],
    ],
  },
  {
    key: 'sam',
    name: 'Sam',
    about: who(E, 'Yes', M),
    points: [
      ['barrier', 'n', 'counts', 'Six years managing Mum’s meds, appointments and benefits. None of that counts as experience anywhere.'],
      ['barrier', 'a', 'earning', 'Carer’s Allowance stops if I study more than twenty-one hours a week. So I don’t.'],
      ['wish', 'c', 'goodday', 'Someone I trust with Mum two days a week, and me doing something that’s mine.'],
    ],
  },
  {
    key: 'joyce',
    name: 'Joyce',
    about: who(E, 'Yes', F),
    points: [
      ['matters', 'a', 'leave', 'I’m sixty-four. I’ve done my learning. Spend it on the young ones.'],
      ['moment', 'n', 'daynow', 'School run, nursery run, then my daughter’s ironing. I’m busier than when I worked.'],
      ['doubt', 'c', null, 'The council’s had plans before. Show me one that lasted past the next election.'],
    ],
  },
];

/** The themes of the Riverbend picture. Names are phrases taken from one of each theme’s points. */
export const EARNING_THEMES: ThemeSpec[] = [
  {
    key: 'needed',
    kind: 'matters',
    name: 'Good at something people need',
    sentences: [
      { text: 'Many say what they are proudest of is a skill nobody measures: calming people, noticing who is unwell, knowing every route.', from: ['sandra/2', 'liam/3', 'darren/2', 'gemma/2', 'nicole/4'] },
      { text: 'Several want their next job to be one where a person is still needed, not one a machine will take next year.', from: ['kofi/3', 'mo/2', 'precious/3', 'gareth/1'] },
    ],
  },
  {
    key: 'family',
    kind: 'matters',
    name: 'Time with my family',
    sentences: [
      { text: 'People name fixed times with family that they will not give up for a course: swimming on Saturday, church on Sunday, tea with the kids.', from: ['lena/3', 'faith/2', 'kerry/3', 'maureen/2'] },
      { text: 'Some chose their work or started a business to keep that time.', from: ['nadia/1', 'femi/2', 'mei/3'] },
    ],
  },
  {
    key: 'together',
    kind: 'matters',
    name: 'Learn with other people, not alone on a screen',
    sentences: [
      { text: 'People say they learn best from others in the same room, and some would only go back to learning if people like them were there too.', from: ['maureen/3', 'carl/3', 'kev/3', 'rosa/3', 'priya/2'] },
    ],
  },
  {
    key: 'leave',
    kind: 'matters',
    name: 'Don’t fix what isn’t broken',
    sentences: [
      { text: 'Some people, mostly older, are content with their work and want it to last or to change slowly, not to start again.', from: ['maureen/1', 'stuart/3', 'jo/4', 'joyce/1'] },
      { text: 'A few say the courses that exist are fine if people can get to them.', from: ['terry/1'] },
    ],
  },
  {
    key: 'classes',
    kind: 'barrier',
    name: 'On when I’m at work or asleep',
    sentences: [
      { text: 'People who work nights, early starts or rotating shifts say every course runs when they are at work or asleep.', from: ['kofi/2', 'sandra/1', 'lena/1', 'dean/1', 'hamid/1', 'faith/1'] },
      { text: 'Rotas that change every week or every few weeks rule out any course held on the same evening each week.', from: ['bev/1', 'tomasz/1', 'ewa/1', 'precious/1', 'gemma/1', 'stuart/1'] },
    ],
  },
  {
    key: 'earning',
    kind: 'barrier',
    name: 'I can’t stop earning to learn',
    sentences: [
      { text: 'Many say they cannot give up paid hours to study because the rent, the mortgage or the bills would not be paid.', from: ['ibrahim/1', 'lena/2', 'ade/2', 'rosa/2', 'kev/1'] },
      { text: 'Some fear their benefits or carer’s allowance would change if they studied.', from: ['aaliyah/4', 'kerry/4', 'sam/2'] },
      { text: 'A small employer says the same from the other side: he cannot keep the doors open if staff are away to learn.', from: ['jas/2'] },
    ],
  },
  {
    key: 'nojob',
    kind: 'barrier',
    name: 'What will still be a job',
    sentences: [
      { text: 'People who have lost work, or expect to, say nobody can tell them what to retrain as so it does not happen again.', from: ['darren/4', 'ade/3', 'paul/2', 'andy/1'] },
      { text: 'Younger people say the advice they get is a direction, not a job.', from: ['chloe/1', 'owen/1'] },
    ],
  },
  {
    key: 'childcare',
    kind: 'barrier',
    name: 'No childcare during classes',
    sentences: [
      { text: 'Parents say classes start when childminders finish, and paying for extra childcare costs more than the course would earn them.', from: ['aaliyah/1', 'shabnam/1', 'kerry/1', 'zainab/1', 'lucy/2'] },
    ],
  },
  {
    key: 'counts',
    kind: 'barrier',
    name: 'What I already know doesn’t count',
    sentences: [
      { text: 'People with years of experience say none of it counts on paper, so they are asked to start again at the bottom.', from: ['grace/3', 'paul/3', 'darren/3', 'stuart/2', 'mei/2'] },
      { text: 'Skills from looking after family, such as managing medicines and appointments, are not counted either.', from: ['sam/1', 'sandra/3'] },
    ],
  },
  {
    key: 'daynow',
    kind: 'day',
    name: 'Same as last week',
    sentences: [
      { text: 'Days are long and full, and several people describe new machines or software already doing part of their work.', from: ['tomasz/2', 'lena/4', 'jo/1', 'liam/1', 'ryan/1'] },
    ],
  },
  {
    key: 'goodday',
    kind: 'day',
    name: 'Home in the evening',
    sentences: [
      { text: 'A good ordinary day is mostly about time: a rota known ahead, home in the evening, and energy left for family.', from: ['rosa/4', 'martina/3', 'faith/4', 'gemma/4', 'sandra/4'] },
      { text: 'Some picture a better job close to home: a nurse, a teacher, a team leader.', from: ['grace/4', 'zainab/3', 'ewa/4'] },
    ],
  },
  {
    key: 'catchup',
    kind: 'idea',
    name: 'Catch up when my rota changes',
    sentences: [
      { text: 'People suggest recorded classes, switching groups when a rota changes, and short sessions at times nobody else uses.', from: ['ewa/2', 'bev/4', 'priya/3', 'dean/3', 'mo/3'] },
    ],
  },
  {
    key: 'bring',
    kind: 'idea',
    name: 'Teach it where we already are',
    sentences: [
      { text: 'People suggest teaching at workplaces, the school gate, the mosque hall and the industrial estate, at the start or end of a shift.', from: ['lucy/3', 'kofi/4', 'marek/3', 'hamid/3', 'gareth/4'] },
    ],
  },
  {
    key: 'paidhours',
    kind: 'idea',
    name: 'Pay the hours',
    sentences: [
      { text: 'Workers say they would learn if a few hours a week were paid, and one employer would pay her share if the council matched it.', from: ['ibrahim/2', 'tomasz/4', 'precious/4', 'helen/1', 'gemma/3'] },
    ],
  },
  {
    key: 'creche',
    kind: 'idea',
    name: 'A crèche on site',
    sentences: [{ text: 'Parents suggest a crèche in the same building as the class, even for two hours.', from: ['kerry/2', 'shabnam/3', 'zainab/2'] }],
  },
  {
    key: 'askus',
    kind: 'idea',
    name: 'Ask us what we’re short of',
    sentences: [{ text: 'Small employers say nobody asks them what skills they cannot find, such as electric cars, floor machines or lashes.', from: ['jas/3', 'femi/1', 'mei/1'] }],
  },
  {
    key: 'aiuse',
    kind: 'idea',
    name: 'Show me properly how to use the thing',
    sentences: [{ text: 'Some want to be taught to use and check the new software before it arrives, so they are the ones checking it.', from: ['jo/3', 'sunita/3', 'nicole/3', 'owen/2'] }],
  },
  {
    key: 'young',
    kind: 'idea',
    name: 'Ask people my age',
    sentences: [{ text: 'The three people under 25 who took part want young people asked, and to help decide.', from: ['chloe/2', 'aaliyah/3', 'ryan/3'] }],
  },
];
