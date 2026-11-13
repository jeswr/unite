const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** A room opened for three days still reads "3 days left" for its first hour, and so on down. */
const DAY_GRACE = HOUR;
const HOUR_GRACE = 5 * MINUTE;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Time left in words, for slow rooms (section 12.2): "3 days left", "5 hours left",
 * "20 minutes left", "1 minute left", or "Time is up". Whole days and hours are counted down, with
 * a short grace so a room that has just opened for three days says "3 days left", not "2 days
 * left"; minutes are rounded up, so the last seconds still read "1 minute left".
 */
export function timeLeftWords(ms: number): string {
  if (!(ms > 0)) return 'Time is up';
  if (ms + DAY_GRACE >= DAY) return `${plural(Math.floor((ms + DAY_GRACE) / DAY), 'day')} left`;
  if (ms + HOUR_GRACE >= HOUR) return `${plural(Math.floor((ms + HOUR_GRACE) / HOUR), 'hour')} left`;
  return `${plural(Math.ceil(ms / MINUTE), 'minute')} left`;
}
