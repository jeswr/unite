import { DAY_MS } from '@unite/shared';

/** The UTC calendar day of a date or date-time, as milliseconds at midnight. */
function utcDay(isoOrDate: string | Date): number {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate.length === 10 ? `${isoOrDate}T00:00:00Z` : isoOrDate) : isoOrDate;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Whole calendar days from the due date to now, in UTC: 0 on or before the due date. A decision
 * due on 1 November is 12 days late on 13 November.
 */
export function daysPast(due: string, now: Date): number {
  return Math.max(0, Math.round((utcDay(now) - utcDay(due)) / DAY_MS));
}

/** True when `at` falls on or before the due day. */
export function onOrBefore(at: string, due: string): boolean {
  return utcDay(at) <= utcDay(due);
}
