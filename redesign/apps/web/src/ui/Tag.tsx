import type { ReactNode } from 'react';

export type TagTone = 'neutral' | 'accent' | 'agree' | 'disagree' | 'unsure' | 'warn';

const tones: Record<TagTone, string> = {
  neutral: 'border-muted text-ink',
  accent: 'border-accent text-accent',
  agree: 'border-agree text-agree',
  disagree: 'border-disagree text-disagree',
  unsure: 'border-unsure text-unsure',
  warn: 'border-warn text-warn',
};

/** A small label in words. Colour only where it carries meaning; the words always say it too. */
export function Tag({ tone = 'neutral', children }: { tone?: TagTone; children: ReactNode }) {
  return <span className={`inline-block rounded-ui border px-2 py-0.5 text-sm font-bold leading-snug ${tones[tone]}`}>{children}</span>;
}
