import type { Conversation, Point, PointType } from '@unite/shared';

/** A point's type in plain words, for the person who made it. */
export const POINT_TYPE_LABELS: Record<PointType, string> = {
  moment: 'Something that happened',
  matters: 'Why it matters',
  barrier: 'What gets in the way',
  wish: 'Part of a good day',
  idea: 'An idea',
  tradeoff: 'A hard choice',
  doubt: 'Something you are unsure of',
};

export const POINT_TYPES = Object.keys(POINT_TYPE_LABELS) as PointType[];

/** How a point is shown, each explained in a line. */
export const VISIBILITY_CHOICES: { value: Point['visibility']; label: string; line: string }[] = [
  { value: 'count', label: 'Counted only', line: 'It adds one to the number of people who said something like it. Your words are not shown.' },
  { value: 'anonymous', label: 'Shown without your name', line: 'Your words can be quoted in the picture, with no name beside them.' },
  { value: 'named', label: 'Shown with your name', line: 'Your words can be quoted in the picture with your display name.' },
];

export const ROUTE_CHOICES: { value: Exclude<Conversation['route'], 'host'>; label: string; line: string }[] = [
  { value: 'ai', label: 'Talk with the AI interviewer', line: 'It asks one question at a time and follows what you say. About 12 minutes.' },
  { value: 'questions', label: 'Answer written questions', line: 'The same questions, fixed, one page at a time. No AI asks them.' },
  { value: 'freetext', label: 'Write freely', line: 'One box. Write what you like, and you get points from it to check.' },
];

export const CONVERSATION_STATUS_WORDS: Record<Conversation['status'], string> = {
  active: 'In progress',
  reviewing: 'Your points are waiting for you to check',
  complete: 'Finished',
  abandoned: 'Left unfinished',
};

/** "Do these points sound like you?", from 1 to 4. */
export const SOUNDS_LIKE_ME: { value: 1 | 2 | 3 | 4; label: string }[] = [
  { value: 1, label: 'Not like me' },
  { value: 2, label: 'A little like me' },
  { value: 3, label: 'Mostly like me' },
  { value: 4, label: 'Just like me' },
];

export const PUSHED: { value: 'no' | 'a_little' | 'yes'; label: string }[] = [
  { value: 'no', label: 'No' },
  { value: 'a_little', label: 'A little' },
  { value: 'yes', label: 'Yes' },
];

/** Where the picture for an assembly is. */
export function picturePath(a: { slug: string; isOpenListening: boolean }): string {
  return a.isOpenListening ? '/listening' : `/a/${a.slug}/picture`;
}
