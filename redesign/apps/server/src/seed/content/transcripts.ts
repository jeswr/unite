import { SCRIPTED_QUESTIONS } from '../../ai/prompts.js';
import type { PointType } from '@unite/shared';
import type { Transcript, TurnSpec, Vis } from './types.js';

/**
 * The six example people whose whole conversation is stored: four in Riverbend, two in open
 * listening. The interviewer's turns are the fixed questions from `ai/prompts.ts` (and, inside an
 * assembly, the host's probes in stage 7). Each point cites the answers it was drawn from, and
 * its wording is taken from them. These transcripts are private to their (invented) owners.
 */

/** The probes of the Riverbend assembly, asked one per turn in stage 7 (they match seed/assemblies.ts). */
export const EARNING_PROBES = [
  'When did you last learn something that helped you at work, and how did it happen?',
  'What would have to change in your week for you to take a course?',
  'What do you already know how to do that nobody has written down?',
];

type Answers = Record<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8, string[]>;
interface DraftPoint {
  type: PointType;
  vis: Vis;
  theme: string | null;
  text: string;
  /** [stage, answer number counting from 0]. */
  from: [number, number][];
}

/**
 * Turns for stages 1 to 8: the fixed opener, the person's answer, then the fixed follow-up and
 * the next answer. In stage 7, when the assembly has probes, each further answer follows a probe.
 */
function build(answers: Answers, points: DraftPoint[], probes: string[] = [], exit?: Transcript['exit']): Transcript {
  const turns: TurnSpec[] = [];
  const index = new Map<string, number>();
  for (const stage of [1, 2, 3, 4, 5, 6, 7, 8] as const) {
    const [opener, followUp] = SCRIPTED_QUESTIONS[stage]!;
    answers[stage].forEach((answer, k) => {
      const question = k === 0 ? opener : stage === 7 && probes.length ? probes[k - 1]! : followUp;
      turns.push([stage, 'interviewer', question]);
      index.set(`${stage}:${k}`, turns.length);
      turns.push([stage, 'person', answer]);
    });
  }
  return {
    turns,
    points: points.map((p) => ({ ...p, from: p.from.map(([s, k]) => index.get(`${s}:${k}`)!) })),
    ...(exit ? { exit } : {}),
  };
}

/* ------------------------------------------------------------------ Riverbend */

export const KOFI = build(
  {
    1: [
      'Got in from the warehouse about seven this morning. Slept till two, went to the gym, made jollof for the week, and I’m back on at ten tonight.',
      'Then work. Ten till six, picking. Headphones in, scanner on my wrist, eleven hundred lines if it’s a good night.',
    ],
    2: [
      'Honestly, the gym. It’s the only bit of the day that’s mine. Nobody’s timing me there.',
      'Because at work everything’s timed. I’m fast and I’m accurate, and I’d like to be good at something people need, not something a robot does by next year.',
    ],
    3: [
      'I wanted to do the electrical maintenance course at the college. Every course I looked at is on when I’m at work or asleep.',
      'The times. Evenings start at six, I’m asleep. Daytime I’m asleep. Weekends they do one course, and it’s bookkeeping.',
    ],
    4: [
      'Wake up at seven, not go to bed at seven. Breakfast like a normal person. Drive to a site where I fix the robots instead of racing them.',
      'Home by five. Five-a-side on a Wednesday. Maybe someone to cook for, not just a week of jollof in boxes.',
    ],
    5: [
      'My mum, back in Accra. I send money every month. Whatever I do next can’t mean she goes short.',
      'The lads at work who don’t want to learn anything new. If the robots come, they’re stuck.',
    ],
    6: [
      'The money and the sleep. If I go on days to study, I lose my night premium. I’d give up the premium for a year if I knew there was a job at the end.',
      'If nobody could tell me there’s a job at the end, I’d keep the premium and keep picking.',
    ],
    7: [
      'Run the maintenance course at the site itself, between shifts. The engineers are already there. Let them teach us the forklift and the tickets.',
      'Last year an engineer showed me how to reset the conveyor when it jams. Ten minutes, at three in the morning. Best training I’ve had.',
      'A course that starts at seven in the morning, straight after my shift, near the warehouse. Or one I can do in my four days off.',
      'I can tell from the sound when a conveyor belt is about to go. Nobody wrote that down. I just know it.',
    ],
    8: [
      'Whether the robots come in two years or ten. Nobody does, really.',
      'If the company told us straight what the plan is. Then I’d know whether to learn or to leave.',
    ],
  },
  [
    { type: 'moment', vis: 'a', theme: 'daynow', text: 'Got in from the warehouse about seven, slept till two, and I’m back on at ten tonight.', from: [[1, 0]] },
    { type: 'barrier', vis: 'n', theme: 'classes', text: 'Every course I looked at is on when I’m at work or asleep.', from: [[3, 0]] },
    { type: 'matters', vis: 'a', theme: 'needed', text: 'I’m fast and I’m accurate, and I’d like to be good at something people need, not something a robot does by next year.', from: [[2, 1]] },
    { type: 'idea', vis: 'c', theme: 'bring', text: 'Run the maintenance course at the site itself, between shifts. The engineers are already there.', from: [[7, 0]] },
    { type: 'doubt', vis: 'a', theme: null, text: 'Nobody knows if the robots come in two years or ten. If the company told us straight, I’d know whether to learn or leave.', from: [[8, 0], [8, 1]] },
  ],
  EARNING_PROBES,
  { soundsLikeMe: 4, pushed: 'no' },
);

export const DARREN = build(
  {
    1: [
      'Yesterday? Job centre at half nine. Then I walked the long way home past the depot, which I shouldn’t do.',
      'Afternoon I did two applications online. One wanted a covering letter. I don’t know what a covering letter is meant to say any more.',
    ],
    2: [
      'Walking past the depot. I worked there nineteen years. Sorting parcels, then supervising the night sort.',
      'Because I was good at it. I knew every driver, every route, which postcodes always went wrong. Then the new sorting machines came and they needed eight of us, not forty.',
    ],
    3: [
      'I wanted to do the warehouse management course. It’s sixteen weeks and I’d have to pay for the first part.',
      'Money, mainly. And I’m fifty-four. I keep thinking, who takes on a fifty-four-year-old with a new certificate?',
    ],
    4: [
      'Up at six, because I always am. Out of the house by seven with somewhere to be. People who need me to turn up.',
      'Home by four, tea with the wife, darts on a Thursday. Honestly, not much different from how it was. That’s what I want.',
    ],
    5: ['My wife. She’s been carrying us on her wages since March and she’s tired.', 'The young lads, maybe. If a fifty-four-year-old gets the job, a twenty-year-old doesn’t.'],
    6: [
      'I want to be paid properly and I want something steady. If I had to pick, steady. I’d take less for something that lasts.',
      'If the wife lost her job too, I’d take anything that paid, steady or not.',
    ],
    7: [
      'Let people like me teach. I trained every new starter at that depot for nineteen years, and none of that counts for anything on paper.',
      'When the scanners came in, about 2015. The manager showed me once and then I showed everybody else.',
      'If the course was free, and I could still sign on while I did it. And if somebody told me there’s a job at the end.',
      'Run a night sort of forty people and get every van out by five. None of that is written down anywhere.',
    ],
    8: [
      'Whether there’ll be jobs like mine at all. Nobody can tell me what will still be a job.',
      'Seeing someone my age get taken on after one of these courses. Just one.',
    ],
  },
  [
    { type: 'moment', vis: 'c', theme: 'daynow', text: 'Job centre at half nine, then I walked the long way home past the depot, which I shouldn’t do.', from: [[1, 0]] },
    { type: 'matters', vis: 'n', theme: 'needed', text: 'I knew every driver, every route, which postcodes always went wrong. Then the machines came and they needed eight of us, not forty.', from: [[2, 1]] },
    { type: 'barrier', vis: 'a', theme: 'counts', text: 'I trained every new starter at that depot for nineteen years, and none of that counts for anything on paper.', from: [[7, 0]] },
    { type: 'barrier', vis: 'a', theme: 'nojob', text: 'Nobody can tell me what will still be a job. And who takes on a fifty-four-year-old with a new certificate?', from: [[8, 0], [3, 1]] },
    { type: 'tradeoff', vis: 'c', theme: null, text: 'If I had to pick, steady. I’d take less for something that lasts.', from: [[6, 0]] },
  ],
  EARNING_PROBES,
  { soundsLikeMe: 3, pushed: 'no', note: 'It got the depot right.' },
);

export const JAS = build(
  {
    1: [
      'Opened the garage at eight. Two MOTs, a clutch, and a woman whose hybrid wouldn’t start and we didn’t have the kit to tell her why.',
      'Afternoon was paperwork and ringing round for parts. Picked my daughter up from after-school club at six, last one there again.',
    ],
    2: [
      'The hybrid. I had to send her to the main dealer in the next town. That stung.',
      'Because in five years half the cars coming in will be electric or hybrid, and if we can’t work on them, we’re finished. I’ve got four lads depending on that.',
    ],
    3: [
      'I wanted to send my two mechanics on the electric vehicle course. The nearest one’s forty miles away, over three weekdays.',
      'If two of my four are away three days, I close. I can’t let someone go to college on a weekday and keep the doors open.',
    ],
    4: [
      'Open up at eight, and the lads already know how to do the hybrids. We’re the place people come to, not the place that sends them away.',
      'Finish at half five, pick my daughter up on time for once, and not do the VAT return at the kitchen table at eleven.',
    ],
    5: ['My lads. Two of them are in their fifties. If the trade moves on without them, that’s not fair after thirty years.', 'Maybe the main dealers, if we start doing their work. I can live with that.'],
    6: [
      'Training the lads and keeping the doors open. If it came to it, I’d close one day a week for a few months. Not three days.',
      'If the course was in the evenings or Saturdays, I wouldn’t have to choose at all.',
    ],
    7: [
      'Ask us what we’re short of. I’d tell the college tomorrow: electric and hybrid, evenings, here in town.',
      'Last spring a parts rep did a lunchtime session on hybrid batteries in our workshop. The lads learned more in an hour than from any video.',
      'If it was evenings or a Saturday, in town, and the council helped with the cost of the kit.',
      'My older mechanic can diagnose a fault by listening to the engine. No course teaches that and no computer does it.',
    ],
    8: [
      'Whether electric really takes over or we all end up on something else in ten years. I don’t want to train for the wrong thing.',
      'If the big dealers started closing their own workshops, I’d know it’s happening fast.',
    ],
  },
  [
    { type: 'moment', vis: 'a', theme: 'daynow', text: 'A woman’s hybrid wouldn’t start and we didn’t have the kit to tell her why. I had to send her to the main dealer.', from: [[1, 0], [2, 0]] },
    { type: 'barrier', vis: 'a', theme: 'earning', text: 'If two of my four are away three days, I close. I can’t let someone go to college on a weekday.', from: [[3, 1]] },
    { type: 'idea', vis: 'n', theme: 'askus', text: 'Ask us what we’re short of. I’d tell the college tomorrow: electric and hybrid, evenings, here in town.', from: [[7, 0]] },
    { type: 'matters', vis: 'c', theme: 'family', text: 'Pick my daughter up on time for once, and not do the VAT return at the kitchen table at eleven.', from: [[4, 1]] },
    { type: 'barrier', vis: 'a', theme: 'counts', text: 'My older mechanic can diagnose a fault by listening to the engine. No course teaches that.', from: [[7, 3]] },
    { type: 'doubt', vis: 'c', theme: null, text: 'I don’t want to train for the wrong thing if electric doesn’t take over.', from: [[8, 0]] },
  ],
  EARNING_PROBES,
  { soundsLikeMe: 4, pushed: 'no' },
);

export const GEMMA = build(
  {
    1: [
      'I was on a long day yesterday, seven till half seven on the stroke ward. Got home, kids were in bed, ate standing up.',
      'Before that I’d dropped the kids at my mum’s at half six, because she has them on my long days.',
    ],
    2: [
      'A patient’s daughter came to find me before I left to say thank you for sitting with her dad. He’d been frightened all afternoon.',
      'Because nobody measures that. The computer logs obs and fluids. It doesn’t log sitting with a frightened man for twenty minutes.',
    ],
    3: [
      'I wanted to start the nursing degree apprenticeship. The access course is Monday and Wednesday evenings and my long days move every week.',
      'The rota, mostly. And the apprenticeship pays less than I get now, so I’d be paying to learn.',
    ],
    4: [
      'Wake up, kids to school myself, a shift that finishes at three. I’m a nurse, on the same ward, and I know what I’m doing.',
      'Pick the kids up, tea at the table together, and I’m not too tired to listen to them.',
    ],
    5: ['My mum. She does my childcare and she’s sixty-eight. It can’t all keep landing on her.', 'The other healthcare assistants, if the training only goes to the ones who can afford to drop money.'],
    6: [
      'Becoming a nurse and having time with the kids. Right now the kids win. I’ll wait until the youngest is at secondary school if I have to.',
      'If the course fitted my rota, I’d do it now and not wait.',
    ],
    7: [
      'Let the hospital give us study hours, like the doctors get, and run the access course on different days in the week.',
      'A senior nurse showed me how to use the new obs machine on a night shift. Twenty minutes, at the bedside.',
      'A course that runs on more than one day, so if my long day lands on Monday I can go on Wednesday. And study hours.',
      'I can calm a patient with dementia who’s trying to get out of bed. There’s no qualification for that.',
    ],
    8: ['Whether I’m too old to start nursing at thirty-six. I honestly don’t know.', 'Meeting someone who did it at my age, with kids.'],
  },
  [
    { type: 'barrier', vis: 'a', theme: 'classes', text: 'The access course is Monday and Wednesday evenings and my long days move every week.', from: [[3, 0]] },
    { type: 'matters', vis: 'n', theme: 'needed', text: 'Nobody measures sitting with a frightened man for twenty minutes. The computer logs obs and fluids.', from: [[2, 1]] },
    { type: 'idea', vis: 'c', theme: 'paidhours', text: 'Let the hospital give us study hours, like the doctors get.', from: [[7, 0]] },
    { type: 'wish', vis: 'a', theme: 'goodday', text: 'Kids to school myself, a shift that finishes at three, and not too tired to listen to them.', from: [[4, 0], [4, 1]] },
    { type: 'doubt', vis: 'c', theme: null, text: 'Whether I’m too old to start nursing at thirty-six.', from: [[8, 0]] },
  ],
  EARNING_PROBES,
  { soundsLikeMe: 4, pushed: 'a_little', note: 'It kept asking about the course when I wanted to talk about my mum.' },
);

/* ------------------------------------------------------------------ open listening */

export const NGOZI = build(
  {
    1: [
      'I woke at five, gave Daddy his insulin at six, dropped the kids at school and was at the pharmacy by eight.',
      'After work I went to the market, cooked, and checked his feet because of the diabetes. I slept around midnight.',
    ],
    2: [
      'Checking his feet. He used to carry me on his shoulders, and now I’m the one holding his arm to the toilet.',
      'Because I want to do it well. He did everything for us. I don’t want him to feel like a burden.',
    ],
    3: [
      'I wanted to go for a promotion at work, area supervisor. But it means travelling to other branches.',
      'Daddy. Every time he has a bad day, I have to leave work. My manager has started counting.',
    ],
    4: [
      'Daddy comfortable at home, a nurse who comes in the afternoon, and me at work without my phone in my hand.',
      'Evening, we all eat together, Daddy tells his stories, and I go to bed before midnight.',
    ],
    5: ['My husband. He has been patient, but he is carrying a lot too.', 'My younger sister, maybe. She’s in Abuja and she sends money, but it’s me doing everything.'],
    6: ['The promotion and caring for Daddy. Daddy comes first. The promotion can wait.', 'If he had a good nurse, I would go for it straight away.'],
    7: [
      'A nurse who comes to the house for a few hours, paid for through work, like health insurance.',
      'My employer, with government help. My company gives us HMO, so why not something for our parents?',
    ],
    8: ['I don’t know if I can keep this up for ten more years.', 'If my sister moved back, or if a home nurse was affordable.'],
  },
  [
    { type: 'moment', vis: 'a', theme: 'morning', text: 'Gave Daddy his insulin at six, dropped the kids at school and was at the pharmacy by eight.', from: [[1, 0]] },
    { type: 'barrier', vis: 'n', theme: 'care', text: 'Every time Daddy has a bad day, I have to leave work. My manager has started counting.', from: [[3, 1]] },
    { type: 'wish', vis: 'a', theme: 'goodday', text: 'Daddy comfortable at home, a nurse who comes in the afternoon, and me at work without my phone in my hand.', from: [[4, 0]] },
    { type: 'idea', vis: 'c', theme: 'carecover', text: 'A nurse who comes to the house for a few hours, paid for through work, like health insurance.', from: [[7, 0]] },
    { type: 'doubt', vis: 'a', theme: null, text: 'I don’t know if I can keep this up for ten more years.', from: [[8, 0]] },
  ],
  [],
  { soundsLikeMe: 4, pushed: 'no' },
);

export const RAVI = build(
  {
    1: [
      'I left home at 7:30 and reached the office at 9:40. Two hours ten minutes for eighteen kilometres.',
      'Worked till six, testing an app release. Then two hours back. My daughter was asleep when I reached.',
    ],
    2: ['Seeing her asleep. I missed her whole day again.', 'Because putting my daughter to bed is the only time I really talk to her, and even that I am missing now.'],
    3: ['I wanted to join a cricket team on weekday evenings, like in college. There is no evening left.', 'The traffic. It takes four hours of my day. Nothing fits after that.'],
    4: ['I walk or cycle fifteen minutes to work. I am at my desk by nine, fresh.', 'Home by six thirty, play with my daughter in the park, put her to bed myself.'],
    5: ['My wife. She also works, and she does more of the evenings because I am stuck on the road.', 'Maybe people who own flats near the tech parks. Rents there would go up even more.'],
    6: ['The good salary here and time at home. For now the salary wins, because of the flat loan.', 'If my wife got a promotion, I would take a job closer for less money.'],
    7: ['Let us work from the office near home. The company already has one, ten minutes from my flat.', 'My manager could approve it. It is only habit that everyone comes to the main campus.'],
    8: [
      'My job is testing software, and now AI tests software. I am not sure what I will be doing in five years.',
      'If my company trained us to work with these tools instead of just using them to cut people.',
    ],
  },
  [
    { type: 'moment', vis: 'c', theme: 'morning', text: 'Left home at 7:30 and reached the office at 9:40. Two hours ten minutes for eighteen kilometres.', from: [[1, 0]] },
    { type: 'barrier', vis: 'a', theme: 'commute', text: 'The traffic takes four hours of my day. My daughter was asleep when I reached.', from: [[3, 1], [1, 1]] },
    { type: 'matters', vis: 'n', theme: 'time', text: 'Putting my daughter to bed is the only time I really talk to her.', from: [[2, 1]] },
    { type: 'idea', vis: 'a', theme: 'closer', text: 'Let us work from the office near home. The company already has one, ten minutes from my flat.', from: [[7, 0]] },
    { type: 'doubt', vis: 'c', theme: null, text: 'My job is testing software, and now AI tests software. I am not sure what I will be doing in five years.', from: [[8, 0]] },
  ],
  [],
  { soundsLikeMe: 3, pushed: 'no' },
);
