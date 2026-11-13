const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Time left in words, for slow rooms (section 12.2): "3 days left", "5 hours left",
 * "20 minutes left", "1 minute left", or "Time is up". Whole days and hours are rounded down, so
 * "1 day left" means at least a day; minutes are rounded up, so the last seconds still read
 * "1 minute left".
 */
export function timeLeftWords(ms: number): string {
  if (!(ms > 0)) return 'Time is up';
  if (ms >= DAY) return `${plural(Math.floor(ms / DAY), 'day')} left`;
  if (ms >= HOUR) return `${plural(Math.floor(ms / HOUR), 'hour')} left`;
  const minutes = Math.ceil(ms / MINUTE);
  return minutes >= 60 ? '1 hour left' : `${plural(minutes, 'minute')} left`;
}
