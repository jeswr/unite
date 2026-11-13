import { formatDate, timeLeftWords as slowTimeLeftWords, type RoomPace } from '@unite/shared';

/** Time left in words: "31 minutes left", "1 minute left", "Less than a minute left", "Time is up". */
export function timeLeftWords(ms: number): string {
  if (ms <= 0) return 'Time is up';
  if (ms < 60_000) return 'Less than a minute left';
  const m = Math.ceil(ms / 60_000);
  return `${m} ${m === 1 ? 'minute' : 'minutes'} left`;
}

/** A room's time left in words: minutes in a live room, days or hours in a slow one ("3 days left"). */
export function roomTimeLeft(ms: number, pace: RoomPace): string {
  return pace === 'slow' ? slowTimeLeftWords(ms) : timeLeftWords(ms);
}

/** "45 minutes", or "5 days" for a slow room: how long a room runs. */
export function roomLengthWords(minutes: number, pace: RoomPace): string {
  if (pace !== 'slow') return `${minutes} minutes`;
  const days = Math.max(1, Math.round(minutes / 1440));
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

/** "Live room" or "Slow room": the label every room carries in lists. */
export const PACE_LABEL: Record<RoomPace, string> = { live: 'Live room', slow: 'Slow room' };

/** The line a slow room's page shows (section 12.2). */
export function slowRoomLine(endsAt: string): string {
  return `This is a slow room. It is open until ${formatDate(endsAt)}. Write when you can, and come back to read the others.`;
}

/** "3 people have written. You will see what they wrote once you have written where you stand." */
export function writeFirstNotice(people: number): string {
  if (people === 0) return 'Nobody else has written yet. Write where you stand, and you will see what the others write after that.';
  const who = people === 1 ? '1 person has written' : `${people} people have written`;
  return `${who}. You will see what they wrote once you have written where you stand.`;
}
