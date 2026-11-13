import { useId } from 'react';
import type { RoomPace } from '@unite/shared';
import { Field, inputClass } from '../../ui/Field';

/** How a room the steward draws will run: live for some minutes, or slow for some days (section 12.2). */
export interface RoomLength {
  pace: RoomPace;
  minutes: string;
  days: string;
}

export const DEFAULT_ROOM_LENGTH: RoomLength = { pace: 'live', minutes: '45', days: '5' };
export const SLOW_DAYS = { min: 2, max: 14, default: 5 } as const;

/** The part of the create-room body that says how long it runs. */
export function roomLengthBody(l: RoomLength): { minutes: number } | { pace: 'slow'; days: number } {
  if (l.pace === 'slow') return { pace: 'slow', days: Number(l.days) || SLOW_DAYS.default };
  return { minutes: Number(l.minutes) || 45 };
}

const shown = (s: string, fallback: number) => (Number(s) > 0 ? Number(s) : fallback);

/** The choice between "Live, for N minutes" and "Slow, for N days", and the length for the one chosen. */
export function RoomLengthFields({ value, onChange }: { value: RoomLength; onChange: (v: RoomLength) => void }) {
  const name = useId();
  const minutes = shown(value.minutes, 45);
  const days = shown(value.days, SLOW_DAYS.default);
  const options = [
    { pace: 'live' as const, label: `Live, for ${minutes} minutes`, hint: 'Everyone takes part at the same time.' },
    { pace: 'slow' as const, label: `Slow, for ${days} ${days === 1 ? 'day' : 'days'}`, hint: 'People write when it suits them, and read the others once they have written.' },
  ];
  return (
    <>
      <fieldset className="mb-5">
        <legend className="mb-1 font-bold">How the room runs</legend>
        <div className="space-y-2">
          {options.map((o) => (
            <label key={o.pace} className="flex min-h-11 items-start gap-2">
              <input type="radio" name={name} value={o.pace} checked={value.pace === o.pace} onChange={() => onChange({ ...value, pace: o.pace })} className="mt-1 h-5 w-5 shrink-0" />
              <span>
                <span className="block">{o.label}</span>
                <span className="block text-sm text-muted">{o.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {value.pace === 'slow' ? (
        <Field label="How long, in days" hint={`From ${SLOW_DAYS.min} to ${SLOW_DAYS.max} days.`}>
          <input type="number" min={SLOW_DAYS.min} max={SLOW_DAYS.max} className={inputClass} value={value.days} onChange={(e) => onChange({ ...value, days: e.target.value })} />
        </Field>
      ) : (
        <Field label="How long, in minutes">
          <input type="number" min={10} className={inputClass} value={value.minutes} onChange={(e) => onChange({ ...value, minutes: e.target.value })} />
        </Field>
      )}
    </>
  );
}
