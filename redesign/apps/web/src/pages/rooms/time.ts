/** Time left in words: "31 minutes left", "1 minute left", "Less than a minute left", "Time is up". */
export function timeLeftWords(ms: number): string {
  if (ms <= 0) return 'Time is up';
  if (ms < 60_000) return 'Less than a minute left';
  const m = Math.ceil(ms / 60_000);
  return `${m} ${m === 1 ? 'minute' : 'minutes'} left`;
}
