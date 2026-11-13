/**
 * The live room the recording shows (chapter "Working it through"): the seed's scheduled room on
 * "Everyone should be taught to use AI tools as a basic skill, like reading.", opened while
 * the scene plays, with the viewer and five Riverbend people from the seed in it.
 *
 * Everyone here is invented. The other members' lines are posted through the app's own
 * message endpoint, one at a time while the scene plays; the facilitator's lines are not
 * scripted at all: the app's facilitator posts them by its own rules (welcome on opening,
 * then inviting whoever hasn't spoken yet).
 */

/** Seed person keys, in room order; 'viewer' is the person recording. Room order decides who the facilitator invites next. */
export const LIVE_ROOM_MEMBERS = ['owen', 'viewer', 'kev', 'sandra', 'jo', 'carl'] as const;

export type LiveRoomMember = Exclude<(typeof LIVE_ROOM_MEMBERS)[number], 'viewer'>;

/** What the other members say, in order. The viewer's own line is typed in the browser between them. */
export const LIVE_ROOM_LINES: { who: LiveRoomMember | 'viewer'; text: string }[] = [
  { who: 'owen', text: 'I said agree. I’d rather know how to use these tools than be replaced by someone who does.' },
  { who: 'viewer', text: 'I do nights in a care home. I want my level 3 first, then the AI.' },
  { who: 'kev', text: 'Like reading? Reading doesn’t change every six months. Teach people to check it, not this year’s app.' },
  { who: 'sandra', text: 'Same as Amina. Care first. But a course on checking what the computer says, I’d go to that.' },
];
